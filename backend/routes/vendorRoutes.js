const express = require('express');
const router  = express.Router();
const Vendor  = require('../models/Vendor');

// ─── AI service for business card scanning ────────────────────────────────────
const { extractFromBusinessCard } = require('../services/aiService');

// GET all vendors
router.get('/', async (req, res) => {
  const vendors = await Vendor.find();
  res.json(vendors);
});

// POST create vendor
router.post('/', async (req, res) => {
  const vendor = new Vendor(req.body);
  try {
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update vendor
router.put('/:id', async (req, res) => {
  try {
    const updatedVendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedVendor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE vendor
router.delete('/:id', async (req, res) => {
  await Vendor.findByIdAndDelete(req.params.id);
  res.json({ message: 'Vendor Deleted' });
});

/**
 * POST /api/vendors/scan-card
 * Scans a business card image using AI (Gemini → Mistral → Tesseract fallback).
 * Returns extracted contact fields to pre-fill the vendor form.
 *
 * Body: { image: base64string, mimeType: 'image/jpeg' }
 */
router.post('/scan-card', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ message: 'Image is required.' });

    const result = await extractFromBusinessCard(image);
    res.json(result);
  } catch (err) {
    console.error('Business card scan error:', err.message);
    res.status(500).json({ message: 'Card scan failed.', error: err.message });
  }
});

module.exports = router;