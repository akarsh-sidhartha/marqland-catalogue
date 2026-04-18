/**
 * backend/models/PublicInquiry.js
 * Contact/inquiry form submissions from www.marqland.com
 * Separate from the internal OrderInquiry model.
 */

const mongoose = require('mongoose');

const publicInquirySchema = new mongoose.Schema({
  name:    { type: String, required: true },
  company: { type: String, default: '' },
  email:   { type: String, required: true },
  phone:   { type: String, default: '' },
  message: { type: String, default: '' },
  read:    { type: Boolean, default: false },  // admin can mark as read
}, {
  timestamps: true,
});

module.exports = mongoose.model('PublicInquiry', publicInquirySchema);