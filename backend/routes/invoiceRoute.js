'use strict';
const express          = require('express');
const router           = express.Router();
const Invoice          = require('../models/Invoice');
const whatsappService  = require('../services/whatsappService');

const { extractFromDocument }              = require('../services/aiService');
const { scanMailboxesForAttachments }      = require('../services/msGraphService');
const { checkIfDuplicate, saveExtractedInvoice } = require('../utils/invoiceHelpers');

// ── Shared: extract → dedup → save ───────────────────────────────────────────
const handleAutomatedInvoice = async (base64Data, mimeType, source, metadata = {}) => {
  const extraction = await extractFromDocument(base64Data, mimeType);
  return saveExtractedInvoice(extraction, base64Data, mimeType, source, metadata);
};

// ── WhatsApp Webhook (GET) — Meta verification ────────────────────────────────
router.get('/whatsapp-webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode && token === process.env.WHATSAPP_TOKEN) res.status(200).send(challenge);
  else res.sendStatus(403);
});

// ── WhatsApp Webhook (POST) — incoming invoices ───────────────────────────────
router.post('/whatsapp-webhook', async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages) return res.sendStatus(200);

    const msg      = value.messages[0];
    const phoneId  = value.metadata?.phone_number_id;
    const display  = value.metadata?.display_phone_number;
    const from     = msg.from;
    const media    = msg.document || msg.image || null;

    if (media) {
      await whatsappService.sendReply(phoneId, from, '⏳ Reading your invoice...').catch(() => {});
      const mediaData = await whatsappService.downloadWhatsAppMedia(media.id);
      if (mediaData) {
        const result = await handleAutomatedInvoice(
          mediaData.base64, mediaData.mimeType, 'whatsapp',
          { notes: `WhatsApp Receiver: ${display} | From: ${from}` }
        );
        if (result.success) {
          await whatsappService.sendReply(phoneId, from,
            `✅ Invoice Saved!\n\n*Vendor:* ${result.data.vendor_name}\n*Inv No:* ${result.data.invoice_number}\n*Amount:* ₹${result.data.total_amount}`
          );
        } else if (result.reason === 'Duplicate') {
          await whatsappService.sendReply(phoneId, from,
            `⚠️ Duplicate: Invoice #${result.data.invoice_number} from ${result.data.vendor_name} is already in the vault.`
          );
        }
      }
    } else {
      await whatsappService.sendReply(phoneId, from,
        '👋 Please send an *Image* or *PDF* of the tax invoice.'
      ).catch(() => {});
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('WhatsApp Webhook Error:', err.message);
    res.sendStatus(200); // always 200 so Meta doesn't retry
  }
});

// ── Outlook sync ──────────────────────────────────────────────────────────────
const syncOutlookInvoices = async () => {
  try {
    console.log('🔍 Starting Outlook Sync...');
    const since       = new Date(Date.now() - 86400000).toISOString();
    const attachments = await scanMailboxesForAttachments(since);
    let count = 0;
    for (const att of attachments) {
      const r = await handleAutomatedInvoice(
        att.contentBytes, att.contentType, 'outlook',
        { notes: `User: ${att.userEmail} | From: ${att.fromEmail} | Subject: ${att.subject}` }
      );
      if (r.success) count++;
    }
    console.log(`✅ Outlook Sync complete — invoices saved: ${count}`);
    return { success: true, processed: count };
  } catch (err) {
    console.error('Outlook Sync Error:', err.message);
    return { success: false, error: err.message };
  }
};

router.post('/outlook-sync', async (req, res) => res.json(await syncOutlookInvoices()));

// ── AI extraction only (no save) — used by Invoice.js frontend page ───────────
router.post('/process', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    res.json(await extractFromDocument(base64, mimeType));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    res.json(await Invoice.find().sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const isDup = await checkIfDuplicate(req.body.vendor_gst, req.body.invoice_number);
    if (isDup) return res.status(400).json({ error: 'Invoice already exists in vault.' });
    const inv = new Invoice({ ...req.body, total_amount: Number(req.body.total_amount || 0), createdAt: new Date() });
    await inv.save();
    res.status(201).json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, syncOutlookInvoices };