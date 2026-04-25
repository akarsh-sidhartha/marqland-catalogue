'use strict';
const mongoose = require('mongoose');

/**
 * Contact Schema
 */
const contactSchema = new mongoose.Schema({
  name:  { type: String },
  phone: { type: String },
  email: { type: String },
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
 * Adhoc Add-on — dynamic extras beyond the 4 standard add-ons
 * sellingPrice is auto-calculated from purchasePrice + addonMargin (property-level)
 */
const adhocAddonSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  purchasePrice: { type: Number, default: 0 },
  sellingPrice:  { type: Number, default: 0 }, // computed: purchasePrice * (1 + addonMargin/100)
}, { _id: true });

/**
 * Property attachment (PDF, image, doc — shared with client portal)
 */
const propertyAttachmentSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  url:      { type: String, required: true }, // /uploads/... path
  mimeType: { type: String, default: 'application/octet-stream' },
  size:     { type: Number, default: 0 },
}, { _id: false });

/**
 * Property Schema
 */
const propertySchema = new mongoose.Schema({
  propertyName: { type: String, required: true },
  state:        { type: String, required: true },
  place:        { type: String },
  website:      { type: String },
  imageUrl:     { type: String },

  // YouTube video URL — embedded in client portal
  youtubeUrl:   { type: String, default: '' },

  type: {
    type:    String,
    enum:    ['Day Outing', 'Night Stay'],
    default: 'Day Outing',
  },

  totalInventory: { type: Number, default: 0 },

  // ── Night Stay room pricing ─────────────────────────────────────────────────
  singlePrice:          { type: Number, default: 0 },
  purchasePriceSingle:  { type: Number, default: 0 },
  marginSingle:         { type: Number, default: 15 },

  doublePrice:          { type: Number, default: 0 },
  purchasePriceDouble:  { type: Number, default: 0 },
  marginDouble:         { type: Number, default: 15 },

  triplePrice:          { type: Number, default: 0 },
  purchasePriceTriple:  { type: Number, default: 0 },
  marginTriple:         { type: Number, default: 15 },

  // NEW — Quad occupancy (Night Stay)
  quadPrice:            { type: Number, default: 0 },
  purchasePriceQuad:    { type: Number, default: 0 },
  marginQuad:           { type: Number, default: 15 },

  // ── Day Outing flat package pricing ────────────────────────────────────────
  packagePrice:         { type: Number, default: 0 },
  purchasePricePackage: { type: Number, default: 0 },
  marginPackage:        { type: Number, default: 15 },

  dayPackages: [dayPackageSchema], // multi-package for Day Outing

  // ── Shared add-on margin (applies to all 4 standard + all adhoc add-ons) ───
  addonMargin: { type: Number, default: 15 },

  // Standard add-ons (purchase prices stored; selling = purchase * (1 + addonMargin/100))
  purchaseDJ:             { type: Number, default: 0 },
  djCost:                 { type: Number, default: 0 }, // selling price

  purchaseLicenseFeeDJ:   { type: Number, default: 0 },
  licenseFeeDJ:           { type: Number, default: 0 }, // selling price

  purchaseCocktailSnacks: { type: Number, default: 0 },
  cocktailSnacks:         { type: Number, default: 0 }, // selling price

  purchaseBanquetHall:    { type: Number, default: 0 },
  banquetHall:            { type: Number, default: 0 }, // selling price

  // Adhoc add-ons — unlimited extras
  adhocAddons: [adhocAddonSchema],

  // Property-level attachments (itinerary PDFs, brochures, etc.)
  attachments: [propertyAttachmentSchema],

  details:  { type: String },
  contacts: [contactSchema],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Property', propertySchema);