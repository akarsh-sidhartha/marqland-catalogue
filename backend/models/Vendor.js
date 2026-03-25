const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  state: { type: String, required: true },
  suppliedProducts: { type: String },
  category: { type: String }, // New Field Added
  description: String,
   gstNumber: { type: String, default: "" },
  contacts: [{
    name: String,
    phone: String,
    email: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);
/*
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
*/