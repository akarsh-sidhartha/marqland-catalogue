'use strict';
/**
 * backend/routes/public-site/publicSiteRoutes.js
 *
 * All routes for www.marqland.com (public site).
 * Mounted at /api/public-site in server.js.
 *
 * PUBLIC (no auth):
 *   GET  /store              — full data payload for homepage
 *   POST /inquiry            — contact form submission
 *
 * ADMIN (JWT + admin role):
 *   POST   /categories                                — add category
 *   DELETE /categories/:catId                         — delete category
 *   PUT    /categories/:catId/cover/:imgId            — set cover image
 *   POST   /categories/:catId/subcategories           — add subcategory
 *   PUT    /categories/:catId/subcategories/:subId    — rename subcategory
 *   DELETE /categories/:catId/subcategories/:subId    — delete subcategory
 *   POST   /upload/:catId                             — upload images to category
 *   POST   /upload/:catId/sub/:subId                  — upload images to subcategory
 *   DELETE /images/:catId/:imgId                      — delete image from category
 *   DELETE /images/:catId/sub/:subId/:imgId           — delete image from subcategory
 *   PUT    /reorder/:catId                            — reorder images in category
 *   PUT    /reorder/:catId/sub/:subId                 — reorder images in subcategory
 *   POST   /testimonials                              — add testimonial (with optional photo)
 *   PUT    /testimonials/:id                          — edit testimonial
 *   DELETE /testimonials/:id                          — delete testimonial
 *   GET    /inquiries                                 — list contact submissions
 *   DELETE /inquiries/:id                             — delete inquiry
 *   PATCH  /inquiries/:id/read                        — mark inquiry as read
 *
 * UPLOAD STRUCTURE:
 *   Category images (no subcategory):
 *     uploads/publicApp/category/<CategoryName>/filename
 *   Subcategory images:
 *     uploads/publicApp/category/<CategoryName>/<SubcategoryName>/filename
 *   Testimonial person photos:
 *     uploads/publicApp/testimonials/filename
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

// ─── Upload directory helpers ─────────────────────────────────────────────────
const PUBLIC_APP_BASE = path.join(process.cwd(), 'public', 'uploads', 'publicApp');

/**
 * Sanitise a name to a safe folder name.
 * e.g. "Home Appliances" → "Home_Appliances"
 */
function safeName(name) {
  return (name || 'uncategorised')
    .trim()
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Get (and create) the upload dir for a category image.
 * uploads/publicApp/category/<CategoryName>/
 */
function getCategoryDir(categoryName) {
  const dir = path.join(PUBLIC_APP_BASE, 'category', safeName(categoryName));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get (and create) the upload dir for a subcategory image.
 * uploads/publicApp/category/<CategoryName>/<SubcategoryName>/
 */
function getSubcategoryDir(categoryName, subcategoryName) {
  const dir = path.join(PUBLIC_APP_BASE, 'category', safeName(categoryName), safeName(subcategoryName));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get (and create) the upload dir for testimonial photos.
 * uploads/publicApp/testimonials/
 */
function getTestimonialDir() {
  const dir = path.join(PUBLIC_APP_BASE, 'testimonials');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCategoryUrl(categoryName, filename) {
  return `/uploads/publicApp/category/${safeName(categoryName)}/${filename}`;
}

function getSubcategoryUrl(categoryName, subcategoryName, filename) {
  return `/uploads/publicApp/category/${safeName(categoryName)}/${safeName(subcategoryName)}/${filename}`;
}

function getTestimonialUrl(filename) {
  return `/uploads/publicApp/testimonials/${filename}`;
}

// ─── MULTER — memory storage (destination resolved per-request) ───────────────
// We use memoryStorage because the destination depends on the category/subcategory
// name which must be looked up from MongoDB AFTER multer runs.
// Files are written to disk manually in the route handler.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const testimonialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

/**
 * Save a buffer to disk and return the filename.
 * Normalises to WebP via sharp for consistent quality and smaller file size.
 */
async function saveImageBuffer(buffer, destDir, originalName) {
  const unique    = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const filename  = `${unique}.webp`;
  const outPath   = path.join(destDir, filename);
  await sharp(buffer)
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(outPath);
  return filename;
}

/**
 * Get aspect ratio from an image buffer.
 */
async function getAspectRatio(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width && meta.height) return meta.width / meta.height;
  } catch { /* non-critical */ }
  return null;
}

// ─── Helper: build lean payload for public site ───────────────────────────────
const buildStorePayload = async () => {
  const [categories, testimonials, inquiries] = await Promise.all([
    StoreCategory.find().sort({ order: 1, createdAt: 1 }).lean(),
    Testimonial.find().sort({ order: 1, createdAt: 1 }).lean(),
    PublicInquiry.find().sort({ createdAt: -1 }).lean(),
  ]);

  const shapedCats = categories.map(cat => ({
    id:            cat._id.toString(),
    name:          cat.name,
    images:        (cat.images || []).sort((a, b) => a.order - b.order).map(img => ({
                     id: img._id.toString(), url: img.url,
                     isCover: img.isCover, aspectRatio: img.aspectRatio,
                   })),
    subcategories: (cat.subcategories || []).sort((a, b) => a.order - b.order).map(sub => ({
                     id:     sub._id.toString(),
                     name:   sub.name,
                     images: (sub.images || []).sort((a, b) => a.order - b.order).map(img => ({
                               id: img._id.toString(), url: img.url,
                               aspectRatio: img.aspectRatio,
                             })),
                   })),
  }));

  const shapedTestimonials = testimonials.map(t => ({
    id:       t._id.toString(),
    author:   t.author,
    company:  t.company,
    role:     t.role,
    feedback: t.text,
    content:  t.text,
    imageUrl: t.imageUrl || '',
  }));

  const shapedInquiries = inquiries.map(i => ({
    id: i._id.toString(), name: i.name, company: i.company,
    email: i.email, phone: i.phone, message: i.message,
    hearAbout: i.hearAbout, read: i.read, createdAt: i.createdAt,
  }));

  return { categories: shapedCats, testimonials: shapedTestimonials, inquiries: shapedInquiries };
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — no auth required
// ═══════════════════════════════════════════════════════════════════════════

router.get('/store', async (req, res) => {
  try {
    res.json(await buildStorePayload());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/inquiry', async (req, res) => {
  try {
    const { name, company, email, phone, message, hearAbout } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });
    const inq = await PublicInquiry.create({ name, company, email, phone, message, hearAbout });
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
    // Delete all image files from disk
    (cat.images || []).forEach(img => {
      const fp = path.join(process.cwd(), 'public', img.url);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
    });
    (cat.subcategories || []).forEach(sub => {
      (sub.images || []).forEach(img => {
        const fp = path.join(process.cwd(), 'public', img.url);
        try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
      });
    });
    // Remove category folder if empty
    try {
      const catDir = getCategoryDir(cat.name);
      if (fs.existsSync(catDir) && fs.readdirSync(catDir).length === 0) {
        fs.rmdirSync(catDir);
      }
    } catch {}
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
    (sub.images || []).forEach(img => {
      const fp = path.join(process.cwd(), 'public', img.url);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
    });
    sub.deleteOne();
    await cat.save();
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Image upload ──────────────────────────────────────────────────────────────

/**
 * POST /upload/:catId
 * Upload images directly to a category folder.
 * Looks up category name from DB to build the correct path.
 */
router.post('/upload/:catId', adminOnly, upload.array('image', 20), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded.' });
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });

    const destDir   = getCategoryDir(cat.name);
    const baseOrder = cat.images?.length || 0;

    const newImages = await Promise.all(req.files.map(async (file, i) => {
      const aspectRatio = await getAspectRatio(file.buffer);
      const filename    = await saveImageBuffer(file.buffer, destDir, file.originalname);
      return {
        url:         getCategoryUrl(cat.name, filename),
        filename,
        isCover:     false,
        aspectRatio,
        order:       baseOrder + i,
      };
    }));

    cat.images.push(...newImages);
    // Auto-set cover if first image
    if (cat.images.length === newImages.length) cat.images[0].isCover = true;
    await cat.save();
    res.json({ message: `${req.files.length} image(s) uploaded.` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/**
 * POST /upload/:catId/sub/:subId
 * Upload images to a subcategory folder.
 * Looks up both category and subcategory names to build the correct path.
 */
router.post('/upload/:catId/sub/:subId', adminOnly, upload.array('image', 20), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded.' });
    const cat = await StoreCategory.findById(req.params.catId);
    if (!cat) return res.status(404).json({ message: 'Category not found.' });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found.' });

    const destDir   = getSubcategoryDir(cat.name, sub.name);
    const baseOrder = sub.images?.length || 0;

    const newImages = await Promise.all(req.files.map(async (file, i) => {
      const aspectRatio = await getAspectRatio(file.buffer);
      const filename    = await saveImageBuffer(file.buffer, destDir, file.originalname);
      return {
        url:         getSubcategoryUrl(cat.name, sub.name, filename),
        filename,
        isCover:     false,
        aspectRatio,
        order:       baseOrder + i,
      };
    }));

    sub.images.push(...newImages);
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
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
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
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
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

/**
 * POST /testimonials
 * Accepts multipart/form-data: author, company, role, text, photo (optional image)
 */
router.post('/testimonials', adminOnly, testimonialUpload.single('photo'), async (req, res) => {
  try {
    const { author, company, role, text } = req.body;
    if (!author?.trim() || !text?.trim())
      return res.status(400).json({ message: 'Author and text required.' });

    let imageUrl = '';
    if (req.file) {
      const destDir  = getTestimonialDir();
      const filename = await saveImageBuffer(req.file.buffer, destDir, req.file.originalname);
      imageUrl = getTestimonialUrl(filename);
    }

    const count = await Testimonial.countDocuments();
    const t = await Testimonial.create({ author, company, role, text, imageUrl, order: count });
    res.status(201).json({
      id: t._id, author: t.author, company: t.company,
      role: t.role, text: t.text, imageUrl: t.imageUrl,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/**
 * PUT /testimonials/:id
 * Accepts multipart/form-data or JSON.
 * If a new photo is uploaded, old photo is deleted from disk.
 */
router.put('/testimonials/:id', adminOnly, testimonialUpload.single('photo'), async (req, res) => {
  try {
    const { author, company, role, text } = req.body;
    const existing = await Testimonial.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Testimonial not found.' });

    let imageUrl = existing.imageUrl;
    if (req.file) {
      // Delete old photo if it exists
      if (existing.imageUrl) {
        const oldPath = path.join(process.cwd(), 'public', existing.imageUrl);
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
      }
      const destDir  = getTestimonialDir();
      const filename = await saveImageBuffer(req.file.buffer, destDir, req.file.originalname);
      imageUrl = getTestimonialUrl(filename);
    }

    const t = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { author, company, role, text, imageUrl },
      { new: true }
    );
    res.json({
      id: t._id, author: t.author, company: t.company,
      role: t.role, text: t.text, imageUrl: t.imageUrl,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/testimonials/:id', adminOnly, async (req, res) => {
  try {
    const t = await Testimonial.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ message: 'Testimonial not found.' });
    // Delete photo from disk
    if (t.imageUrl) {
      const fp = path.join(process.cwd(), 'public', t.imageUrl);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
    }
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