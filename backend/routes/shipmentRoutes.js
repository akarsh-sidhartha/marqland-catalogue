'use strict';
/**
 * backend/routes/shipmentRoutes.js
 * Mounted at /api/shipments
 */
const express  = require('express');
const router   = express.Router();
const Shipment = require('../models/Shipment');
const { authenticate } = require('../middleware/authMiddleware');

// All shipment routes require a valid token — belt-and-suspenders on top of routeGuard
router.use(authenticate);

// GET all shipments
// - Vendors (role === 'courier') only see their own shipments
// - Marqland staff see all, with optional ?orderId filter
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.orderId) filter.orderId = req.query.orderId;

    // Vendors only see their own rows
    if (req.user?.role === 'courier') {
      filter.vendorId = req.user.id;
    }

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
// Stamps vendorId + vendorName from auth token when submitted by a courier
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };

    // Stamp vendor identity from token (couriers only — Marqland staff leave blank)
    if (req.user?.role === 'courier') {
      body.vendorId   = req.user.id;
      body.vendorName = req.user.name || req.user.email;
    }

    // Coerce empty orderId string to null so ObjectId cast doesn't fail
    if (body.orderId === '' || body.orderId === undefined) body.orderId = null;

    const s = new Shipment(body);
    await s.save();
    res.status(201).json(s);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST bulk create (from Excel import)
// Also stamps vendorId + vendorName and cleans orderId
router.post('/bulk', async (req, res) => {
  try {
    const { shipments } = req.body;
    if (!Array.isArray(shipments) || shipments.length === 0)
      return res.status(400).json({ message: 'shipments array required' });

    const cleaned = shipments.map(s => ({
      ...s,
      orderId: s.orderId || null,
      ...(req.user?.role === 'courier' ? {
        vendorId:   req.user.id,
        vendorName: req.user.name || req.user.email,
      } : {}),
    }));

    const created = await Shipment.insertMany(cleaned);
    res.status(201).json({ count: created.length, shipments: created });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PUT update shipment
router.put('/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.orderId === '' || body.orderId === undefined) body.orderId = null;

    const s = await Shipment.findByIdAndUpdate(req.params.id, body, { new: true });
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