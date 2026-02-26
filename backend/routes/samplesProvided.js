const express = require('express');
const router = express.Router();
const Challan = require('../models/samplesprovided');

// GET all challans
router.get('/', async (req, res) => {
  try {
    const challans = await Challan.find().sort({ createdAt: -1 });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new challan
router.post('/', async (req, res) => {
  try {
    // Sanitize: ensure dcAttachments is an array
    const data = {
      ...req.body,
      dcAttachments: Array.isArray(req.body.dcAttachments) ? req.body.dcAttachments : []
    };
    const newChallan = new Challan(data);
    const saved = await newChallan.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Save Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// PUT update challan
router.put('/:id', async (req, res) => {
  try {
    const data = {
      ...req.body,
      dcAttachments: Array.isArray(req.body.dcAttachments) ? req.body.dcAttachments : []
    };
    const updated = await Challan.findByIdAndUpdate(
      req.params.id, 
      data, 
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
