const express = require('express');
const router = express.Router();
const OrderInquiry = require('../models/orderInquiry');

// GET all orders
router.get('/', async (req, res) => {
  try {
    const orders = await OrderInquiry.find().sort({ updatedAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new inquiry
router.post('/', async (req, res) => {
  try {
    const newOrder = new OrderInquiry(req.body);
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update status or details
router.patch('/:id', async (req, res) => {
  try {
    const updated = await OrderInquiry.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: Date.now() }, 
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE inquiry
router.delete('/:id', async (req, res) => {
  try {
    await OrderInquiry.findByIdAndDelete(req.params.id);
    res.json({ message: "Order removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;