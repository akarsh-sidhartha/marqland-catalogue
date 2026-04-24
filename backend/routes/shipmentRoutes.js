'use strict';
/**
 * backend/routes/shipmentRoutes.js
 * Mounted at /api/shipments
 */
const express  = require('express');
const router   = express.Router();
const Shipment = require('../models/Shipment');

// GET all shipments — supports ?orderId=xxx to filter by linked order
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.orderId) filter.orderId = req.query.orderId;
    const shipments = await Shipment.find(filter).sort({ createdAt: -1 }).lean();
    res.json(shipments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET single shipment
router.get('/:id', async (req, res) => {
  try {
    const s = await Shipment.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Not found' });
    res.json(s);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST create single shipment
router.post('/', async (req, res) => {
  try {
    const s = new Shipment(req.body);
    await s.save();
    res.status(201).json(s);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST bulk create (from Excel import)
router.post('/bulk', async (req, res) => {
  try {
    const { shipments } = req.body;
    if (!Array.isArray(shipments) || shipments.length === 0)
      return res.status(400).json({ message: 'shipments array required' });
    const created = await Shipment.insertMany(shipments);
    res.status(201).json({ count: created.length, shipments: created });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PUT update shipment
router.put('/:id', async (req, res) => {
  try {
    const s = await Shipment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!s) return res.status(404).json({ message: 'Not found' });
    res.json(s);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE shipment
router.delete('/:id', async (req, res) => {
  try {
    await Shipment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/shipments/refresh-status
// Manually trigger status refresh for all active shipments
router.post('/refresh-status', async (req, res) => {
  try {
    const { refreshShipmentStatuses } = require('../services/shipmentTrackingService');
    const result = await refreshShipmentStatuses();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;