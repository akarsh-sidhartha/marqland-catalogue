const express = require('express');
const router = express.Router();
const axios = require('axios');
const Invoice = require('../models/Invoice');

/**
 * Helper function to delay execution (sleep)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @route POST /api/invoices/process
 * @desc Process document with Gemini AI with Exponential Backoff for 429 errors
 */
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