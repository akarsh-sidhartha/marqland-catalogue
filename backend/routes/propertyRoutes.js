const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ─── Upload directory helpers ─────────────────────────────────────────────────
// Property type from the schema enum: 'Day Outing' | 'Night Stay'
// Folder mapping:
//   Day Outing  → public/uploads/internalApp/property/day_outing/
//   Night Stay  → public/uploads/internalApp/property/night_stay/

const PROPERTY_TYPE_DIRS = {
  'Day Outing': 'day_outing',
  'Night Stay': 'night_stay',
};

function getPropertyDir(type) {
  const subfolder = PROPERTY_TYPE_DIRS[type] || 'day_outing';
  const dir = path.join(process.cwd(), 'public', 'uploads', 'internalApp', 'property', subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getPropertyUrl(type, filename) {
  const subfolder = PROPERTY_TYPE_DIRS[type] || 'day_outing';
  return `/uploads/internalApp/property/${subfolder}/${filename}`;
}

// ─── MULTER CONFIGURATION ─────────────────────────────────────────────────────
// Reads req.body.type (sent from frontend alongside the file) to route into
// the correct day_outing/ or night_stay/ subfolder.
const attachStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getPropertyDir(req.body.type);
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
// @body    type: 'Day Outing' | 'Night Stay'  (must be sent alongside file)
// @returns { url, name, mimeType, size }
router.post('/upload-attachment', uploadAttachment.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided.' });
    const propertyType = req.body.type || 'Day Outing';
    res.json({
      url:      getPropertyUrl(propertyType, req.file.filename),
      name:     req.file.originalname,
      mimeType: req.file.mimetype,
      size:     req.file.size,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;