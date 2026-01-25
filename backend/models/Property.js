/*
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String },
  email: { type: String }
});

const propertySchema = new mongoose.Schema({
  propertyName: { type: String, required: true },
  state: { type: String, required: true },
  place: { type: String },
  website: { type: String },
  imageUrl: { type: String },
  type: { 
    type: String, 
    enum: ['Day Outing', 'Night Stay'], 
    default: 'Day Outing' 
  },
  totalInventory: { type: Number, default: 0 },
  doublePrice: { type: Number, default: 0 },
  triplePrice: { type: Number, default: 0 },
  details: { type: String },
  contacts: [contactSchema]
}, { timestamps: true });

module.exports = mongoose.model('Property', propertySchema);
*/

const mongoose = require('mongoose');

/**
 * Contact Schema
 * Sub-document for property contact persons
 */
const contactSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String },
  email: { type: String }
});

/**
 * Property Schema
 * Defines the structure for property listings including pricing for 
 * additional services like DJ, Snacks, and Banquet Hall.
 */
const propertySchema = new mongoose.Schema({
  propertyName: { type: String, required: true },
  state: { type: String, required: true },
  place: { type: String },
  website: { type: String },
  imageUrl: { type: String },
  type: { 
    type: String, 
    enum: ['Day Outing', 'Night Stay'], 
    default: 'Day Outing' 
  },
  totalInventory: { type: Number, default: 0 },
  doublePrice: { type: Number, default: 0 },
  triplePrice: { type: Number, default: 0 },
  
  // New fields to handle the missing data
  djCost: { type: Number, default: 0 },
  licenseFeeDJ: { type: Number, default: 0 },
  cocktailSnacks: { type: Number, default: 0 },
  banquetHall: { type: Number, default: 0 },

  details: { type: String },
  contacts: [contactSchema]
}, { 
  timestamps: true // Automatically creates createdAt and updatedAt fields
});

module.exports = mongoose.model('Property', propertySchema);