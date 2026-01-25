const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  // Changed from 'name' to 'companyName' to match frontend
  companyName: { type: String, required: true },
  state: { type: String, required: true },
  // Added the new field for products
  suppliedProducts: { type: String },
  // Kept existing description in case you use it elsewhere
  description: String,
  contacts: [{
    name: String,
    phone: String,
    email: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);