const express = require('express');
const router = express.Router();
const Catalogue = require('../models/catalogue');

// Save a new catalogue or update existing
router.post('/', async (req, res) => {
  try {
    const { name, subtitle, items, id } = req.body;
    if (id && id !== 'undefined') {
      // Added subtitle to update
      const updated = await Catalogue.findByIdAndUpdate(id, { name, subtitle, items }, { new: true });
      return res.json(updated);
    }
    // Added subtitle to new save
    const catalogue = new Catalogue({ name, subtitle, items });
    await catalogue.save();
    res.status(201).json(catalogue);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all saved catalogues
router.get('/', async (req, res) => {
  try {
    const catalogues = await Catalogue.find().sort({ createdAt: -1 });
    res.json(catalogues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a catalogue
router.delete('/:id', async (req, res) => {
  try {
    await Catalogue.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;