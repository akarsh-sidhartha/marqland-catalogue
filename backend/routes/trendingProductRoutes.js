'use strict';
/**
 * backend/routes/trendingProductRoutes.js
 * Mounted at /api/trending-products
 *
 * GET  /                         — list products (paginated, filterable)
 * GET  /stats                    — counts by industry + status
 * GET  /industries               — list all available industries
 * POST /run                      — trigger a manual discovery run (non-blocking)
 * GET  /run/status               — get status of currently running / last run
 * PATCH /:id/status              — update status: reviewed | promoted | dismissed
 * DELETE /:id                    — delete one product
 * DELETE /bulk/dismissed         — purge all dismissed products
 */

const express          = require('express');
const router           = express.Router();
const TrendingProduct  = require('../models/TrendingProduct');
const { runDiscovery, searchByImage, INDUSTRY_QUERIES } = require('../services/trendingProductService');
const { authenticate, authorize }        = require('../middleware/authMiddleware');

const adminOnly = [authenticate, authorize(['admin', 'inventory'])];

// ── Multer — memory storage for image uploads ────────────────────────────────
const multer      = require('multer');
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only')),
});

// ── In-memory run state ───────────────────────────────────────────────────────
// Tracks the currently running / last completed discovery run.
let runState = {
  running:   false,
  startedAt: null,
  progress:  {},      // { [industry]: { done, total, saved } }
  lastResult: null,   // full result object from runDiscovery()
};

// ── GET /api/trending-products ────────────────────────────────────────────────
router.get('/', adminOnly, async (req, res) => {
  try {
    const {
      industry,
      status    = '',
      search    = '',
      page      = '1',
      limit     = '24',
      sort      = 'newest',
    } = req.query;

    const filter = {};
    if (industry && industry !== 'all') filter.industry    = industry;
    if (status       && status       !== 'all') filter.status       = status;
    if (req.query.sourceEngine && req.query.sourceEngine !== 'all') filter.sourceEngine = req.query.sourceEngine;
    if (search) {
      filter.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sourceDomain:{ $regex: search, $options: 'i' } },
      ];
    }

    const skip    = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    const [products, total] = await Promise.all([
      TrendingProduct.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
      TrendingProduct.countDocuments(filter),
    ]);

    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/trending-products/stats ─────────────────────────────────────────
router.get('/stats', adminOnly, async (req, res) => {
  try {
    const [byIndustry, byStatus, total] = await Promise.all([
      TrendingProduct.aggregate([{ $group: { _id: '$industry', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      TrendingProduct.aggregate([{ $group: { _id: '$status',   count: { $sum: 1 } } }]),
      TrendingProduct.countDocuments(),
    ]);
    res.json({ byIndustry, byStatus, total });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/trending-products/industries ─────────────────────────────────────
router.get('/industries', adminOnly, async (req, res) => {
  res.json(Object.keys(INDUSTRY_QUERIES));
});

// ── GET /api/trending-products/run/status ────────────────────────────────────
router.get('/run/status', adminOnly, (req, res) => {
  res.json(runState);
});

// ── POST /api/trending-products/run ──────────────────────────────────────────
// Triggers a non-blocking discovery run. Returns immediately with job ID.
// Poll /run/status for progress.
router.post('/run', adminOnly, async (req, res) => {
  if (runState.running) {
    return res.status(409).json({ message: 'A discovery run is already in progress.', runState });
  }

  const { industries } = req.body; // optional: subset of industries
  const targetIndustries = Array.isArray(industries) && industries.length > 0
    ? industries
    : Object.keys(INDUSTRY_QUERIES);

  runState = { running: true, startedAt: new Date(), progress: {}, lastResult: null };
  res.json({ message: 'Discovery run started.', industries: targetIndustries });

  // Non-blocking — don't await
  runDiscovery(targetIndustries, ({ industry, done, total, saved }) => {
    runState.progress[industry] = { done, total, saved };
  })
    .then(result => {
      runState.running    = false;
      runState.lastResult = result;
    })
    .catch(err => {
      runState.running    = false;
      runState.lastResult = { error: err.message };
      console.error('[TrendingProducts] Manual run failed:', err.message);
    });
});

// ── PATCH /api/trending-products/:id/status ───────────────────────────────────
router.patch('/:id/status', adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['new', 'reviewed', 'promoted', 'dismissed'];
    if (!allowed.includes(status)) return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });

    const product = await TrendingProduct.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/trending-products/bulk/dismissed ─────────────────────────────
router.delete('/bulk/dismissed', adminOnly, async (req, res) => {
  try {
    const result = await TrendingProduct.deleteMany({ status: 'dismissed' });
    res.json({ deleted: result.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/trending-products/:id ────────────────────────────────────────
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await TrendingProduct.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/trending-products/search-by-image ──────────────────────────────
// Upload a product image → Gemini identifies it → Google Image Search finds
// it and similar products → results saved to DB.
// Returns immediately with a jobId; poll /run/status for progress.
//
// Also accepts an optional ?sync=true query param to run synchronously and
// return the full result (useful for small queries, times out ~60s).
router.post('/search-by-image', adminOnly, imageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

  const sync = req.query.sync === 'true';

  if (sync) {
    // Synchronous — wait for full result
    // Set a generous socket timeout so Express does not cut the connection
    // before Gemini + SerpApi finish (can take 60–90 s for 5 queries).
    req.socket.setTimeout(120000);
    res.setTimeout(120000);
    try {
      console.log('[ImageSearch] Starting sync search, file size:', req.file.size, 'mimetype:', req.file.mimetype);
      const result = await searchByImage(req.file.buffer);
      console.log('[ImageSearch] Sync search complete:', result?.saved, 'saved');
      if (!res.headersSent) res.json(result);
    } catch (err) {
      console.error('[ImageSearch] SYNC ERROR:', err.message);
      if (!res.headersSent) res.status(500).json({ message: err.message });
    }
    return;
  }

  // Async (default) — start in background, return immediately
  if (runState.running) {
    return res.status(409).json({ message: 'A discovery run is already in progress.', runState });
  }

  runState = { running: true, startedAt: new Date(), progress: {}, lastResult: null, mode: 'image-search' };
  res.json({ message: 'Image search started. Poll /run/status for progress.' });

  searchByImage(req.file.buffer, ({ stage, message, query }) => {
    runState.progress['Image Search'] = { stage, message, query: query || '' };
  })
    .then(result => {
      runState.running    = false;
      runState.lastResult = result;
    })
    .catch(err => {
      runState.running    = false;
      runState.lastResult = { error: err.message };
      console.error('[ImageSearch] Failed:', err.message);
    });
});

// ── GET /api/trending-products/debug — verify service imports ─────────────────
// Remove this route once everything is working
router.get('/debug', adminOnly, (req, res) => {
  const { runDiscovery, searchByImage, analyseImageWithGemini } = require('../services/trendingProductService');
  res.json({
    runDiscovery:          typeof runDiscovery,
    searchByImage:         typeof searchByImage,
    analyseImageWithGemini: typeof analyseImageWithGemini,
    GEMINI_API_KEY_set:    !!process.env.GEMINI_API_KEY,
    SERPAPI_KEY_set:       !!process.env.SERPAPI_KEY,
    GOOGLE_SEARCH_API_KEY_set: !!process.env.GOOGLE_SEARCH_API_KEY,
  });
});

module.exports = router;