const mongoose = require('mongoose');

const ShipmentSchema = new mongoose.Schema({
  // Link to order (optional — null for ad-hoc)
  orderId:          { type: mongoose.Schema.Types.ObjectId, ref: 'OrderInquiry', default: null },
  orderRef:         { type: String, default: '' },    // denormalised for display
  isAdhoc:          { type: Boolean, default: false },

  // Core shipment info
  shippedDate:      { type: Date, required: true },
  recipientName:    { type: String, required: true, trim: true },
  recipientAddress: { type: String, default: '' },
  city:             { type: String, default: '' },
  state:            { type: String, default: '' },
  phone:            { type: String, default: '' },

  // Courier info
  trackingId:       { type: String, default: '' },
  shippingPartner:  { type: String, default: '' },   // partner name (denormalised)

  // Status — updated by background service or manually
  status: {
    type: String,
    enum: ['Pending', 'Booked', 'In Transit', 'Out for Delivery', 'Delivered', 'Completed', 'Returned', 'Exception'],
    default: 'Pending',
  },
  lastTrackedAt:    { type: Date, default: null },
  trackingRaw:      { type: Object, default: null }, // raw API response for debugging

  notes:            { type: String, default: '' },
}, { timestamps: true });

// Index for efficient status refresh queries
ShipmentSchema.index({ status: 1 });
ShipmentSchema.index({ orderId: 1 });

module.exports = mongoose.models.Shipment || mongoose.model('Shipment', ShipmentSchema);