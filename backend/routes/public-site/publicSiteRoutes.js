'use strict';
/**
 * backend/routes/publicSiteRoutes.js
 *
 * All routes for www.marqland.com (public site).
 * Mounted at /api in server.js ONLY when hostname is www.marqland.com.
 * Internal /api/* routes are NOT exposed through this file.
 *
 * PUBLIC (no auth):
 *   GET  /api/store              — full data payload for homepage
 *   POST /api/inquiry            — contact form submission
 *
 * ADMIN (JWT + admin role — reuses existing auth middleware):
 *   POST   /api/categories                                — add category
 *   DELETE /api/categories/:catId                         — delete category
 *   PUT    /api/categories/:catId/cover/:imgId            — set cover image
 *   POST   /api/categories/:catId/subcategories           — add subcategory
 *   PUT    /api/categories/:catId/subcategories/:subId    — rename subcategory
 *   DELETE /api/categories/:catId/subcategories/:subId    — delete subcategory
 *   POST   /api/upload/:catId                             — upload images to category
 *   POST   /api/upload/:catId/sub/:subId                  — upload images to subcategory
 *   DELETE /api/images/:catId/:imgId                      — delete image from category
 *   DELETE /api/images/:catId/sub/:subId/:imgId           — delete image from subcategory
 *   PUT    /api/reorder/:catId                            — reorder images in category
 *   PUT    /api/reorder/:catId/sub/:subId                 — reorder images in subcategory
 *   POST   /api/testimonials                              — add testimonial
 *   PUT    /api/testimonials/:id                          — edit testimonial
 *   DELETE /api/testimonials/:id                          — delete testimonial
 *   GET    /api/inquiries                                 — list contact submissions
 *   DELETE /api/inquiries/:id                             — delete inquiry
 *   PATCH  /api/inquiries/:id/read                        — mark inquiry as read
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const sharp    = require('sharp');

const StoreCategory  = require('../../models/public-site/StoreCategory');
const Testimonial    = require('../../models/public-site/Testimonial');
const PublicInquiry  = require('../../models/public-site/PublicInquiry');
const { authenticate, authorize } = require('../../middleware/authMiddleware');

// ── Multer: store uploads in backend/public/uploads/store/ ───────────────────
const storeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'public/uploads/store');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storeStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// ── Helper: build a lean data payload for the public site ────────────────────
const buildStorePayload = async () => {
  const [categories, testimonials, inquiries] = await Promise.all([
    StoreCategory.find().sort({ order: 1, createdAt: 1 }).lean(),
    Testimonial.find().sort({ order: 1, createdAt: 1 }).lean(),
    PublicInquiry.find().sort({ createdAt: -1 }).lean(),
  ]);

  // Shape data to match what the original App.js expects
  const shapedCats = categories.map(cat => ({
    id:            cat._id.toString(),
    name:          cat.name,
    images:        (cat.images || []).sort((a,b) => a.order-b.order).map(img => ({
                     id: img._id.toString(), url: img.url,
                     isCover: img.isCover, aspectRatio: img.aspectRatio,
                   })),
    subcategories: (cat.subcategories || []).sort((a,b) => a.order-b.order).map(sub => ({
                     id:     sub._id.toString(),
                     name:   sub.name,
                     images: (sub.images || []).sort((a,b) => a.order-b.order).map(img => ({
                               id: img._id.toString(), url: img.url,
                               aspectRatio: img.aspectRatio,
                             })),
                   })),
  }));

  const shapedTestimonials = testimonials.map(t => ({
    id: t._id.toString(), author: t.author, company: t.company, role: t.role,
    feedback: t.text, content: t.text,
  }));

  const shapedInquiries = inquiries.map(i => ({
    id: i._id.toString(), name: i.name, company: i.company,
    email: i.email, phone: i.phone, message: i.message,
    read: i.read, createdAt: i.createdAt,
  }));

  return { categories: shapedCats, testimonials: shapedTestimonials, inquiries: shapedInquiries };
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — no auth required
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/store
 * Full payload for the public homepage.
 */
router.get('/store', async (req, res) => {
  try {
    res.json(await buildStorePayload());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/inquiry
 * Contact form submission from the public site.
 */
router.post('/inquiry', async (req, res) => {
  try {
    const { name, company, email, phone, message } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });
    const inq = await PublicInquiry.create({ name, company, email, phone, message });
    res.status(201).json({ message: 'Inquiry received.', id: inq._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — JWT required, admin role only
// ═══════════════════════════════════════════════════════════════════════════

const adminOnly = [authenticate, authorize(['admin'])];

// ── Categories ───────────────────────────────────────────────────────────────

router.post('/categories', adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name required.' });
    const count = await StoreCategory.countDocuments();
    const cat = await StoreCategory.create({ name: name.trim(), order: count });
    res.status(201).json({ id: cat._id, name: cat.name });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/categories/:catId', adminOnly, async (req, res) => {
  try {
    const cat = await StoreCategory.findByIdAndDelete(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    // Delete image files from disk
    (cat.images || []).forEach(img => {
      const fp = path.join(process.cwd(), 'public', img.url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    (cat.subcategories || []).forEach(sub => {
      (sub.images || []).forEach(img => {
        const fp = path.join(process.cwd(), 'public', img.url);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
    });
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/categories/:catId/cover/:imgId', adminOnly, async (req, res) => {
  try {
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    cat.images.forEach(img => { img.isCover = (img._id.toString() === req.params.imgId); });
    await cat.save();
    res.json({ message: 'Cover updated.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Subcategories ─────────────────────────────────────────────────────────────

router.post('/categories/:catId/subcategories', adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name required.' });
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    cat.subcategories.push({ name: name.trim(), order: cat.subcategories.length });
    await cat.save();
    const newSub = cat.subcategories[cat.subcategories.length - 1];
    res.status(201).json({ id: newSub._id, name: newSub.name });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/categories/:catId/subcategories/:subId', adminOnly, async (req, res) => {
  try {
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found.' });
    sub.name = req.body.name?.trim() || sub.name;
    await cat.save();
    res.json({ id: sub._id, name: sub.name });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/categories/:catId/subcategories/:subId', adminOnly, async (req, res) => {
  try {
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found.' });
    // Delete sub images from disk
    (sub.images || []).forEach(img => {
      const fp = path.join(process.cwd(), 'public', img.url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    sub.deleteOne();
    await cat.save();
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Image upload ──────────────────────────────────────────────────────────────

const saveImages = async (cat, subId, files) => {
  const baseOrder = subId
    ? (cat.subcategories.id(subId)?.images?.length || 0)
    : (cat.images?.length || 0);

  const newImages = await Promise.all(files.map(async (file, i) => {
    // Detect aspect ratio using sharp
    let aspectRatio = null;
    try {
      const meta = await sharp(file.path).metadata();
      if (meta.width && meta.height) aspectRatio = meta.width / meta.height;
    } catch { /* non-critical */ }

    return {
      url: `/uploads/store/${file.filename}`,
      filename: file.filename,
      isCover: false,
      aspectRatio,
      order: baseOrder + i,
    };
  }));

  if (subId && subId !== 'generic') {
    const sub = cat.subcategories.id(subId);
    if (!sub) throw new Error('Subcategory not found.');
    sub.images.push(...newImages);
  } else {
    cat.images.push(...newImages);
    // Auto-set cover if this is the first image
    if (cat.images.length === newImages.length) {
      cat.images[0].isCover = true;
    }
  }
};

router.post('/upload/:catId', adminOnly, upload.array('image', 20), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded.' });
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    await saveImages(cat, null, req.files);
    await cat.save();
    res.json({ message: `${req.files.length} image(s) uploaded.` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/upload/:catId/sub/:subId', adminOnly, upload.array('image', 20), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded.' });
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    await saveImages(cat, req.params.subId, req.files);
    await cat.save();
    res.json({ message: `${req.files.length} image(s) uploaded.` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Image deletion ────────────────────────────────────────────────────────────

router.delete('/images/:catId/:imgId', adminOnly, async (req, res) => {
  try {
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    const img = cat.images.id(req.params.imgId);
    if (!img) return res.status(404).json({ message: 'Image not found.' });
    const fp = path.join(process.cwd(), 'public', img.url);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    img.deleteOne();
    await cat.save();
    res.json({ message: 'Image deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/images/:catId/sub/:subId/:imgId', adminOnly, async (req, res) => {
  try {
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found.' });
    const img = sub.images.id(req.params.imgId);
    if (!img) return res.status(404).json({ message: 'Image not found.' });
    const fp = path.join(process.cwd(), 'public', img.url);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    img.deleteOne();
    await cat.save();
    res.json({ message: 'Image deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Image reorder (drag-and-drop) ─────────────────────────────────────────────

router.put('/reorder/:catId', adminOnly, async (req, res) => {
  try {
    const { imageIds } = req.body;
    if (!Array.isArray(imageIds)) return res.status(400).json({ message: 'imageIds array required.' });
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    imageIds.forEach((id, idx) => {
      const img = cat.images.id(id);
      if (img) img.order = idx;
    });
    await cat.save();
    res.json({ message: 'Order updated.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/reorder/:catId/sub/:subId', adminOnly, async (req, res) => {
  try {
    const { imageIds } = req.body;
    if (!Array.isArray(imageIds)) return res.status(400).json({ message: 'imageIds array required.' });
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found.' });
    imageIds.forEach((id, idx) => {
      const img = sub.images.id(id);
      if (img) img.order = idx;
    });
    await cat.save();
    res.json({ message: 'Order updated.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Testimonials ──────────────────────────────────────────────────────────────

router.post('/testimonials', adminOnly, async (req, res) => {
  try {
    const { author, company, role, text } = req.body;
    if (!author?.trim() || !text?.trim()) return res.status(400).json({ message: 'Author and text required.' });
    const count = await Testimonial.countDocuments();
    const t = await Testimonial.create({ author, company, role, text, order: count });
    res.status(201).json({ id: t._id, author: t.author, company: t.company, text: t.text });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/testimonials/:id', adminOnly, async (req, res) => {
  try {
    const { author, company, role, text } = req.body;
    const t = await Testimonial.findByIdAndUpdate(
      req.params.id, { author, company, role, text }, { new: true }
    );
    if (!t) return res.status(404).json({ message: 'Testimonial not found.' });
    res.json({ id: t._id, author: t.author, company: t.company, text: t.text });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/testimonials/:id', adminOnly, async (req, res) => {
  try {
    const t = await Testimonial.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ message: 'Testimonial not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Inquiries ─────────────────────────────────────────────────────────────────

router.get('/inquiries', adminOnly, async (req, res) => {
  try {
    const inquiries = await PublicInquiry.find().sort({ createdAt: -1 }).lean();
    res.json(inquiries.map(i => ({ id: i._id.toString(), ...i })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/inquiries/:id', adminOnly, async (req, res) => {
  try {
    const i = await PublicInquiry.findByIdAndDelete(req.params.id);
    if (!i) return res.status(404).json({ message: 'Inquiry not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/inquiries/:id/read', adminOnly, async (req, res) => {
  try {
    const i = await PublicInquiry.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!i) return res.status(404).json({ message: 'Inquiry not found.' });
    res.json({ id: i._id, read: i.read });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;