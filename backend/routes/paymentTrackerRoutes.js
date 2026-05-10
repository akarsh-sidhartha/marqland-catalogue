'use strict';
/**
 * paymentTrackerRoutes.js
 * Unified Payment Tracker: PI, Payments, Invoice Vault, WhatsApp/Outlook ingestion.
 */

const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');

const { ProformaInvoice, Payment, VendorInvoice } = require('../models/paymentTrackerModel');
const Invoice = require('../models/Invoice');
const Vendor  = require('../models/Vendor');

// ─── Shared services ──────────────────────────────────────────────────────────
let whatsappService;
try { whatsappService = require('../services/whatsappService'); } catch { whatsappService = null; }

const { extractFromDocument, checkAIStatus }                           = require('../services/aiService');
const { scanMailboxesForAttachments, uploadSingleFile }                  = require('../services/msGraphService');
const { normalizeFY, fyFromDate, checkIfDuplicate, saveExtractedInvoice } = require('../utils/invoiceHelpers');

// ── Process + save invoice — shared by WhatsApp, Outlook, manual ──────────────
const handleAutomatedInvoice = async (base64Data, mimeType, source, metadata = {}) => {
  const extraction = await extractFromDocument(base64Data, mimeType);

  // Auto-save GSTIN to vendor record if not already set
  if (extraction.vendor_gst && extraction.vendor_name) {
    const vendor = await Vendor.findOne({ companyName: new RegExp(extraction.vendor_name, 'i') });
    if (vendor && !vendor.gstNumber) {
      vendor.gstNumber = extraction.vendor_gst;
      await vendor.save().catch(() => {});
    }
  }

  return saveExtractedInvoice(extraction, base64Data, mimeType, source, metadata);
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE VAULT
// ═══════════════════════════════════════════════════════════════════════════════

// AI status check (Gemini → Mistral → Tesseract)
router.get('/gemini-status', async (req, res) => {
  try { res.json(await checkAIStatus()); }
  catch (err) { res.json({ available: false, reason: err.message }); }
});

// AI extraction only — no save (used by upload modals)
router.post('/invoices/process', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    res.json(await extractFromDocument(base64, mimeType));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List vault invoices — paginated by FY and month for fast loading.
// Loads current FY + current month first, then older months on demand.
// ?fy=2025-26&month=May&page=1&limit=50
router.get('/invoices', async (req, res) => {
  try {
    const { fy, month, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (fy)    filter.financialYear = fy;
    if (month) filter.month         = month;

    const [invoices, total, allFYs] = await Promise.all([
      Invoice.find(filter)
        .select('-image')                          // never return base64 to frontend
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Invoice.countDocuments(filter),
      // Return distinct FY list so frontend can build the month picker
      Invoice.distinct('financialYear'),
    ]);

    res.json({ invoices, total, page: Number(page), limit: Number(limit), financialYears: allFYs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single invoice including OneDrive URL (for view/download button)
router.get('/invoices/:id', async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id).select('-image').lean();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Manually save invoice to vault
router.post('/invoices', async (req, res) => {
  try {
    const isDup = await checkIfDuplicate(req.body.vendor_gst, req.body.invoice_number);
    if (isDup) return res.status(409).json({
      duplicate: true, error: 'Invoice already exists in vault.',
      invoice_number: req.body.invoice_number, vendor_name: req.body.vendor_name,
    });

    // Auto-save GSTIN to vendor record
    if (req.body.vendor_gst && req.body.vendor_name) {
      const vendor = await Vendor.findOne({ companyName: new RegExp(req.body.vendor_name, 'i') });
      if (vendor && !vendor.gstNumber) { vendor.gstNumber = req.body.vendor_gst; await vendor.save().catch(() => {}); }
    }

    const d = req.body.date ? new Date(req.body.date) : new Date();
    const { fy, month } = fyFromDate(d);

    // Upload invoice file to OneDrive before saving to MongoDB
    let oneDriveFileId = '', oneDriveUrl = '', fileName = '';
    if (req.body.image) {
      try {
        const { buildInvoiceFilename } = require('../utils/invoiceHelpers');
        fileName = buildInvoiceFilename(req.body.vendor_name, req.body.invoice_number, req.body.mimeType);
        const upload = await uploadSingleFile(
          ['Invoices', normalizeFY(req.body.financialYear) || fy, req.body.month || month],
          fileName, req.body.image, req.body.mimeType || 'image/jpeg'
        );
        oneDriveFileId = upload.fileId;
        oneDriveUrl    = upload.webUrl;
      } catch (e) { console.error('[Invoice] OneDrive upload failed:', e.message); }
    }

    const inv = new Invoice({
      ...req.body,
      total_amount:   Number(req.body.total_amount || 0),
      financialYear:  normalizeFY(req.body.financialYear) || fy,
      month:          req.body.month || month,
      oneDriveFileId,
      oneDriveUrl,
      fileName,
      createdAt:      new Date(),
      image:          undefined,  // never store base64 in MongoDB
    });
    await inv.save();

    // Auto-link to open PI for this vendor
    const linkedPiId = req.body.linkedPi || null;
    let piToLink = null;
    if (linkedPiId) {
      piToLink = await ProformaInvoice.findById(linkedPiId);
    } else if (req.body.vendor_name) {
      const vendor = await Vendor.findOne({ companyName: new RegExp(req.body.vendor_name.trim(), 'i') });
      if (vendor) {
        piToLink = await ProformaInvoice.findOne({
          vendor: vendor._id, status: { $in: ['pending', 'partial', 'fully_paid'] }, finalInvoice: null,
        }).sort({ createdAt: -1 });
      }
    }
    if (piToLink) {
      piToLink.finalInvoice = inv._id;
      if (piToLink.status === 'fully_paid') piToLink.status = 'invoiced';
      await piToLink.save();
      await Payment.updateMany({ proformaInvoice: piToLink._id }, { $set: { vendorInvoice: inv._id } });
    }

    res.status(201).json({ ...inv.toObject(), _linkedPi: piToLink?._id || null });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete invoice from vault
router.delete('/invoices/:id', async (req, res) => {
  try { await Invoice.findByIdAndDelete(req.params.id); res.json({ message: 'Invoice deleted' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/whatsapp-webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode && token === process.env.WHATSAPP_TOKEN) res.status(200).send(challenge);
  else res.sendStatus(403);
});

router.post('/whatsapp-webhook', async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages) return res.sendStatus(200);
    const msg     = value.messages[0];
    const phoneId = value.metadata?.phone_number_id;
    const from    = msg.from;
    const media   = msg.document || msg.image || null;

    if (media && whatsappService) {
      await whatsappService.sendReply(phoneId, from, '⏳ Reading invoice...').catch(() => {});
      const mediaData = await whatsappService.downloadWhatsAppMedia(media.id);
      if (mediaData) {
        const result = await handleAutomatedInvoice(mediaData.base64, mediaData.mimeType, 'whatsapp', { notes: `WhatsApp from: ${from}` });
        const reply  = result.success
          ? `✅ Invoice Saved!\n*Vendor:* ${result.data.vendor_name}\n*Inv:* ${result.data.invoice_number}\n*Amount:* ₹${result.data.total_amount}`
          : `⚠️ Duplicate: Invoice #${result.data.invoice_number} already in vault.`;
        await whatsappService.sendReply(phoneId, from, reply).catch(() => {});
      }
    } else if (whatsappService) {
      await whatsappService.sendReply(phoneId, from, '👋 Please send an Image or PDF of the tax invoice.').catch(() => {});
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('WhatsApp webhook error:', err.message);
    res.sendStatus(200);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OUTLOOK SYNC
// ═══════════════════════════════════════════════════════════════════════════════

const syncOutlookInvoices = async () => {
  try {
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
    return { success: true, processed: count };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

router.post('/outlook-sync', async (req, res) => res.json(await syncOutlookInvoices()));

// ═══════════════════════════════════════════════════════════════════════════════
// PROFORMA INVOICE (PI)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/pi', async (req, res) => {
  try {
    const { vendorId, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (vendorId) filter.vendor = vendorId;
    if (status)   filter.status = status;

    const [pis, total] = await Promise.all([
      ProformaInvoice.find(filter)
        .populate('vendor', 'companyName gstNumber')
        .populate('finalInvoice', 'invoiceNumber status amountPaid amountDue')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      ProformaInvoice.countDocuments(filter),
    ]);

    const piIds = pis.map((p) => p._id);
    const pays  = await Payment.find({ proformaInvoice: { $in: piIds } })
      .select('proformaInvoice amount paymentDate paymentMode bankRef status paymentRef')
      .sort({ paymentDate: 1 });

    const byPI = {};
    pays.forEach((p) => { const k = p.proformaInvoice?.toString(); if (!byPI[k]) byPI[k] = []; byPI[k].push(p); });
    res.json({ data: pis.map((pi) => ({ ...pi.toObject(), payments: byPI[pi._id.toString()] || [] })), total, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pi/:id', async (req, res) => {
  try {
    const pi = await ProformaInvoice.findById(req.params.id).populate('vendor', 'companyName gstNumber').populate('finalInvoice');
    if (!pi) return res.status(404).json({ error: 'PI not found' });
    const payments = await Payment.find({ proformaInvoice: pi._id }).sort({ paymentDate: 1 });
    res.json({ ...pi.toObject(), payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pi', async (req, res) => {
  try {
    const existing = await ProformaInvoice.findOne({ piNumber: req.body.piNumber });
    if (existing) return res.status(409).json({ duplicate: true, error: `PI number "${req.body.piNumber}" already exists.`, piNumber: req.body.piNumber });

    const pi = new ProformaInvoice({ ...req.body, attachment: req.body.attachment || undefined, attachmentMime: req.body.attachmentMime || undefined });
    pi.amountPaid = 0; pi.amountDue = pi.totalAmount;
    await pi.save();
    res.status(201).json(await ProformaInvoice.findById(pi._id).populate('vendor', 'companyName gstNumber'));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ duplicate: true, error: `PI number "${req.body.piNumber}" already exists.`, piNumber: req.body.piNumber });
    res.status(400).json({ error: err.message });
  }
});

router.patch('/pi/:id', async (req, res) => {
  try {
    const pi = await ProformaInvoice.findById(req.params.id);
    if (!pi) return res.status(404).json({ error: 'PI not found' });
    Object.assign(pi, req.body); await pi.save(); res.json(pi);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/pi/:id', async (req, res) => {
  try {
    const pi = await ProformaInvoice.findById(req.params.id);
    if (!pi) return res.status(404).json({ error: 'PI not found' });
    await Payment.deleteMany({ proformaInvoice: pi._id });
    await ProformaInvoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'PI deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/payments', async (req, res) => {
  try {
    const { vendorId, mappedTo, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (vendorId) filter.vendor = vendorId;
    if (mappedTo) filter.mappedTo = mappedTo;
    if (status)   filter.status = status;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('vendor', 'companyName')
        .populate('proformaInvoice', 'piNumber totalAmount amountPaid status')
        .populate('vendorInvoice', 'invoice_number total_amount vendor_name')
        .sort({ paymentDate: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      Payment.countDocuments(filter),
    ]);
    res.json({ data: payments, total, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', async (req, res) => {
  try {
    const { vendor, paymentDate, amount, currency, paymentMode, bankRef, remarks, mappedTo, proformaInvoice: piId, vendorInvoice: viId } = req.body;

    // Collision-proof paymentRef
    const last = await Payment.findOne({}, { paymentRef: 1 }).sort({ paymentRef: -1 });
    let nextNum = 1;
    if (last?.paymentRef) { const m = last.paymentRef.match(/PAY-(\d+)/); if (m) nextNum = parseInt(m[1], 10) + 1; }
    let paymentRef;
    do { paymentRef = `PAY-${String(nextNum).padStart(5, '0')}`; if (!(await Payment.exists({ paymentRef }))) break; nextNum++; } while (true);

    const payment = new Payment({
      paymentRef, vendor: vendor || null, paymentDate, amount: Number(amount),
      currency, paymentMode, bankRef, remarks, mappedTo: mappedTo || 'advance',
      proformaInvoice: piId || null, vendorInvoice: viId || null,
      screenshot: req.body.screenshot || undefined, screenshotMime: req.body.screenshotMime || undefined,
    });
    await payment.save();

    if (piId) {
      const pi = await ProformaInvoice.findById(piId);
      if (!pi) { await Payment.findByIdAndDelete(payment._id); throw new Error('PI not found'); }
      if (pi.amountPaid + Number(amount) > pi.totalAmount) { await Payment.findByIdAndDelete(payment._id); throw new Error(`Exceeds PI balance of ₹${pi.totalAmount - pi.amountPaid}`); }
      pi.amountPaid += Number(amount);
      if (pi.amountPaid >= pi.totalAmount && pi.finalInvoice) pi.status = 'invoiced';
      await pi.save();
    }
    if (viId) {
      const vi = await Invoice.findById(viId);
      if (!vi) { await Payment.findByIdAndDelete(payment._id); throw new Error('Invoice not found in vault'); }
      const linkedPi = await ProformaInvoice.findOne({ finalInvoice: viId });
      if (linkedPi) {
        if (linkedPi.amountPaid + Number(amount) > linkedPi.totalAmount) { await Payment.findByIdAndDelete(payment._id); throw new Error(`Exceeds PI balance of ₹${linkedPi.totalAmount - linkedPi.amountPaid}`); }
        linkedPi.amountPaid += Number(amount);
        payment.proformaInvoice = linkedPi._id;
        if (linkedPi.amountPaid >= linkedPi.totalAmount) linkedPi.status = 'invoiced';
        await linkedPi.save();
      }
      if (vi.vendor_name && !vendor) {
        const vendorDoc = await Vendor.findOne({ companyName: new RegExp(vi.vendor_name, 'i') });
        if (vendorDoc) payment.vendor = vendorDoc._id;
      }
      await payment.save();
    }

    res.status(201).json(await Payment.findById(payment._id).populate('vendor', 'companyName').populate('proformaInvoice', 'piNumber totalAmount amountPaid amountDue status').populate('vendorInvoice', 'invoice_number total_amount vendor_name'));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/payments/:id/map', async (req, res) => {
  try {
    const { mappedTo, proformaInvoice: piId, vendorInvoice: viId } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment)                     return res.status(404).json({ error: 'Payment not found' });
    if (payment.mappedTo !== 'advance') return res.status(400).json({ error: 'Only advances can be re-mapped' });

    if (mappedTo === 'proforma_invoice' && piId) {
      const pi = await ProformaInvoice.findById(piId);
      if (!pi) throw new Error('PI not found');
      if (pi.amountPaid + payment.amount > pi.totalAmount) throw new Error(`Exceeds PI balance of ₹${pi.totalAmount - pi.amountPaid}`);
      pi.amountPaid += payment.amount;
      if (pi.amountPaid >= pi.totalAmount && pi.finalInvoice) pi.status = 'invoiced';
      await pi.save();
      payment.mappedTo = 'proforma_invoice'; payment.proformaInvoice = piId; if (pi.vendor) payment.vendor = pi.vendor;
    } else if (mappedTo === 'vendor_invoice' && viId) {
      const vi = await Invoice.findById(viId);
      if (!vi) throw new Error('Invoice not found in vault.');
      payment.mappedTo = 'vendor_invoice'; payment.vendorInvoice = viId;
      if (vi.vendor_name) {
        const vendorDoc = await Vendor.findOne({ companyName: new RegExp(vi.vendor_name, 'i') });
        if (vendorDoc) payment.vendor = vendorDoc._id;
      }
    } else { return res.status(400).json({ error: 'Invalid mapping target' }); }

    await payment.save();
    res.json(await Payment.findById(payment._id).populate('vendor', 'companyName').populate('proformaInvoice', 'piNumber totalAmount amountPaid amountDue status').populate('vendorInvoice', 'invoice_number total_amount vendor_name'));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/payments/link-to-invoice', async (req, res) => {
  try {
    const { piId, invoiceId } = req.body;
    if (!piId || !invoiceId) return res.status(400).json({ error: 'piId and invoiceId required' });
    const [pi, invoice] = await Promise.all([ProformaInvoice.findById(piId), Invoice.findById(invoiceId)]);
    if (!pi)      return res.status(404).json({ error: 'PI not found' });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found in vault' });
    pi.finalInvoice = new mongoose.Types.ObjectId(invoiceId); pi.status = 'invoiced'; await pi.save();
    const updated = await Payment.updateMany({ proformaInvoice: new mongoose.Types.ObjectId(piId) }, { $set: { vendorInvoice: new mongoose.Types.ObjectId(invoiceId) } });
    res.json({ success: true, pi: await ProformaInvoice.findById(pi._id).populate('vendor', 'companyName'), paymentsUpdated: updated.modifiedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.proformaInvoice) {
      const pi = await ProformaInvoice.findById(payment.proformaInvoice);
      if (pi) { pi.amountPaid = Math.max(0, pi.amountPaid - payment.amount); await pi.save(); }
    }
    if (payment.vendorInvoice) {
      const vi = await VendorInvoice.findById(payment.vendorInvoice);
      if (vi) { vi.amountPaid = Math.max(0, vi.amountPaid - payment.amount); vi.payments = vi.payments.filter((p) => p.toString() !== payment._id.toString()); await vi.save(); }
    }
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR GST
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/vendor-gst/:vendorId', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId).select('companyName gstNumber');
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ companyName: vendor.companyName, gstNumber: vendor.gstNumber || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/vendor-gst/:vendorId', async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId, { gstNumber: req.body.gstNumber }, { new: true }).select('companyName gstNumber');
    res.json(vendor);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/summary', async (req, res) => {
  try {
    const { vendorId } = req.query;
    const match = vendorId ? { vendor: new mongoose.Types.ObjectId(vendorId) } : {};
    const [piStats, paymentStats] = await Promise.all([
      ProformaInvoice.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' }, amountPaid: { $sum: '$amountPaid' }, amountDue: { $sum: '$amountDue' } } }]),
      Payment.aggregate([{ $match: match }, { $group: { _id: '$mappedTo', count: { $sum: 1 }, totalPaid: { $sum: '$amount' } } }]),
    ]);
    res.json({ piStats, paymentStats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, syncOutlookInvoices };