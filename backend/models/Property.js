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
 * Day Package sub-document — multiple packages per Day Outing
 */
const dayPackageSchema = new mongoose.Schema({
  name:          { type: String, default: '' },
  activities:    { type: String, default: '' },
  purchasePrice: { type: Number, default: 0 },
  margin:        { type: Number, default: 15 },
  sellingPrice:  { type: Number, default: 0 },
}, { _id: true });

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
  
  singlePrice:          { type: Number, default: 0 },
  purchasePriceSingle:  { type: Number, default: 0 },
  marginSingle:         { type: Number, default: 15 },
  purchasePriceDouble:  { type: Number, default: 0 },
  marginDouble:         { type: Number, default: 15 },
  purchasePriceTriple:  { type: Number, default: 0 },
  marginTriple:         { type: Number, default: 15 },
  purchasePricePackage: { type: Number, default: 0 },
  marginPackage:        { type: Number, default: 15 },
  
  dayPackages: [dayPackageSchema],  // multi-package for Day Outing

  // Add-on costs
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