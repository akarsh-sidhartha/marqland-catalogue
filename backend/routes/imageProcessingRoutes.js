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
  limits: { fileSize: 50 * 1024 * 1024 },
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
 * Extract embedded images from a PDF.
 * Falls back to page screenshots for scanned PDFs.
 */
async function extractPdfPages(pdfPath) {
  let PDFLib;
  try { PDFLib = require('pdf-lib'); }
  catch { throw new Error('pdf-lib not installed — run: npm install pdf-lib'); }

  const outDir = path.join(tmpDir, `pdf_${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const bytes  = fs.readFileSync(pdfPath);
  const doc    = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  const paths  = [];
  let imgCount = 0;

  console.log(`   PDF has ${doc.getPageCount()} pages — extracting embedded images...`);

  for (let pi = 0; pi < doc.getPageCount(); pi++) {
    const page = doc.getPages()[pi];
    const res  = page.node.get(PDFLib.PDFName.of('Resources'));
    if (!res) continue;
    const xobj = res.get(PDFLib.PDFName.of('XObject'));
    if (!xobj) continue;

    for (const [key, ref] of xobj.entries()) {
      try {
        const stream = doc.context.lookup(ref);
        if (!stream || stream.constructor.name !== 'PDFRawStream') continue;

        const dict    = stream.dict;
        const subtype = dict.get(PDFLib.PDFName.of('Subtype'));
        if (!subtype || subtype.toString() !== '/Image') continue;

        const rawData = stream.getContents();
        if (!rawData || rawData.length < 5000) continue;

        const filter  = dict.get(PDFLib.PDFName.of('Filter'))?.toString() ?? '';
        const width   = dict.get(PDFLib.PDFName.of('Width'))?.value?.()   ?? 0;
        const height  = dict.get(PDFLib.PDFName.of('Height'))?.value?.()  ?? 0;

        let buf, ext;

        if (filter.includes('DCTDecode')) {
          buf = Buffer.from(rawData);
          ext = 'jpg';
        } else if (filter.includes('JPXDecode')) {
          buf = Buffer.from(rawData);
          ext = 'jp2';
        } else {
          if (width < 20 || height < 20) continue;
          const csObj    = dict.get(PDFLib.PDFName.of('ColorSpace'));
          const csName   = csObj?.toString() ?? '/DeviceRGB';
          const channels = csName.includes('Gray') ? 1 : csName.includes('CMYK') ? 4 : 3;
          try {
            buf = await require('sharp')(Buffer.from(rawData), {
              raw: { width, height, channels },
            }).png().toBuffer();
            ext = 'png';
          } catch { continue; }
        }

        if (!buf || buf.length < 1000) continue;

        imgCount++;
        const outPath = path.join(outDir, `img-p${pi+1}-${imgCount}.${ext}`);
        fs.writeFileSync(outPath, buf);
        paths.push(outPath);
        console.log(`   ✅ Image ${imgCount}: page ${pi+1} | ${key} | ${width}x${height} | ${Math.round(buf.length/1024)}KB`);

      } catch (e) {
        console.warn(`   ⚠ Skipping ${key} on page ${pi+1}: ${e.message}`);
      }
    }
  }

  if (paths.length === 0) {
    console.warn('   No embedded images found — falling back to page screenshots');
    try {
      const pdfToImg = require('pdf-to-img');
      const pdfDoc   = await pdfToImg.pdf(pdfPath, { scale: 2 });
      let pn = 1;
      for await (const pb of pdfDoc) {
        const op = path.join(outDir, `page-${pn}.png`);
        fs.writeFileSync(op, pb);
        paths.push(op);
        pn++;
      }
    } catch (e) {
      throw new Error('No embedded images in PDF. Install pdf-to-img for fallback: npm install pdf-to-img');
    }
  }

  console.log(`   Total images ready: ${paths.length}`);
  return { imagePaths: paths, outDir };
}

// ── PDF: Same category — process with AI, save as draft products ──────────────
router.post('/pdf/same-category', adminOnly, pdfUpload.single('pdf'), async (req, res) => {
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
router.post('/pdf/extract', adminOnly, pdfUpload.single('pdf'), async (req, res) => {
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