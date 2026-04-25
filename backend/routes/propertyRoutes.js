const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── File upload for property attachments ──────────────────────────────────────
const attachStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'public/uploads/property-attachments');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const uploadAttachment = multer({
  storage: attachStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});


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

// @route   POST /api/properties/upload-attachment
// @desc    Upload a single property attachment (PDF, image, doc)
// @returns { url, name, mimeType, size }
router.post('/upload-attachment', uploadAttachment.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided.' });
    res.json({
      url:      `/uploads/property-attachments/${req.file.filename}`,
      name:     req.file.originalname,
      mimeType: req.file.mimetype,
      size:     req.file.size,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;