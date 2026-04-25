'use strict';
/**
 * backend/routes/imageProcessingRoutes.js
 * Mounted at /api/image-processing
 *
 * Prompt management:
 *   GET    /prompts              — list all saved prompts
 *   POST   /prompts              — create
 *   PUT    /prompts/:id          — edit
 *   DELETE /prompts/:id          — delete
 *   PATCH  /prompts/:id/default  — set as default for category
 *
 * Image processing:
 *   POST   /preview              — process image, return base64 data URL (for before/after compare)
 *   POST   /process-single       — reprocess one product (non-blocking, saves to disk)
 *   POST   /pdf/same-category    — PDF → extract images → AI process → save as draft products
 *   POST   /pdf/extract          — PDF → extract raw images → download as ZIP (no AI)
 *
 * All AI processing is delegated to imageProcessingService.js — single source of truth.
 */

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const Product     = require('../models/product');
const ImagePrompt = require('../models/ImagePrompt');
const { processProductImage } = require('../services/imageProcessingService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const adminOnly = [authenticate, authorize(['admin', 'inventory'])];

const tmpDir = path.join(process.cwd(), 'public/uploads/tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const pdfUpload = multer({
  dest: tmpDir,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB — product catalog PDFs can be large
  fileFilter: (req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('PDF files only')),
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Image files only')),
});

// ── Resolve prompt: explicit text → saved prompt by ID → category default ─────
async function resolvePrompt(promptText, promptId, category) {
  if (promptText?.trim()) return promptText.trim();
  if (promptId) {
    const saved = await ImagePrompt.findById(promptId);
    if (saved) return saved.prompt;
  }
  if (category) {
    const def = await ImagePrompt.findOne({ category, isDefault: true });
    if (def) return def.prompt;
  }
  return null; // imageProcessingService will use its built-in category/default prompt
}

// ═══════════════════════════════════════════════════════════
// PROMPT MANAGEMENT
// ═══════════════════════════════════════════════════════════

router.get('/prompts', adminOnly, async (req, res) => {
  try {
    const prompts = await ImagePrompt.find().sort({ category: 1, createdAt: 1 }).lean();
    res.json(prompts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/prompts', adminOnly, async (req, res) => {
  try {
    const { name, category, prompt, isDefault } = req.body;
    if (!name?.trim() || !category?.trim() || !prompt?.trim())
      return res.status(400).json({ message: 'name, category and prompt are required' });
    if (isDefault)
      await ImagePrompt.updateMany({ category, isDefault: true }, { isDefault: false });
    const p = await ImagePrompt.create({ name, category, prompt, isDefault: !!isDefault });
    res.status(201).json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/prompts/:id', adminOnly, async (req, res) => {
  try {
    const { name, category, prompt, isDefault } = req.body;
    if (isDefault)
      await ImagePrompt.updateMany({ category, isDefault: true }, { isDefault: false });
    const p = await ImagePrompt.findByIdAndUpdate(
      req.params.id, { name, category, prompt, isDefault: !!isDefault }, { new: true }
    );
    if (!p) return res.status(404).json({ message: 'Prompt not found' });
    res.json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/prompts/:id', adminOnly, async (req, res) => {
  try {
    const p = await ImagePrompt.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prompt not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/prompts/:id/default', adminOnly, async (req, res) => {
  try {
    const p = await ImagePrompt.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    await ImagePrompt.updateMany({ category: p.category, isDefault: true }, { isDefault: false });
    p.isDefault = true;
    await p.save();
    res.json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// PREVIEW — process image, return as base64 data URL
// Used by the Add Product modal for before/after comparison.
// Image is NOT saved to disk here — the user decides whether
// to keep it when they click Save Product.
// ═══════════════════════════════════════════════════════════

router.post('/preview', adminOnly, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const { promptText, promptId, category } = req.body;
    const finalPrompt = await resolvePrompt(promptText, promptId, category || null);
    const processed = await processProductImage(req.file.buffer, { category, promptText: finalPrompt });
    const dataUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    res.json({ imageDataUrl: dataUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// SINGLE PRODUCT RE-PROCESS
// Reprocesses an already-saved product image in the background.
// ═══════════════════════════════════════════════════════════

router.post('/process-single', adminOnly, async (req, res) => {
  try {
    const { productId, promptText, promptId } = req.body;
    const product = await Product.findById(productId);
    if (!product)          return res.status(404).json({ message: 'Product not found' });
    if (!product.imageUrl) return res.status(400).json({ message: 'No image on product' });
    const imgPath = path.join(process.cwd(), 'public', product.imageUrl);
    if (!fs.existsSync(imgPath)) return res.status(404).json({ message: 'Image file missing' });

    const finalPrompt = await resolvePrompt(promptText, promptId, product.category);
    res.json({ message: 'Processing started', productId });

    setImmediate(async () => {
      try {
        const buf  = fs.readFileSync(imgPath);
        const out  = await processProductImage(buf, { category: product.category, promptText: finalPrompt });
        const name = product.imageUrl.replace(/\.[^.]+$/, '-proc.webp');
        fs.writeFileSync(path.join(process.cwd(), 'public', name), out);
        await Product.findByIdAndUpdate(productId, { imageUrl: name });
        console.log(`✅ Processed: ${product.name}`);
      } catch (e) { console.error(`❌ ${productId}:`, e.message); }
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// PDF UTILITIES
// ═══════════════════════════════════════════════════════════

function requireArchiver() {
  try { return require('archiver'); }
  catch { throw new Error('archiver not installed — run: npm install archiver'); }
}

/**
 * Extract images from a PDF.
 *
 * Strategy (in order of reliability):
 *   1. pdfjs-dist  — renders each page to a raw pixel buffer via canvas-like API
 *      This works on ALL PDFs regardless of internal structure (embedded, scanned, vector).
 *   2. pdf-lib fallback — direct XObject extraction for PDFs with embedded JPEG streams
 *   3. Error with install hint if neither is available
 *
 * Install: npm install pdfjs-dist canvas
 * (canvas is a native Node.js canvas needed by pdfjs-dist for rendering)
 */
async function extractPdfPages(pdfPath) {
  const sharp  = require('sharp');
  const outDir = path.join(tmpDir, `pdf_${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });
  const paths = [];

  // ── Strategy 1: pdfjs-dist page rendering (most reliable) ─────────────────
  let pdfjsWorked = false;
  try {
    // pdfjs-dist v4+ removed the legacy path — try multiple entry points
    let pdfjs;
    const pdfjsPaths = [
      'pdfjs-dist/legacy/build/pdf.js',   // v2/v3
      'pdfjs-dist/build/pdf.js',           // v4+ commonjs
      'pdfjs-dist',                         // v4+ main entry
    ];
    for (const p of pdfjsPaths) {
      try { pdfjs = require(p); break; } catch {}
    }
    if (!pdfjs) throw new Error('pdfjs-dist not loadable — run: npm install pdfjs-dist');

    // v4+ exports are nested under a default or named export
    if (pdfjs.default) pdfjs = pdfjs.default;
    if (!pdfjs.getDocument) throw new Error('pdfjs getDocument not found — unexpected module shape');

    // Disable the worker (we are in Node, not a browser)
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = '';

    // Support both 'canvas' (Linux/Mac) and '@napi-rs/canvas' (Windows, no build tools needed)
    let canvas;
    try { canvas = require('canvas'); }
    catch { canvas = require('@napi-rs/canvas'); }

    // Normalise API differences between canvas and @napi-rs/canvas
    const createCanvas = canvas.createCanvas || canvas.Canvas
      ? (w, h) => canvas.createCanvas(w, h)
      : null;
    if (!createCanvas) throw new Error('No compatible canvas module found');

    const data    = new Uint8Array(fs.readFileSync(pdfPath));
    const loadDoc = await pdfjs.getDocument({ data, disableFontFace: true }).promise;
    console.log(`   pdfjs: ${loadDoc.numPages} pages`);

    for (let pn = 1; pn <= loadDoc.numPages; pn++) {
      try {
        const page     = await loadDoc.getPage(pn);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x = ~150dpi
        const cvs      = createCanvas(viewport.width, viewport.height);
        const ctx      = cvs.getContext('2d');

        await page.render({
          canvasContext: ctx,
          viewport,
          canvasFactory: {
            create:  (w, h) => { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; },
            reset:   (obj, w, h) => { obj.canvas.width = w; obj.canvas.height = h; },
            destroy: () => {},
          },
        }).promise;

        // toBuffer works on both canvas implementations
        const pngBuf  = typeof cvs.toBuffer === 'function'
          ? cvs.toBuffer('image/png')
          : Buffer.from(await cvs.encode('png'));
        const webpBuf = await sharp(pngBuf)
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer();

        const outPath = path.join(outDir, `page-${pn}.webp`);
        fs.writeFileSync(outPath, webpBuf);
        paths.push(outPath);
        console.log(`   ✅ Rendered page ${pn} (${Math.round(webpBuf.length/1024)}KB)`);
      } catch (pageErr) {
        console.warn(`   ⚠ Page ${pn} render failed: ${pageErr.message}`);
      }
    }

    if (paths.length > 0) pdfjsWorked = true;
  } catch (e) {
    console.warn(`   pdfjs-dist not available or failed: ${e.message}`);
  }

  if (pdfjsWorked) {
    console.log(`   Total pages rendered: ${paths.length}`);
    return { imagePaths: paths, outDir };
  }

  // ── Strategy 2: pdf-lib direct JPEG XObject extraction ────────────────────
  // Works only for PDFs that embed JPEG images directly (product catalogs, etc.)
  console.log('   Falling back to pdf-lib XObject extraction...');
  let PDFLib;
  try { PDFLib = require('pdf-lib'); }
  catch { throw new Error('Neither pdfjs-dist nor pdf-lib is installed.\nRun: npm install pdfjs-dist canvas'); }

  try {
    const bytes  = fs.readFileSync(pdfPath);
    const doc    = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    let imgCount = 0;

    for (let pi = 0; pi < doc.getPageCount(); pi++) {
      const page = doc.getPages()[pi];
      let xobj;
      try {
        const resRef  = page.node.get(PDFLib.PDFName.of('Resources'));
        if (!resRef) continue;
        const res     = doc.context.lookupMaybe(resRef) ?? resRef;
        const xobjRef = res.get?.(PDFLib.PDFName.of('XObject'));
        if (!xobjRef) continue;
        xobj = doc.context.lookupMaybe(xobjRef) ?? xobjRef;
        if (!xobj?.entries) continue;
      } catch { continue; }

      for (const [key, ref] of xobj.entries()) {
        try {
          const obj  = doc.context.lookupMaybe(ref) ?? ref;
          if (!obj) continue;
          const dict = obj.dict ?? obj;
          if (!dict?.get) continue;

          const subtype = dict.get(PDFLib.PDFName.of('Subtype'));
          if (subtype?.toString() !== '/Image') continue;

          // pdf-lib stores raw bytes on .contents (Uint8Array)
          const rawData = obj.contents;
          if (!rawData || rawData.length < 1000) continue;

          const filter = dict.get(PDFLib.PDFName.of('Filter'))?.toString() ?? '';

          // Only handle JPEG — other formats need full decompression we can't do here
          if (!filter.includes('DCTDecode')) continue;

          const wVal = dict.get(PDFLib.PDFName.of('Width'));
          const hVal = dict.get(PDFLib.PDFName.of('Height'));
          const w = typeof wVal?.asNumber === 'function' ? wVal.asNumber() : (wVal?.value?.() ?? 0);
          const h = typeof hVal?.asNumber === 'function' ? hVal.asNumber() : (hVal?.value?.() ?? 0);
          if (w < 80 || h < 80) continue;

          // Validate it's real JPEG (starts with FF D8)
          if (rawData[0] !== 0xFF || rawData[1] !== 0xD8) continue;

          const webpBuf = await sharp(Buffer.from(rawData))
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 90 })
            .toBuffer();

          imgCount++;
          const outPath = path.join(outDir, `img-p${pi+1}-${imgCount}.webp`);
          fs.writeFileSync(outPath, webpBuf);
          paths.push(outPath);
          console.log(`   ✅ JPEG XObject ${imgCount}: page ${pi+1} | ${w}x${h}`);
        } catch { /* skip this xobj */ }
      }
    }
  } catch (e) {
    console.warn(`   pdf-lib extraction error: ${e.message}`);
  }

  if (paths.length === 0) {
    throw new Error(
      'No images could be extracted from this PDF.\n' +
      'Install PDF support:\n' +
      '  Linux/Mac: npm install pdfjs-dist canvas\n' +
      '  Windows:   npm install pdfjs-dist @napi-rs/canvas'
    );
  }

  console.log(`   Total images extracted: ${paths.length}`);
  return { imagePaths: paths, outDir };
}
// ── PDF: Same category — process with AI, save as draft products ──────────────
router.post('/pdf/same-category', adminOnly, (req, res, next) => {
  pdfUpload.single('pdf')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `PDF too large. Maximum allowed size is 200 MB.` });
    }
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  const tmpPdf = req.file?.path;
  let outDir;
  try {
    if (!req.file) return res.status(400).json({ message: 'No PDF uploaded' });
    const { category, brand, promptText, promptId } = req.body;
    if (!category || !brand) return res.status(400).json({ message: 'category and brand required' });

    const finalPrompt = await resolvePrompt(promptText, promptId, category);
    const { imagePaths, outDir: od } = await extractPdfPages(tmpPdf);
    outDir = od;
    if (!imagePaths.length) return res.status(400).json({ message: 'No pages extracted from PDF' });

    const created = [];
    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const buf  = fs.readFileSync(imagePaths[i]);
        const out  = await processProductImage(buf, { category, promptText: finalPrompt });
        const name = `pdf-${Date.now()}-${i}.webp`;
        fs.writeFileSync(path.join(process.cwd(), 'public/uploads', name), out);
        const p = await Product.create({
          brand, category,
          name: `${brand} — Import ${i + 1}`,
          description: '',
          imageUrl: `/uploads/${name}`,
          purchasePrice: 0,
          markupPercent: 30,
        });
        created.push(p._id);
      } catch (e) { console.warn(`Page ${i + 1}: ${e.message}`); }
    }

    fs.rmSync(outDir, { recursive: true, force: true });
    if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
    res.json({ message: `${created.length} draft products created`, productIds: created });
  } catch (err) {
    try { if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch {}
    try { if (outDir) fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
    res.status(err.message.includes('not installed') ? 503 : 500).json({ message: err.message });
  }
});

// ── PDF: Extract raw images only — download as ZIP, no AI ────────────────────
router.post('/pdf/extract', adminOnly, (req, res, next) => {
  pdfUpload.single('pdf')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `PDF too large. Maximum allowed size is 200 MB. Your file: ${err.field || 'unknown'}.` });
    }
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  const tmpPdf = req.file?.path;
  let outDir;
  try {
    if (!req.file) return res.status(400).json({ message: 'No PDF uploaded' });
    const archiver = requireArchiver();

    const { imagePaths, outDir: od } = await extractPdfPages(tmpPdf);
    outDir = od;
    if (!imagePaths.length) return res.status(400).json({ message: 'No images extracted from PDF' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="pdf-images-${Date.now()}.zip"`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', e => { if (!res.headersSent) res.status(500).json({ message: e.message }); });
    archive.pipe(res);
    imagePaths.forEach((imgPath, i) => {
      archive.file(imgPath, { name: `image-${i + 1}${path.extname(imgPath)}` });
    });
    await archive.finalize();

    res.on('finish', () => {
      try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
      try { if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch {}
    });
  } catch (err) {
    try { if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch {}
    try { if (outDir) fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
    if (!res.headersSent)
      res.status(err.message.includes('not installed') ? 503 : 500).json({ message: err.message });
  }
});

module.exports = router;