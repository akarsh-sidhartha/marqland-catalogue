'use strict';
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Vendor  = require('../models/Vendor');
const { extractFromBusinessCard } = require('../services/aiService');

// ── Multer: store vendor media in public/uploads/internalApp/vendors/ ─────────
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'internalApp', 'vendors');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB — supports large video recordings
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg', 'video/3gpp',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type not supported: ${file.mimetype}`));
  },
});

// ── GET all vendors ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ companyName: 1 });
    res.json(vendors);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST create vendor ────────────────────────────────────────────────────────
router.post('/', upload.array('mediaFiles', 20), async (req, res) => {
  try {
    const { companyName, state, category, suppliedProducts, description, gstNumber } = req.body;
    if (!companyName?.trim()) return res.status(400).json({ message: 'Company name is required' });

    // Parse contacts (sent as JSON string from FormData)
    let contacts = [];
    try { contacts = req.body.contacts ? JSON.parse(req.body.contacts) : []; } catch {}

    const media = (req.files || []).map(f => ({
      name:     f.originalname,
      url:      `/uploads/internalApp/vendors/${f.filename}`,
      mimeType: f.mimetype,
      size:     f.size,
      label:    '',
    }));

    const vendor = await Vendor.create({
      companyName: companyName.trim(),
      state, category, suppliedProducts, description, gstNumber,
      contacts, media,
    });
    res.status(201).json(vendor);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── PUT update vendor ─────────────────────────────────────────────────────────
// Accepts new files via multipart AND a keepMediaIds list (comma-separated _ids
// of existing media to retain — any not in the list are deleted from disk + DB)
router.put('/:id', upload.array('mediaFiles', 20), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const { companyName, state, category, suppliedProducts, description, gstNumber, keepMediaIds } = req.body;

    // Determine which existing media to keep
    const keepIds = keepMediaIds
      ? keepMediaIds.split(',').map(s => s.trim()).filter(Boolean)
      : vendor.media.map(m => m._id.toString()); // keep all if not specified

    // Delete removed files from disk
    vendor.media.forEach(m => {
      if (!keepIds.includes(m._id.toString())) {
        const fp = path.join(process.cwd(), 'public', m.url);
        try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
      }
    });

    // Build retained media list
    const retainedMedia = vendor.media.filter(m => keepIds.includes(m._id.toString()));

    // Add newly uploaded files
    const newMedia = (req.files || []).map(f => ({
      name:     f.originalname,
      url:      `/uploads/internalApp/vendors/${f.filename}`,
      mimeType: f.mimetype,
      size:     f.size,
      label:    '',
    }));

    // Parse contacts
    let contacts = vendor.contacts;
    try {
      if (req.body.contacts) contacts = JSON.parse(req.body.contacts);
    } catch {}

    const updated = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        companyName: companyName?.trim() || vendor.companyName,
        state:       state       ?? vendor.state,
        category:    category    ?? vendor.category,
        suppliedProducts: suppliedProducts ?? vendor.suppliedProducts,
        description: description ?? vendor.description,
        gstNumber:   gstNumber   ?? vendor.gstNumber,
        contacts,
        media: [...retainedMedia, ...newMedia],
      },
      { new: true }
    );
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── DELETE single media file from a vendor ────────────────────────────────────
router.delete('/:id/media/:mediaId', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const media = vendor.media.id(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Media not found' });

    // Delete from disk
    const fp = path.join(process.cwd(), 'public', media.url);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}

    media.deleteOne();
    await vendor.save();
    res.json({ message: 'Media deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE vendor ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    // Clean up all media files
    (vendor.media || []).forEach(m => {
      const fp = path.join(process.cwd(), 'public', m.url);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
    });
    await Vendor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vendor deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST scan business card ───────────────────────────────────────────────────
router.post('/scan-card', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ message: 'Image is required.' });
    const result = await extractFromBusinessCard(image);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Card scan failed.', error: err.message });
  }
});

module.exports = router;