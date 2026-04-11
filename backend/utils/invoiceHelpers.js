'use strict';
/**
 * backend/utils/invoiceHelpers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utilities used by paymentTrackerRoutes, invoiceRoute, and any future
 * invoice-related route.
 *
 * Eliminates duplication of: normalizeFY, fyFromDate, checkIfDuplicate, sleep
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Invoice = require('../models/Invoice');

/** Pause for ms milliseconds — used for API retry backoff */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Normalise FY to short 2-digit format.
 * "2025-2026" → "2025-26" | "2025-26" → unchanged | null → null
 */
const normalizeFY = (fy) => {
  if (!fy) return fy;
  return fy.replace(/^(\d{4})-(\d{2,4})$/, (_, y, s) => `${y}-${String(s).slice(-2).padStart(2, '0')}`);
};

/**
 * Derive { fy, month } from a Date object.
 * FY uses short format: "2025-26"
 */
const fyFromDate = (d) => {
  const y  = d.getFullYear();
  const sh = (n) => String(n).slice(-2).padStart(2, '0');
  return {
    fy:    d.getMonth() < 3 ? `${y - 1}-${sh(y)}` : `${y}-${sh(y + 1)}`,
    month: d.toLocaleString('default', { month: 'long' }),
  };
};

/**
 * Get { fy, month } from a date string. Returns 'Unknown' for invalid dates.
 */
const getFinancialDetails = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  if (isNaN(d.getTime())) return { fy: 'Unknown', month: 'Unknown' };
  return fyFromDate(d);
};

/**
 * Check whether an invoice already exists (vendor GSTIN + invoice number).
 * Returns false if either value is missing.
 */
const checkIfDuplicate = async (vendor_gst, invoice_number) => {
  if (!vendor_gst || !invoice_number) return false;
  return !!(await Invoice.findOne({ vendor_gst, invoice_number }).lean());
};

/**
 * Save an AI-extracted invoice to the database.
 * Handles deduplication, FY derivation, and field normalisation.
 *
 * @param {object} extraction - AI result
 * @param {string} base64Data - raw base64 (no data URI prefix)
 * @param {string} mimeType
 * @param {string} source     - 'whatsapp' | 'outlook' | 'manual'
 * @param {object} metadata   - { notes }
 * @returns {{ success: boolean, reason?: string, data: object }}
 */
const saveExtractedInvoice = async (extraction, base64Data, mimeType, source, metadata = {}) => {
  const isDup = await checkIfDuplicate(extraction.vendor_gst, extraction.invoice_number);
  if (isDup) return { success: false, reason: 'Duplicate', data: extraction };

  const { fy: autoFY, month: autoMonth } = getFinancialDetails(extraction.date);

  const inv = new Invoice({
    ...extraction,
    total_amount:  Number(extraction.total_amount  || 0),
    cgst:          Number(extraction.cgst          || 0),
    sgst:          Number(extraction.sgst          || 0),
    igst:          Number(extraction.igst          || 0),
    image:         `data:${mimeType};base64,${base64Data}`,
    mimeType,
    receivedVia:   source,
    financialYear: normalizeFY(extraction.financialYear) || autoFY,
    month:         extraction.month || autoMonth,
    notes:         metadata.notes   || `Auto-processed via ${source}`,
    createdAt:     new Date(),
  });

  await inv.save();
  return { success: true, data: inv };
};

module.exports = { sleep, normalizeFY, fyFromDate, getFinancialDetails, checkIfDuplicate, saveExtractedInvoice };