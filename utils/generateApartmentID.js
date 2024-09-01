const crypto = require('crypto');

const generateApartmentID = () => {
    // Generate a unique ID using a combination of random letters and numbers
    return crypto.randomBytes(3).toString('hex').toUpperCase();
};

module.exports = generateApartmentID;
