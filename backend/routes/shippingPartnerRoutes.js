'use strict';
/**
 * backend/routes/shippingPartnerRoutes.js
 * Mounted at /api/shipping-partners
 */
const express = require('express');
const router  = express.Router();
const ShippingPartner = require('../models/ShippingPartner');

// GET all
router.get('/', async (req, res) => {
  try {
    const partners = await ShippingPartner.find().sort({ name: 1 });
    res.json(partners);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const p = new ShippingPartner(req.body);
    await p.save();
    res.status(201).json(p);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const p = await ShippingPartner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await ShippingPartner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;