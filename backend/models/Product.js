const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  category: { type: String, required: true },
  subCategory: { type: String, required: false },
  name: { type: String, required: true },
  description: String,
  purchasePrice: { type: Number, required: true },
  markupPercent: { type: Number, default: 10 },
  imageUrl: String,
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);