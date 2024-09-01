const mongoose = require('mongoose');

// Directly use the MongoDB URI in the connection string
const mongoURI = "mongodb+srv://apartment:apartment@apartment.atzv3.mongodb.net/apartment";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
