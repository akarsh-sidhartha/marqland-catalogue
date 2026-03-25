const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');
// Assume you have a helper for WhatsApp Cloud API
const { sendWhatsAppMessage } = require('../services/whatsappService');

// 1. Create Inquiry & Send WhatsApp
router.post('/', async (req, res) => {
  try {
    const inquiry = new Inquiry(req.body);
    const savedInquiry = await inquiry.save();

    // The URL for the vendor to respond
    // Replace with your actual frontend domain
    const publicLink = `http://192.168.1.10:3000/respond/${savedInquiry._id}`;

    // Check if there are vendors to notify
    if (savedInquiry.targetVendors && savedInquiry.targetVendors.length > 0) {
      for (const vendor of savedInquiry.targetVendors) {
        // 1. Clean the phone number (remove +, spaces, dashes)
        const cleanPhone = vendor.phone.replace(/\D/g, '');

        const message = `*New Inquiry from Marqland Studios*\n\n` +
          `*Description:* ${savedInquiry.publicDescription}\n` +
          `*Quantity:* ${savedInquiry.quantity}\n\n` +
          `Please click the link below to submit your quote:\n${publicLink}`;

        // 2. Call the service
        console.log(`Attempting to send WhatsApp to: ${cleanPhone}`);
        await sendWhatsAppMessage(cleanPhone, message);
        
        // 2. If there are attachments (URLs), send them as follow-up messages
        if (inquiry.attachments && inquiry.attachments.length > 0) {
          for (const fileUrl of inquiry.attachments) {
            await sendWhatsAppMedia(cleanPhone, fileUrl, "Reference File");
          }
        }
      }
    }

    res.status(201).json(savedInquiry);
  } catch (err) {
    console.error("Inquiry Creation Error:", err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Inquiry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Inquiry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/broadcast', async (req, res) => {
  // logic to send WhatsApp messages to req.body.targetVendors
  res.json({ success: true });
});

// 2. Public Route: Get details for vendor link
router.get('/public/:id', async (req, res) => {
  const inq = await Inquiry.findById(req.params.id).select('-internalNotes -clientName');
  res.json(inq);
});

// 3. Public Route: Submit Response
router.post('/public/:id/respond', async (req, res) => {
  const inq = await Inquiry.findById(req.params.id);
  inq.responses.push(req.body);
  await inq.save();
  res.json({ success: true });
});

// 4. Admin Dashboard Routes
router.get('/', async (req, res) => {
  const inqs = await Inquiry.find().sort({ createdAt: -1 });
  res.json(inqs);
});

// PUBLIC: Get inquiry for vendor link
router.get('/public/:id', async (req, res) => {
  try {
    const inq = await Inquiry.findById(req.params.id);

    // Check if inquiry exists and is NOT archived
    if (!inq || inq.status === 'archived') {
      return res.status(403).json({
        message: "This inquiry has been closed or archived by Marqland Studios."
      });
    }

    // Send only necessary fields to vendor
    res.json({
      publicDescription: inq.publicDescription,
      quantity: inq.quantity,
      deadline: inq.deadline,
      attachments: inq.attachments,
      status: inq.status
    });
  } catch (err) {
    res.status(404).json({ message: "Invalid Link" });
  }
});

router.put('/:id/archive', async (req, res) => {
  await Inquiry.findByIdAndUpdate(req.params.id, { status: 'archived' });
  res.json({ message: 'Archived' });
});

module.exports = router;