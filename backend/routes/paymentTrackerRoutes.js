/**
 * paymentTrackerRoutes.js
 * Unified route: Payment Tracker (PI, Payments, Advance mapping) + Invoice Vault (manual upload, WhatsApp, Outlook)
 * Replaces both paymentTrackerRoutes.js and invoiceRoute.js
 */

const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const axios    = require("axios");
const qs       = require("qs");

const { ProformaInvoice, Payment, VendorInvoice } = require("../models/paymentTrackerModel");
const Invoice      = require("../models/Invoice");
const Vendor       = require("../models/Vendor");

// ─── WhatsApp service (keep existing) ─────────────────────────────────────────
let whatsappService;
try { whatsappService = require("../services/whatsappService"); } catch { whatsappService = null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Normalise FY to short format: "2025-2026" → "2025-26", "2025-26" stays as-is
const normalizeFY = (fy) => {
  if (!fy) return fy;
  return fy.replace(/^(\d{4})-(\d{2,4})$/, (_, y, s) => `${y}-${String(s).slice(-2).padStart(2, "0")}`);
};
// Canonical FY from a Date — always short format
const fyFromDate = (d) => {
  const y = d.getFullYear();
  const sh = (n) => String(n).slice(-2).padStart(2, "0");
  return d.getMonth() < 3 ? `${y - 1}-${sh(y)}` : `${y}-${sh(y + 1)}`;
};

const checkIfDuplicate = async (vendor_gst, invoice_number) => {
  if (!vendor_gst || !invoice_number) return false;
  return !!(await Invoice.findOne({ vendor_gst, invoice_number }));
};

// ─── AI Extraction (Gemini — same logic as existing invoiceRoute.js) ──────────
const getAvailableGeminiModels = async (apiKey) => {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    return res.data.models
      .map((m) => m.name.replace("models/", ""))
      .filter((n) => n.includes("flash") || n.includes("pro"))
      .filter((n) => !n.includes("gemini-1.0"));
  } catch {
    return ["gemini-1.5-flash"];
  }
};

const processWithGemini = async (base64Data, mimeType) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing from environment");

  const systemPrompt = `Extract Indian Tax Invoice details. Return ONLY a valid JSON object with these fields:
vendor_name (string), vendor_gst (15-char GSTIN string), invoice_number (string), date (YYYY-MM-DD),
total_amount (Number), cgst (Number), sgst (Number), igst (Number),
financialYear (e.g. "2024-25"), month (full month name e.g. "March").
Use null for any field not found.`;

  const payload = {
    contents: [{ parts: [{ text: systemPrompt }, { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }] }],
  };

  let attempts = 0;
  while (attempts < 5) {
    try {
      const models = await getAvailableGeminiModels(apiKey);
      const model  = Array.isArray(models) ? models[0] : models;
      const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res    = await axios.post(url, payload);
      const text   = res.data.candidates[0].content.parts[0].text;
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (err) {
      attempts++;
      if (attempts === 5) throw err;
      await sleep(Math.pow(2, attempts) * 1000);
    }
  }
};

// ─── Shared: Process + Save invoice (WhatsApp / Outlook / manual) ─────────────
const handleAutomatedInvoice = async (base64Data, mimeType, source, metadata = {}) => {
  try {
    const extraction = await processWithGemini(base64Data, mimeType);
    const isDup = await checkIfDuplicate(extraction.vendor_gst, extraction.invoice_number);
    if (isDup) return { success: false, reason: "Duplicate", data: extraction };

    // Auto-save GSTIN against vendor if matched
    if (extraction.vendor_gst && extraction.vendor_name) {
      const vendor = await Vendor.findOne({ companyName: new RegExp(extraction.vendor_name, "i") });
      if (vendor && !vendor.gstNumber) {
        vendor.gstNumber = extraction.vendor_gst;
        await vendor.save().catch(() => {});
      }
    }

    const { month: autoMonth, fy: autoFY } = extraction.date
      ? (() => { const d = new Date(extraction.date); return { month: d.toLocaleString("default", { month: "long" }), fy: fyFromDate(d) }; })()
      : { month: "Unknown", fy: "Unknown" };

    const inv = new Invoice({
      ...extraction,
      total_amount: Number(extraction.total_amount || 0),
      image: `data:${mimeType};base64,${base64Data}`,
      mimeType,
      receivedVia: source,
      financialYear: normalizeFY(extraction.financialYear) || autoFY,
      month: extraction.month || autoMonth,
      notes: metadata.notes || `Auto-processed via ${source}`,
      createdAt: new Date(),
    });

    await inv.save();
    return { success: true, data: inv };
  } catch (err) {
    console.error(`handleAutomatedInvoice error (${source}):`, err.message);
    throw err;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE VAULT ROUTES (previously invoiceRoute.js)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/payment-tracker/gemini-status — lightweight quota check
// Sends a tiny probe to Gemini to check if the daily quota is still available.
// Returns { available: true/false, reason: string }
router.get("/gemini-status", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.json({ available: false, reason: "no_key" });
  try {
    const models = await getAvailableGeminiModels(apiKey);
    const model  = Array.isArray(models) ? models[0] : models;
    const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    await axios.post(url, { contents: [{ parts: [{ text: "hi" }] }] }, { timeout: 5000 });
    res.json({ available: true });
  } catch (err) {
    const status = err.response?.status;
    if (status === 429) return res.json({ available: false, reason: "quota_exceeded" });
    if (status === 403) return res.json({ available: false, reason: "key_invalid" });
    // Network/timeout — assume available and let actual scan attempt if it fails
    res.json({ available: true, reason: "check_inconclusive" });
  }
});

// POST /api/payment-tracker/invoices/process  — AI extraction only (no save)
router.post("/invoices/process", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    const base64 = image.includes(",") ? image.split(",")[1] : image;
    const result = await processWithGemini(base64, mimeType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payment-tracker/invoices — list all vault invoices
router.get("/invoices", async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payment-tracker/invoices — manual save to vault
router.post("/invoices", async (req, res) => {
  try {
    const isDup = await checkIfDuplicate(req.body.vendor_gst, req.body.invoice_number);
    if (isDup) return res.status(409).json({ duplicate: true, error: "Invoice already exists in vault.", invoice_number: req.body.invoice_number, vendor_name: req.body.vendor_name });

    // Auto-save GSTIN to vendor record
    if (req.body.vendor_gst && req.body.vendor_name) {
      const vendor = await Vendor.findOne({ companyName: new RegExp(req.body.vendor_name, "i") });
      if (vendor && !vendor.gstNumber) { vendor.gstNumber = req.body.vendor_gst; await vendor.save().catch(() => {}); }
    }

    const { month, fy } = (() => { const d = req.body.date ? new Date(req.body.date) : new Date(); return { month: d.toLocaleString("default", { month: "long" }), fy: fyFromDate(d) }; })();

    const inv = new Invoice({
      ...req.body,
      total_amount: Number(req.body.total_amount || 0),
      financialYear: normalizeFY(req.body.financialYear) || fy,
      month: req.body.month || month,
      createdAt: new Date(),
    });
    await inv.save();

    // ── Auto-link: find open PI for this vendor and link it ──────────────────
    const linkedPiId = req.body.linkedPi || null;
    let piToLink = null;

    if (linkedPiId) {
      // Explicit PI link chosen in the form
      piToLink = await ProformaInvoice.findById(linkedPiId);
    } else if (req.body.vendor_name) {
      // Auto-match: find open PI by vendor name with outstanding balance
      const vendor = await Vendor.findOne({ companyName: new RegExp(req.body.vendor_name.trim(), "i") });
      if (vendor) {
        piToLink = await ProformaInvoice.findOne({
          vendor: vendor._id,
          status: { $in: ["pending", "partial", "fully_paid"] },
          finalInvoice: null,
        }).sort({ createdAt: -1 });
      }
    }

    if (piToLink) {
      // Link the invoice to the PI
      piToLink.finalInvoice = inv._id;
      if (piToLink.status === "fully_paid") piToLink.status = "invoiced";
      await piToLink.save();

      // Re-point any payments on this PI so vendorInvoice = inv._id
      await Payment.updateMany(
        { proformaInvoice: piToLink._id },
        { $set: { vendorInvoice: inv._id } }
      );
    }

    res.status(201).json({ ...inv.toObject(), _linkedPi: piToLink?._id || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/payment-tracker/invoices/:id
router.delete("/invoices/:id", async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WhatsApp Webhook ───────────────────────────────────────────────────────────
router.get("/whatsapp-webhook", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode && token === process.env.WHATSAPP_TOKEN) res.status(200).send(challenge);
  else res.sendStatus(403);
});

router.post("/whatsapp-webhook", async (req, res) => {
  try {
    const msg   = req.body.entry?.[0]?.changes?.[0]?.value;
    const meta  = msg?.metadata;
    if (!msg?.messages) return res.sendStatus(200);

    const from  = msg.messages[0].from;
    const media = msg.messages[0].document || msg.messages[0].image || null;

    if (media && whatsappService) {
      await whatsappService.sendReply(meta?.phone_number_id, from, "⏳ Reading invoice...").catch(() => {});
      const mediaData = await whatsappService.downloadWhatsAppMedia(media.id);
      if (mediaData) {
        const result = await handleAutomatedInvoice(mediaData.base64, mediaData.mimeType, "whatsapp", { notes: `WhatsApp from: ${from}` });
        if (result.success) {
          await whatsappService.sendReply(meta?.phone_number_id, from, `✅ Invoice Saved!\n*Vendor:* ${result.data.vendor_name}\n*Inv:* ${result.data.invoice_number}\n*Amount:* ₹${result.data.total_amount}`);
        } else if (result.reason === "Duplicate") {
          await whatsappService.sendReply(meta?.phone_number_id, from, `⚠️ Duplicate: Invoice #${result.data.invoice_number} already in vault.`);
        }
      }
    } else if (whatsappService) {
      await whatsappService.sendReply(meta?.phone_number_id, from, "👋 Please send an Image or PDF of the tax invoice.").catch(() => {});
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("WhatsApp webhook error:", err.message);
    res.sendStatus(200);
  }
});

// ── Outlook Domain Sync ───────────────────────────────────────────────────────
const getMicrosoftAccessToken = async () => {
  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    qs.stringify({ client_id: process.env.MICROSOFT_CLIENT_ID, scope: "https://graph.microsoft.com/.default", client_secret: process.env.MICROSOFT_CLIENT_SECRET, grant_type: "client_credentials" }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data.access_token;
};

const syncOutlookInvoices = async () => {
  try {
    const token   = await getMicrosoftAccessToken();
    const headers = { Authorization: `Bearer ${token}` };
    const users   = (await axios.get("https://graph.microsoft.com/v1.0/users?$select=id,userPrincipalName", { headers })).data.value;
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    let count = 0;

    for (const user of users) {
      try {
        const msgs = (await axios.get(`https://graph.microsoft.com/v1.0/users/${user.id}/messages?$filter=hasAttachments eq true and receivedDateTime ge ${yesterday}&$select=id,subject,from,receivedDateTime`, { headers })).data.value;
        for (const m of msgs) {
          const attachments = (await axios.get(`https://graph.microsoft.com/v1.0/users/${user.id}/messages/${m.id}/attachments`, { headers })).data.value;
          for (const att of attachments) {
            if (att.contentType?.startsWith("image/") || att.contentType === "application/pdf") {
              const r = await handleAutomatedInvoice(att.contentBytes, att.contentType, "outlook", { notes: `User: ${user.userPrincipalName} | From: ${m.from?.emailAddress?.address} | Subject: ${m.subject}` });
              if (r.success) count++;
            }
          }
        }
      } catch { continue; }
    }
    return { success: true, processed: count };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

router.post("/outlook-sync", async (req, res) => res.json(await syncOutlookInvoices()));

// ═══════════════════════════════════════════════════════════════════════════════
// PROFORMA INVOICE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/pi", async (req, res) => {
  try {
    const { vendorId, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (vendorId) filter.vendor = vendorId;
    if (status)   filter.status = status;

    const pis = await ProformaInvoice.find(filter)
      .populate("vendor", "companyName gstNumber")
      .populate("finalInvoice", "invoiceNumber status amountPaid amountDue")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total  = await ProformaInvoice.countDocuments(filter);
    const piIds  = pis.map((p) => p._id);
    const pays   = await Payment.find({ proformaInvoice: { $in: piIds } })
      .select("proformaInvoice amount paymentDate paymentMode bankRef status paymentRef")
      .sort({ paymentDate: 1 });

    const byPI = {};
    pays.forEach((p) => { const k = p.proformaInvoice?.toString(); if (!byPI[k]) byPI[k] = []; byPI[k].push(p); });
    const result = pis.map((pi) => ({ ...pi.toObject(), payments: byPI[pi._id.toString()] || [] }));
    res.json({ data: result, total, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/pi/:id", async (req, res) => {
  try {
    const pi = await ProformaInvoice.findById(req.params.id).populate("vendor", "companyName gstNumber").populate("finalInvoice");
    if (!pi) return res.status(404).json({ error: "PI not found" });
    const payments = await Payment.find({ proformaInvoice: pi._id }).sort({ paymentDate: 1 });
    res.json({ ...pi.toObject(), payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/pi", async (req, res) => {
  try {
    // Check for duplicate PI number before attempting save
    const existing = await ProformaInvoice.findOne({ piNumber: req.body.piNumber });
    if (existing) {
      return res.status(409).json({
        duplicate: true,
        error: `PI number "${req.body.piNumber}" already exists.`,
        piNumber: req.body.piNumber,
      });
    }
    const pi = new ProformaInvoice({
      ...req.body,
      attachment:     req.body.attachment     || undefined,
      attachmentMime: req.body.attachmentMime || undefined,
    });
    pi.amountPaid = 0; pi.amountDue = pi.totalAmount;
    await pi.save();
    res.status(201).json(await ProformaInvoice.findById(pi._id).populate("vendor", "companyName gstNumber"));
  } catch (err) {
    // Also catch MongoDB duplicate key error as a safety net
    if (err.code === 11000) {
      return res.status(409).json({ duplicate: true, error: `PI number "${req.body.piNumber}" already exists.`, piNumber: req.body.piNumber });
    }
    res.status(400).json({ error: err.message });
  }
});

router.patch("/pi/:id", async (req, res) => {
  try {
    const pi = await ProformaInvoice.findById(req.params.id);
    if (!pi) return res.status(404).json({ error: "PI not found" });
    Object.assign(pi, req.body); await pi.save(); res.json(pi);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/pi/:id", async (req, res) => {
  try {
    const pi = await ProformaInvoice.findById(req.params.id);
    if (!pi) return res.status(404).json({ error: "PI not found" });
    // Also delete payments mapped to this PI
    await Payment.deleteMany({ proformaInvoice: pi._id });
    await ProformaInvoice.findByIdAndDelete(req.params.id);
    res.json({ message: "PI deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/payments", async (req, res) => {
  try {
    const { vendorId, mappedTo, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (vendorId) filter.vendor = vendorId;
    if (mappedTo) filter.mappedTo = mappedTo;
    if (status)   filter.status = status;

    const payments = await Payment.find(filter)
      .populate("vendor", "companyName")
      .populate("proformaInvoice", "piNumber totalAmount amountPaid status")
      .populate("vendorInvoice", "invoice_number total_amount vendor_name")
      .sort({ paymentDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ data: payments, total: await Payment.countDocuments(filter), page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/payments", async (req, res) => {
  try {
    const { vendor, paymentDate, amount, currency, paymentMode, bankRef, remarks, mappedTo, proformaInvoice: piId, vendorInvoice: viId } = req.body;
    // Generate collision-proof paymentRef by finding the highest existing number
    // Using countDocuments() breaks after deletions — this never collides
    const lastPayment = await Payment.findOne({}, { paymentRef: 1 }).sort({ paymentRef: -1 });
    let nextNum = 1;
    if (lastPayment?.paymentRef) {
      const match = lastPayment.paymentRef.match(/PAY-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    // Extra safety: loop until we find a ref that doesn't exist yet
    let paymentRef;
    do {
      paymentRef = `PAY-${String(nextNum).padStart(5, "0")}`;
      const exists = await Payment.exists({ paymentRef });
      if (!exists) break;
      nextNum++;
    } while (true);

    const payment = new Payment({ paymentRef, vendor: vendor || null, paymentDate, amount: Number(amount), currency, paymentMode, bankRef, remarks, mappedTo: mappedTo || "advance", proformaInvoice: piId || null, vendorInvoice: viId || null, screenshot: req.body.screenshot || undefined, screenshotMime: req.body.screenshotMime || undefined });
    await payment.save();

    if (piId) {
      const pi = await ProformaInvoice.findById(piId);
      if (!pi) { await Payment.findByIdAndDelete(payment._id); throw new Error("PI not found"); }
      if (pi.amountPaid + Number(amount) > pi.totalAmount) { await Payment.findByIdAndDelete(payment._id); throw new Error(`Exceeds PI balance of ₹${pi.totalAmount - pi.amountPaid}`); }
      pi.amountPaid += Number(amount);
      // If PI now fully paid and already has a linked invoice, mark as invoiced
      if (pi.amountPaid >= pi.totalAmount && pi.finalInvoice) pi.status = "invoiced";
      await pi.save();
    }
    if (viId) {
      const vi = await Invoice.findById(viId);
      if (!vi) { await Payment.findByIdAndDelete(payment._id); throw new Error("Invoice not found in vault"); }

      // Find the PI linked to this invoice and update its amountPaid
      const linkedPi = await ProformaInvoice.findOne({ finalInvoice: viId });
      if (linkedPi) {
        if (linkedPi.amountPaid + Number(amount) > linkedPi.totalAmount) {
          await Payment.findByIdAndDelete(payment._id);
          throw new Error(`Exceeds PI balance of ₹${linkedPi.totalAmount - linkedPi.amountPaid}`);
        }
        linkedPi.amountPaid += Number(amount);
        // Also set the proformaInvoice ref on the payment for full traceability
        payment.proformaInvoice = linkedPi._id;
        if (linkedPi.amountPaid >= linkedPi.totalAmount) linkedPi.status = "invoiced";
        await linkedPi.save();
      }

      // Try to set vendor on payment from invoice vendor_name
      if (vi.vendor_name && !vendor) {
        const vendorDoc = await Vendor.findOne({ companyName: new RegExp(vi.vendor_name, "i") });
        if (vendorDoc) payment.vendor = vendorDoc._id;
      }
      await payment.save();
    }

    res.status(201).json(await Payment.findById(payment._id).populate("vendor", "companyName").populate("proformaInvoice", "piNumber totalAmount amountPaid amountDue status").populate("vendorInvoice", "invoice_number total_amount vendor_name"));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch("/payments/:id/map", async (req, res) => {
  try {
    const { mappedTo, proformaInvoice: piId, vendorInvoice: viId } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment)                    return res.status(404).json({ error: "Payment not found" });
    if (payment.mappedTo !== "advance") return res.status(400).json({ error: "Only advances can be re-mapped" });

    if (mappedTo === "proforma_invoice" && piId) {
      const pi = await ProformaInvoice.findById(piId);
      if (!pi) throw new Error("PI not found");
      if (pi.amountPaid + payment.amount > pi.totalAmount) throw new Error(`Exceeds PI balance of ₹${pi.totalAmount - pi.amountPaid}`);
      pi.amountPaid += payment.amount;
      if (pi.amountPaid >= pi.totalAmount && pi.finalInvoice) pi.status = "invoiced";
      await pi.save();
      payment.mappedTo = "proforma_invoice"; payment.proformaInvoice = piId; if (pi.vendor) payment.vendor = pi.vendor;
    } else if (mappedTo === "vendor_invoice" && viId) {
      // Invoices are stored in the Invoice (vault) model, not VendorInvoice
      const vi = await Invoice.findById(viId);
      if (!vi) throw new Error("Invoice not found in vault. Make sure the invoice is uploaded first.");
      payment.mappedTo = "vendor_invoice"; payment.vendorInvoice = viId;
      // Match vendor by name if possible
      if (vi.vendor_name) {
        const vendorDoc = await Vendor.findOne({ companyName: new RegExp(vi.vendor_name, "i") });
        if (vendorDoc) payment.vendor = vendorDoc._id;
      }
    } else {
      return res.status(400).json({ error: "Invalid mapping target" });
    }

    await payment.save();
    res.json(await Payment.findById(payment._id).populate("vendor", "companyName").populate("proformaInvoice", "piNumber totalAmount amountPaid amountDue status").populate("vendorInvoice", "invoice_number total_amount vendor_name"));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /payments/link-to-invoice — link all PI payments to an Invoice vault doc
router.post("/payments/link-to-invoice", async (req, res) => {
  try {
    const { piId, invoiceId } = req.body;
    console.log("[link-to-invoice] piId:", piId, "invoiceId:", invoiceId);
    if (!piId || !invoiceId) return res.status(400).json({ error: "piId and invoiceId required" });

    const pi      = await ProformaInvoice.findById(piId);
    const invoice = await Invoice.findById(invoiceId);
    console.log("[link-to-invoice] pi found:", !!pi, "invoice found:", !!invoice);
    if (!pi)      return res.status(404).json({ error: "PI not found" });
    if (!invoice) return res.status(404).json({ error: "Invoice not found in vault" });

    // Link invoice to PI
    pi.finalInvoice = new mongoose.Types.ObjectId(invoiceId);
    pi.status = "invoiced";
    await pi.save();
    console.log("[link-to-invoice] PI saved with status invoiced, finalInvoice:", pi.finalInvoice);

    // Point all payments on this PI to this invoice
    const updateResult = await Payment.updateMany(
      { proformaInvoice: new mongoose.Types.ObjectId(piId) },
      { $set: { vendorInvoice: new mongoose.Types.ObjectId(invoiceId) } }
    );
    console.log("[link-to-invoice] payments updated:", updateResult.modifiedCount);

    const freshPi = await ProformaInvoice.findById(pi._id).populate("vendor","companyName");
    res.json({ success: true, pi: freshPi });
  } catch (err) {
    console.error("[link-to-invoice] ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/payments/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.proformaInvoice) { const pi = await ProformaInvoice.findById(payment.proformaInvoice); if (pi) { pi.amountPaid = Math.max(0, pi.amountPaid - payment.amount); await pi.save(); } }
    if (payment.vendorInvoice)   { const vi = await VendorInvoice.findById(payment.vendorInvoice);   if (vi) { vi.amountPaid = Math.max(0, vi.amountPaid - payment.amount); vi.payments = vi.payments.filter((p) => p.toString() !== payment._id.toString()); await vi.save(); } }
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: "Payment deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR GSTIN LOOKUP — for auto-fill in invoice modal
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/vendor-gst/:vendorId", async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId).select("companyName gstNumber");
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json({ companyName: vendor.companyName, gstNumber: vendor.gstNumber || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /vendor-gst/:vendorId — save GST number back to vendor record
router.patch("/vendor-gst/:vendorId", async (req, res) => {
  try {
    const { gstNumber } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId, { gstNumber }, { new: true }).select("companyName gstNumber");
    res.json(vendor);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/summary", async (req, res) => {
  try {
    const { vendorId } = req.query;
    const match = vendorId ? { vendor: new mongoose.Types.ObjectId(vendorId) } : {};
    const [piStats, paymentStats] = await Promise.all([
      ProformaInvoice.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" }, amountPaid: { $sum: "$amountPaid" }, amountDue: { $sum: "$amountDue" } } }]),
      Payment.aggregate([{ $match: match }, { $group: { _id: "$mappedTo", count: { $sum: 1 }, totalPaid: { $sum: "$amount" } } }]),
    ]);
    res.json({ piStats, paymentStats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, syncOutlookInvoices };