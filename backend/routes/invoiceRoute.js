const express = require('express');
const router = express.Router();
const axios = require('axios');
const Invoice = require('../models/Invoice');

/**
 * Helper function to delay execution (sleep)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Utility: Check if an invoice already exists
 */
const checkIfDuplicate = async (vendor_gst, invoice_number) => {
    if (!vendor_gst || !invoice_number) return false;
    const existing = await Invoice.findOne({ vendor_gst, invoice_number });
    return !!existing;
};

/**
 * CORE AI LOGIC: Shared extraction via Gemini
 */
const processWithGemini = async (base64Data, mimeType) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");

    const systemPrompt = `Extract Indian Tax Invoice details. Return ONLY a valid JSON object with: 
    vendor_name, vendor_gst (15-char GSTIN), invoice_number, date (YYYY-MM-DD), 
    total_amount (Number), cgst (Number), sgst (Number), igst (Number), 
    financialYear (e.g. 2023-24), month (Full Name).`;

    const payload = {
        contents: [{
            parts: [
                { text: systemPrompt },
                { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
            ]
        }]
    };

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        payload
    );

    const text = response.data.candidates[0].content.parts[0].text;
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
};

/**
 * Shared Handler for Automated Sources (WhatsApp/Outlook)
 */
const handleAutomatedInvoice = async (base64, mimeType) => {
    try {
        const extractedData = await processWithGemini(base64, mimeType);
        const isDup = await checkIfDuplicate(extractedData.vendor_gst, extractedData.invoice_number);
        
        if (isDup) {
            console.log(`[Auto-Scan] Skip duplicate: ${extractedData.invoice_number}`);
            return { success: false, reason: "duplicate" };
        }

        const newInvoice = new Invoice({
            ...extractedData,
            image: `data:${mimeType};base64,${base64}`,
            mimeType: mimeType,
            status: 'pending', // Default status for new automated invoices
            createdAt: new Date()
        });

        await newInvoice.save();
        console.log(`✅ Auto-Saved: ${extractedData.invoice_number}`);
        return { success: true };
    } catch (err) {
        console.error("Automated Flow Error:", err.message);
        throw err;
    }
};

// --- WHATSAPP WEBHOOK HANDLERS ---

router.get('/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === "MARQLAND_SECRET_TOKEN") {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

router.post('/whatsapp/webhook', async (req, res) => {
    try {
        const entry = req.body.entry?.[0]?.changes?.[0]?.value;
        const message = entry?.messages?.[0];

        if (message && (message.image || message.document)) {
            const mediaId = message.image ? message.image.id : message.document.id;
            const media = await whatsappService.downloadWhatsAppMedia(mediaId);
            if (media) {
                await handleAutomatedInvoice(media.base64, media.mimeType);
            }
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("WhatsApp Webhook Logic Error:", err.message);
        res.sendStatus(200); 
    }
});

// --- MICROSOFT OUTLOOK SYNC ---

const getMicrosoftAccessToken = async () => {
    try {
        const url = `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}/oauth2/v2.0/token`;
        const data = qs.stringify({
            client_id: process.env.OUTLOOK_CLIENT_ID,
            scope: 'https://graph.microsoft.com/.default',
            client_secret: process.env.OUTLOOK_CLIENT_SECRET,
            grant_type: 'client_credentials',
        });

        const response = await axios.post(url, data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data.access_token;
    } catch (err) {
        console.error("Outlook Auth Error:", err.response?.data || err.message);
        throw new Error("Failed to authenticate with Microsoft");
    }
};

const syncOutlookInvoices = async () => {
    console.log("📂 [Cron] Starting Outlook Scan...");
    let processed = 0;

    try {
        const token = await getMicrosoftAccessToken();
        const userId = process.env.OUTLOOK_USER_ID; 
        
        const mailUrl = `https://graph.microsoft.com/v1.0/users/${userId}/messages?$filter=hasAttachments eq true and isRead eq false&$select=id,subject`;
        const mailRes = await axios.get(mailUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const messages = mailRes.data.value || [];

        for (const msg of messages) {
            const attachUrl = `https://graph.microsoft.com/v1.0/users/${userId}/messages/${msg.id}/attachments`;
            const attachRes = await axios.get(attachUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const attachments = attachRes.data.value || [];

            for (const file of attachments) {
                if ((file.contentType.includes('image') || file.contentType.includes('pdf')) && file.contentBytes) {
                    try {
                        const res = await handleAutomatedInvoice(file.contentBytes, file.contentType);
                        if (res.success) processed++;
                        await sleep(1000); 
                    } catch (e) {
                        console.error(`Error processing file ${file.name}: ${e.message}`);
                    }
                }
            }

            // Mark email as read
            await axios.patch(`https://graph.microsoft.com/v1.0/users/${userId}/messages/${msg.id}`, 
                { isRead: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        }

        return { success: true, processed };
    } catch (err) {
        console.error("Outlook Sync Error:", err.message);
        return { success: false, processed: 0, error: err.message };
    }
};

router.post('/sync-outlook', async (req, res) => {
    const result = await syncOutlookInvoices();
    res.json(result);
});

router.post('/process', async (req, res) => {
    try {
        const { image, mimeType } = req.body;
        const base64 = image.includes(',') ? image.split(',')[1] : image;
        const result = await processWithGemini(base64, mimeType);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/invoices/process
 * @desc Process document with Gemini AI with Exponential Backoff for 429 errors
 * This is a workign code for Process API
 */
/*
router.post('/process', async (req, res) => {
  const { image, mimeType, prompt: userPrompt } = req.body;
  if (!image) return res.status(400).json({ error: "No image data provided" });

  const base64Content = image.split(',')[1];
  const apiKey = process.env.GEMINI_API_KEY;
  // 2. CRITICAL for NSSM: Check if API Key loaded correctly
  if (!apiKey) {
    console.error("NSSM ERROR: GEMINI_API_KEY is not defined in Service Environment.");
    return res.status(500).json({ error: "Server Configuration Error: API Key missing." });
  }
  const systemPrompt = `Extract Indian Tax Invoice details. Return ONLY a valid JSON object with: 
    vendor_name, 
    vendor_gst (15-char GSTIN), 
    invoice_number, 
    date (YYYY-MM-DD), 
    total_amount (Number), 
    cgst (Number), 
    sgst (Number), 
    igst (Number). 
    If a value is not found, use null or 0 for numbers.`;

  const maxRetries = 5;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const modelName = "gemini-2.5-flash";
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [
              { text: userPrompt || "Analyze this document and extract billing info." },
              { inlineData: { mimeType: mimeType || 'image/png', data: base64Content } }
            ]
          }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        }
      );

      const extracted = JSON.parse(response.data.candidates[0].content.parts[0].text);
      return res.json(extracted); // Success!

    } catch (error) {
      const status = error.response ? error.response.status : null;

      if (status === 429 && attempt < maxRetries) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s...
        console.log(`Rate limited (429). Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
        await sleep(delay);
        continue; 
      }

      console.error("Gemini AI Error:", error.response?.data || error.message);
      return res.status(status || 500).json({ 
        error: status === 429 ? "Rate limit exceeded. Please try again in a minute." : "AI Processing failed" 
      });
    }
  }
});
*/


/**
 * @route GET /api/invoices
 */
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /api/invoices
 */
router.post('/', async (req, res) => {
  try {
    const invoiceData = {
      vendor_name: req.body.vendor_name,
      vendor_gst: req.body.vendor_gst,
      invoice_number: req.body.invoice_number,
      date: req.body.date,
      total_amount: Number(req.body.total_amount),
      cgst: Number(req.body.cgst || 0),
      sgst: Number(req.body.sgst || 0),
      igst: Number(req.body.igst || 0),
      financialYear: req.body.financialYear,
      month: req.body.month,
      image: req.body.image,
      mimeType: req.body.mimeType,
      createdAt: new Date()
    };

    const newInvoice = new Invoice(invoiceData);
    await newInvoice.save();
    res.status(201).json(newInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route DELETE /api/invoices/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
// Exporting syncOutlookInvoices for the global cron job in server.js
module.exports.syncOutlookInvoices = syncOutlookInvoices;