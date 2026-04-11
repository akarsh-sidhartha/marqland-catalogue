'use strict';
/**
 * backend/models/ClientPortal.js
 *
 * One document per order. Stores the curated items the team wants to show
 * the client, plus the two-way chat thread.
 *
 * slug    = URL-safe version of refNumber  e.g. "inq-25-26-002"
 * type    = "product" | "offsite"
 * status  = "active" | "completed"
 */

const mongoose = require('mongoose');

// ── File attachment in a message ─────────────────────────────────────────────
const msgAttachmentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  url:         { type: String, required: true }, // /uploads/... path
  mimeType:    { type: String, default: 'application/octet-stream' },
  size:        { type: Number, default: 0 },
}, { _id: false });

// ── Chat message ──────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
  sender:      { type: String, enum: ['team', 'client'], required: true },
  senderName:  { type: String, default: 'Team' },
  text:        { type: String, default: '' },
  attachments: [msgAttachmentSchema],
  createdAt:   { type: Date, default: Date.now },
}, { _id: true });

// ── Product item (gifting/merchandise) ────────────────────────────────────────
const productItemSchema = new mongoose.Schema({
  productId:   { type: String },              // ref to products collection (optional)
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  imageUrl:    { type: String, default: '' },
  videoUrl:    { type: String, default: '' }, // optional video
  price:       { type: Number, default: 0 },
  category:    { type: String, default: '' },
  subCategory: { type: String, default: '' },
  note:        { type: String, default: '' }, // team note shown under item
  order:       { type: Number, default: 0 },  // display order
}, { _id: true });

// ── Offsite item (property) ────────────────────────────────────────────────────
// Day package inside an offsite portal item
const portalDayPkgSchema = new mongoose.Schema({
  name:         { type: String, default: '' },
  activities:   { type: String, default: '' },
  sellingPrice: { type: Number, default: 0 },
}, { _id: false });

const offsiteItemSchema = new mongoose.Schema({
  propertyId:      { type: String },
  name:            { type: String, required: true },
  location:        { type: String, default: '' },   // "Lonavala, Maharashtra"
  imageUrl:        { type: String, default: '' },
  website:         { type: String, default: '' },
  details:         { type: String, default: '' },
  type:            { type: String, default: 'Night Stay' }, // Night Stay | Day Outing
  singlePrice:     { type: Number, default: 0 },
  doublePrice:     { type: Number, default: 0 },
  triplePrice:     { type: Number, default: 0 },
  packagePrice:    { type: Number, default: 0 },   // day outing
  djCost:          { type: Number, default: 0 },
  licenseFeeDJ:    { type: Number, default: 0 },
  cocktailSnacks:  { type: Number, default: 0 },
  banquetHall:     { type: Number, default: 0 },
  dayPackages:     [portalDayPkgSchema],
  note:            { type: String, default: '' },
  order:           { type: Number, default: 0 },
}, { _id: true });

// ── Main portal schema ────────────────────────────────────────────────────────
const clientPortalSchema = new mongoose.Schema({
  orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'OrderInquiry', required: true },
  slug:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  type:         { type: String, enum: ['product', 'offsite'], required: true },
  orderRef:     { type: String },   // e.g. "INQ-25-26-002" — display only
  clientName:   { type: String },
  orderPlacedBy:{ type: String },   // contact person — shown as chat name on client side
  clientEmail:  { type: String },
  title:        { type: String },   // order title shown at top of client view
  teamNote:     { type: String, default: '' }, // intro note from team to client

  productItems: [productItemSchema],
  offsiteItems: [offsiteItemSchema],

  messages:     [messageSchema],

  status:       { type: String, enum: ['active', 'completed'], default: 'active' },
  completedAt:  { type: Date },

  // Tracking
  lastViewedAt:    { type: Date },  // when client last opened the page
  viewCount:       { type: Number, default: 0 },

  // Google review / feedback link shown on completion screen
  reviewLink:   { type: String, default: '' },
}, {
  timestamps: true,
});


module.exports = mongoose.model('ClientPortal', clientPortalSchema);