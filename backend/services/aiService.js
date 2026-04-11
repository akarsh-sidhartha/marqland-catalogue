/**
 * backend/services/aiService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central AI extraction service used by paymentTrackerRoutes, invoiceRoute,
 * vendorRoutes (business card scan), and any future views.
 *
 * PROVIDER WATERFALL (tries in order, falls back on quota/error):
 *   1. Gemini   — Best accuracy. Uses GEMINI_API_KEY. Free tier = 1500 req/day.
 *   2. Mistral  — Good OCR. Uses MISTRAL_API_KEY. Free tier available.
 *   3. Tesseract— Fully free, runs locally (no API key needed). Lower accuracy.
 *
 * USAGE:
 *   const { extractFromDocument, extractFromBusinessCard, checkAIStatus } = require('./aiService');
 *
 *   // Invoice / payment document
 *   const result = await extractFromDocument(base64Data, mimeType);
 *   // result: { vendor_name, vendor_gst, invoice_number, date, total_amount,
 *   //           cgst, sgst, igst, financialYear, month, _provider }
 *
 *   // Business card (vendor scan)
 *   const card = await extractFromBusinessCard(base64Data);
 *   // card: { company_name, name, phone, email, _provider }
 *
 *   // Quota / availability check
 *   const status = await checkAIStatus();
 *   // status: { available: true/false, provider: 'gemini'|'mistral'|'tesseract', reason }
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const axios = require('axios');

// ── Utility ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Safely parse JSON that may be wrapped in markdown code fences.
 */
const parseAIJson = (text) => {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

// ── Provider 1: GEMINI ────────────────────────────────────────────────────────

const getGeminiModels = async (apiKey) => {
  try {
    const res = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { timeout: 8000 }
    );
    return res.data.models
      .map((m) => m.name.replace('models/', ''))
      .filter((n) => n.includes('flash') || n.includes('pro'))
      .filter((n) => !n.includes('gemini-1.0'));
  } catch {
    return ['gemini-1.5-flash'];
  }
};

const callGemini = async (base64Data, mimeType, prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } }
      ]
    }]
  };

  let attempts = 0;
  while (attempts < 3) {
    try {
      const models = await getGeminiModels(apiKey);
      const model  = Array.isArray(models) ? models[0] : models;
      const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res    = await axios.post(url, payload, { timeout: 30000 });
      const text   = res.data.candidates[0].content.parts[0].text;
      return parseAIJson(text);
    } catch (err) {
      attempts++;
      const status = err.response?.status;
      // Quota exceeded — don't retry
      if (status === 429) throw Object.assign(err, { isQuotaError: true });
      if (attempts >= 3) throw err;
      await sleep(Math.pow(2, attempts) * 1000);
    }
  }
};

// ── Provider 2: MISTRAL (pixtral-12b — their vision model) ───────────────────

const callMistral = async (base64Data, mimeType, prompt) => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set');

  // Mistral Pixtral accepts base64 images inline
  const imageUrl = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

  const payload = {
    model: 'pixtral-12b-2409',
    messages: [{
      role: 'user',
      content: [
        { type: 'text',      text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }],
    max_tokens: 800,
    temperature: 0.1,
  };

  const res = await axios.post(
    'https://api.mistral.ai/v1/chat/completions',
    payload,
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 40000,
    }
  );

  const text = res.data.choices[0].message.content;
  return parseAIJson(text);
};

// ── Provider 3: TESSERACT (local OCR — no API key needed) ─────────────────────

/**
 * Tesseract is installed as an npm package: `npm install tesseract.js`
 * It runs entirely on your server machine — free, no limits, no internet needed.
 * Accuracy is lower than AI models but reliable for printed text.
 */
const callTesseract = async (base64Data, mimeType) => {
  // Lazy require — only load if needed
  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch {
    throw new Error('tesseract.js not installed. Run: npm install tesseract.js');
  }

  // Convert base64 to buffer
  const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buffer     = Buffer.from(pureBase64, 'base64');

  const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
    logger: () => {},  // suppress console output
  });

  // Tesseract returns raw text — we use regex heuristics to extract fields
  return extractFieldsFromRawText(text);
};

/**
 * Heuristic extraction from raw OCR text.
 * Used as a last resort when AI models are unavailable.
 */
const extractFieldsFromRawText = (text) => {
  const result = {
    vendor_name:     null,
    vendor_gst:      null,
    invoice_number:  null,
    date:            null,
    total_amount:    null,
    cgst:            null,
    sgst:            null,
    igst:            null,
    financialYear:   null,
    month:           null,
    _provider:       'tesseract',
    _raw_text:       text,  // include raw text so user can verify
  };

  // GSTIN: 15-char alphanumeric starting with 2 digits
  const gstMatch = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/);
  if (gstMatch) result.vendor_gst = gstMatch[0];

  // Invoice number patterns
  const invMatch = text.match(/(?:invoice\s*(?:no|number|#)[:\s]+)([A-Z0-9\-\/]+)/i);
  if (invMatch) result.invoice_number = invMatch[1].trim();

  // Date patterns: DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
  const dateMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    // Set financial year and month
    const mo = parseInt(m);
    result.month = new Date(`${y}-${m}-${d}`).toLocaleString('default', { month: 'long' });
    result.financialYear = mo >= 4
      ? `${y}-${String(parseInt(y)+1).slice(-2)}`
      : `${parseInt(y)-1}-${String(y).slice(-2)}`;
  }

  // Total amount: look for "Total" followed by a number
  const totalMatch = text.match(/(?:grand\s*total|total\s*amount|total)[:\s₹Rs.]*([0-9,]+(?:\.\d{2})?)/i);
  if (totalMatch) result.total_amount = parseFloat(totalMatch[1].replace(/,/g, ''));

  // GST amounts
  const cgstMatch = text.match(/CGST[:\s₹Rs.]*([0-9,]+(?:\.\d{2})?)/i);
  const sgstMatch = text.match(/SGST[:\s₹Rs.]*([0-9,]+(?:\.\d{2})?)/i);
  const igstMatch = text.match(/IGST[:\s₹Rs.]*([0-9,]+(?:\.\d{2})?)/i);
  if (cgstMatch) result.cgst = parseFloat(cgstMatch[1].replace(/,/g, ''));
  if (sgstMatch) result.sgst = parseFloat(sgstMatch[1].replace(/,/g, ''));
  if (igstMatch) result.igst = parseFloat(igstMatch[1].replace(/,/g, ''));

  // Vendor name: first non-empty line that looks like a company name
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  const companyLine = lines.find(l =>
    /pvt|ltd|llp|inc|corp|industries|enterprise|trading|solutions|services/i.test(l)
  );
  if (companyLine) result.vendor_name = companyLine.replace(/[^a-zA-Z0-9\s&.,()-]/g, '').trim();

  return result;
};

// ── Business card heuristics ──────────────────────────────────────────────────
const extractCardFieldsFromText = (text) => ({
  company_name: null,
  name: null,
  phone: text.match(/(?:\+91[\s-]?)?[6-9]\d{9}/)?.[0] || null,
  email: text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)?.[0] || null,
  _provider: 'tesseract',
  _raw_text: text,
});

// ── PROMPTS ───────────────────────────────────────────────────────────────────

const INVOICE_PROMPT = `Extract Indian Tax Invoice details from this document.
Return ONLY a valid JSON object with these exact fields (use null for missing):
{
  "vendor_name": "string",
  "vendor_gst": "15-char GSTIN string",
  "invoice_number": "string",
  "date": "YYYY-MM-DD",
  "total_amount": number,
  "cgst": number,
  "sgst": number,
  "igst": number,
  "financialYear": "e.g. 2024-25",
  "month": "full month name e.g. March"
}
No explanation. No markdown. Just the JSON object.`;

const BUSINESS_CARD_PROMPT = `Extract contact details from this business card.
Return ONLY a valid JSON object:
{
  "company_name": "string",
  "name": "person's full name",
  "phone": "phone number with country code",
  "email": "email address"
}
No explanation. No markdown. Just the JSON object.`;

// ── PUBLIC API ─────────────────────────────────────────────────────────────────

/**
 * Extract invoice/payment document fields.
 * Tries Gemini → Mistral → Tesseract in order.
 *
 * @param {string} base64Data - Base64 encoded image or PDF
 * @param {string} mimeType   - e.g. 'image/jpeg', 'application/pdf'
 * @returns {object} Extracted fields + _provider indicating which succeeded
 */
const extractFromDocument = async (base64Data, mimeType) => {
  const errors = [];

  // Strip data URI prefix if present
  const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  // ── 1. Try Gemini ──
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await callGemini(pureBase64, mimeType, INVOICE_PROMPT);
      return { ...result, _provider: 'gemini' };
    } catch (err) {
      const reason = err.isQuotaError ? 'quota_exceeded' : err.message;
      errors.push({ provider: 'gemini', reason });
      console.warn(`[aiService] Gemini failed (${reason}), trying Mistral...`);
    }
  } else {
    errors.push({ provider: 'gemini', reason: 'no_key' });
  }

  // ── 2. Try Mistral ──
  if (process.env.MISTRAL_API_KEY) {
    try {
      // Mistral Pixtral doesn't support PDF — convert prompt to ask for text extraction
      const prompt = mimeType === 'application/pdf'
        ? INVOICE_PROMPT + '\nNote: This may be a PDF rendered as image.'
        : INVOICE_PROMPT;
      const result = await callMistral(pureBase64, mimeType, prompt);
      return { ...result, _provider: 'mistral' };
    } catch (err) {
      errors.push({ provider: 'mistral', reason: err.message });
      console.warn(`[aiService] Mistral failed (${err.message}), trying Tesseract...`);
    }
  } else {
    errors.push({ provider: 'mistral', reason: 'no_key' });
  }

  // ── 3. Try Tesseract (always available if installed) ──
  try {
    const result = await callTesseract(pureBase64, mimeType);
    console.info('[aiService] Tesseract OCR used as fallback.');
    return result;
  } catch (err) {
    errors.push({ provider: 'tesseract', reason: err.message });
  }

  // All providers failed
  throw new Error(
    `All AI providers failed. Errors: ${errors.map(e => `${e.provider}:${e.reason}`).join(', ')}`
  );
};

/**
 * Extract business card contact details.
 * Tries Gemini → Mistral → Tesseract in order.
 *
 * @param {string} base64Data - Base64 encoded image
 * @returns {object} { company_name, name, phone, email, _provider }
 */
const extractFromBusinessCard = async (base64Data) => {
  const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const mimeType   = 'image/jpeg';

  // ── 1. Gemini ──
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await callGemini(pureBase64, mimeType, BUSINESS_CARD_PROMPT);
      return { ...result, _provider: 'gemini' };
    } catch (err) {
      console.warn('[aiService] Gemini card scan failed, trying Mistral...');
    }
  }

  // ── 2. Mistral ──
  if (process.env.MISTRAL_API_KEY) {
    try {
      const result = await callMistral(pureBase64, mimeType, BUSINESS_CARD_PROMPT);
      return { ...result, _provider: 'mistral' };
    } catch (err) {
      console.warn('[aiService] Mistral card scan failed, trying Tesseract...');
    }
  }

  // ── 3. Tesseract ──
  try {
    const { data: { text } } = await require('tesseract.js').recognize(
      Buffer.from(pureBase64, 'base64'), 'eng', { logger: () => {} }
    );
    return extractCardFieldsFromText(text);
  } catch (err) {
    throw new Error('All AI providers failed for business card scan.');
  }
};

/**
 * Check which AI providers are currently available.
 * Used by the frontend quota check endpoint.
 *
 * @returns {{ available: boolean, provider: string, reason: string }}
 */
const checkAIStatus = async () => {
  // Check Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const models = await getGeminiModels(process.env.GEMINI_API_KEY);
      const model  = Array.isArray(models) ? models[0] : models;
      await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: 'hi' }] }] },
        { timeout: 5000 }
      );
      return { available: true, provider: 'gemini', reason: 'ok' };
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        console.info('[aiService] Gemini quota exceeded, Mistral/Tesseract will be used.');
        // Check if fallback is available
        if (process.env.MISTRAL_API_KEY) return { available: true, provider: 'mistral', reason: 'gemini_quota_exceeded' };
        return { available: true, provider: 'tesseract', reason: 'gemini_quota_exceeded' };
      }
    }
  }

  // Gemini unavailable — check Mistral
  if (process.env.MISTRAL_API_KEY) {
    return { available: true, provider: 'mistral', reason: 'gemini_unavailable' };
  }

  // Final fallback — Tesseract is always available if installed
  try {
    require('tesseract.js');
    return { available: true, provider: 'tesseract', reason: 'ai_apis_unavailable' };
  } catch {
    return { available: false, provider: 'none', reason: 'no_providers_available' };
  }
};

module.exports = { extractFromDocument, extractFromBusinessCard, checkAIStatus };