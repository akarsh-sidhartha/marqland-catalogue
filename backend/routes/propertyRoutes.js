const express = require('express');
const router = express.Router();
const Property = require('../models/Property');


// @route   GET /api/properties
// @desc    Get all properties
router.get('/', async (req, res) => {
  try {
    const properties = await Property.find().sort({ propertyName: 1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/properties
// @desc    Create a property
router.post('/', async (req, res) => {
  const property = new Property(req.body);
  try {
    const newProperty = await property.save();
    res.status(201).json(newProperty);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   PUT /api/properties/:id
// @desc    Update a property
router.put('/:id', async (req, res) => {
  try {
    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    res.json(updatedProperty);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   DELETE /api/properties/:id
// @desc    Delete a property
router.delete('/:id', async (req, res) => {
  try {
    await Property.findByIdAndDelete(req.params.id);
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;