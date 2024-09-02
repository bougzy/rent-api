const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = 5000;

// Middleware
app.use(bodyParser.json());
// app.use(cors());


// Configure CORS to allow requests from a specific origin
app.use(cors({
  origin: 'https://rentme-smoky.vercel.app', // Allow only this URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// MongoDB connection
mongoose.connect('mongodb+srv://apartment:apartment@apartment.atzv3.mongodb.net/apartment', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Error connecting to MongoDB:', err));

// Define schemas and models
const tenantSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  rentPaid: { type: Boolean, default: false },
  rentStart: { type: Date },
  rentEnd: { type: Date },
});

const Tenant = mongoose.model('Tenant', tenantSchema);

const apartmentSchema = new mongoose.Schema({
  apartmentID: { type: String, required: true },
  tenants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }],
  rentAmount: { type: Number },
});

const Apartment = mongoose.model('Apartment', apartmentSchema);

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  date: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

const paymentSchema = new mongoose.Schema({
  tenantID: String,
  amount: Number,
  date: { type: Date, default: Date.now },
});

app.get('/', (req, res) => {
  res.send('Welcome to the RentMe API');
});


const Payment = mongoose.model('Payment', paymentSchema);

// Dummy landlord data (kept hardcoded for simplicity)
const landlord = { username: "admin", password: "admin123" };

// Route for landlord login (hardcoded)
app.post('/landlord/login', (req, res) => {
  const { username, password } = req.body;
  if (username === landlord.username && password === landlord.password) {
    res.status(200).json({ message: 'Login successful', isAdmin: true });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Register tenant
app.post('/tenant/register', async (req, res) => {
  const { name, password } = req.body;
  const apartmentID = `APT${Math.floor(Math.random() * 10000)}`;

  try {
    const newTenant = new Tenant({ id: apartmentID, name, password, rentPaid: false });
    const apartment = await Apartment.findOne({ apartmentID });
    if (apartment && apartment.tenants.length >= 3) {
      return res.status(400).json({ message: 'Apartment is full' });
    }

    await newTenant.save();
    if (apartment) {
      apartment.tenants.push(newTenant._id);
      await apartment.save();
    } else {
      const newApartment = new Apartment({ apartmentID, tenants: [newTenant._id] });
      await newApartment.save();
    }

    res.status(201).json({ message: 'Tenant registered successfully', apartmentID });
  } catch (err) {
    res.status(500).json({ message: 'Error registering tenant', error: err.message });
  }
});

// Tenant login
app.post('/tenant/login', async (req, res) => {
  const { id, password } = req.body;
  try {
    const tenant = await Tenant.findOne({ id, password });
    if (tenant) {
      res.status(200).json({ message: 'Login successful', tenant });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error during login', error: err.message });
  }
});

// Update tenant details
app.put('/tenant/update', async (req, res) => {
  const { id, name, password } = req.body;
  try {
    const tenant = await Tenant.findOneAndUpdate({ id }, { name, password }, { new: true });
    if (tenant) {
      res.status(200).json({ message: 'Tenant details updated' });
    } else {
      res.status(404).json({ message: 'Tenant not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error updating tenant details', error: err.message });
  }
});

// Fetch a tenant's payments and messages
app.get('/landlord/tenant-details', async (req, res) => {
  const { tenantID } = req.query;
  try {
    const payments = await Payment.find({ tenantID });
    const messages = await Message.find({ $or: [{ sender: tenantID }, { receiver: tenantID }] });
    res.status(200).json({ payments, messages });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving tenant details', error: err.message });
  }
});

// Update rent payment status for a tenant
app.put('/landlord/tenant/rent-status', async (req, res) => {
    const { tenantID } = req.body;
    
    try {
      // Find the tenant
      const tenant = await Tenant.findOne({ id: tenantID });
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }
      
      // Toggle the rentPaid status
      tenant.rentPaid = !tenant.rentPaid;
      await tenant.save();
  
      res.status(200).json({ message: 'Tenant rent status updated', tenant });
    } catch (err) {
      res.status(500).json({ message: 'Error updating tenant status', error: err.message });
    }
  });
  
  

// Process payment
app.post('/tenant/payment', async (req, res) => {
  const { tenantID, amount } = req.body;
  try {
    const tenant = await Tenant.findOne({ id: tenantID });
    if (tenant) {
      tenant.rentPaid = true;
      tenant.rentStart = new Date();
      tenant.rentEnd = new Date(Date.now() + 30*24*60*60*1000); // 30 days later
      await tenant.save();
      
      const newPayment = new Payment({ tenantID, amount });
      await newPayment.save();

      res.status(200).json({ message: 'Payment successful', rentEnd: tenant.rentEnd });
    } else {
      res.status(404).json({ message: 'Tenant not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error processing payment', error: err.message });
  }
});

// Get all apartments for admin
app.get('/landlord/apartments', async (req, res) => {
  try {
    const apartments = await Apartment.find().populate('tenants');
    res.status(200).json(apartments);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving apartments', error: err.message });
  }
});

// Update rent amount for an apartment
app.put('/landlord/update-rent', async (req, res) => {
  const { apartmentID, newRent } = req.body;
  try {
    const apartment = await Apartment.findOneAndUpdate({ apartmentID }, { rentAmount: newRent }, { new: true });
    if (apartment) {
      res.status(200).json({ message: 'Rent amount updated' });
    } else {
      res.status(404).json({ message: 'Apartment not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error updating rent amount', error: err.message });
  }
});

// Messaging between tenant and landlord
app.post('/messaging', async (req, res) => {
  const { sender, receiver, message } = req.body;
  try {
    const newMessage = new Message({ sender, receiver, message });
    await newMessage.save();
    res.status(200).json({ message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending message', error: err.message });
  }
});

// Get all messages for a tenant or landlord
app.get('/messages', async (req, res) => {
  const { user } = req.query;
  try {
    const userMessages = await Message.find({ $or: [{ sender: user }, { receiver: user }] });
    res.status(200).json(userMessages);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving messages', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
