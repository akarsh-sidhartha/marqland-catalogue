'use strict';
const express  = require('express');
const router   = express.Router();
const Inquiry  = require('../models/Inquiry');
const { sendWhatsAppMessage } = require('../services/whatsappService');

// ── POST create inquiry + notify vendors via WhatsApp ─────────────────────────
router.post('/', async (req, res) => {
  try {
    const inquiry      = new Inquiry(req.body);
    const savedInquiry = await inquiry.save();

    // Public link uses APP_URL from .env — no hardcoded IPs
    const appUrl     = process.env.APP_URL || 'http://localhost:3000';
    const publicLink = `${appUrl}/respond/${savedInquiry._id}`;

    if (savedInquiry.targetVendors?.length > 0) {
      for (const vendor of savedInquiry.targetVendors) {
        const cleanPhone = vendor.phone.replace(/\D/g, '');
        const message =
          `*New Inquiry from Marqland Studios*\n\n` +
          `*Description:* ${savedInquiry.publicDescription}\n` +
          `*Quantity:* ${savedInquiry.quantity}\n\n` +
          `Submit your quote here:\n${publicLink}`;

        await sendWhatsAppMessage(cleanPhone, message).catch((err) =>
          console.error(`WhatsApp failed for ${cleanPhone}:`, err.message)
        );
      }
    }

    res.status(201).json(savedInquiry);
  } catch (err) {
    console.error('Inquiry creation error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// ── GET all inquiries (admin dashboard) ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    res.json(await Inquiry.find().sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE inquiry ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await Inquiry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Inquiry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST broadcast ────────────────────────────────────────────────────────────
router.post('/broadcast', async (req, res) => {
  // Broadcast logic via WhatsApp — extend as needed
  res.json({ success: true });
});

// ── PUT general status update (used by SourcingHub: live ↔ archived) ─────────
router.put('/:id', async (req, res) => {
  try {
    const updated = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Inquiry not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT archive shorthand ─────────────────────────────────────────────────────
router.put('/:id/archive', async (req, res) => {
  try {
    await Inquiry.findByIdAndUpdate(req.params.id, { status: 'archived' });
    res.json({ message: 'Archived' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUBLIC: vendor view (no auth) ─────────────────────────────────────────────
router.get('/public/:id', async (req, res) => {
  try {
    const inq = await Inquiry.findById(req.params.id);
    if (!inq || inq.status === 'archived') {
      return res.status(403).json({ message: 'This inquiry has been closed.' });
    }
    res.json({
      publicDescription: inq.publicDescription,
      quantity:          inq.quantity,
      deadline:          inq.deadline,
      attachments:       inq.attachments,
      status:            inq.status,
    });
  } catch (err) {
    res.status(404).json({ message: 'Invalid link' });
  }
});

// ── PUBLIC: vendor submits response ──────────────────────────────────────────
router.post('/public/:id/respond', async (req, res) => {
  try {
    const inq = await Inquiry.findById(req.params.id);
    if (!inq) return res.status(404).json({ message: 'Inquiry not found' });
    inq.responses.push(req.body);
    await inq.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;