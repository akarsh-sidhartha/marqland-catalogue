const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const Product = require('../models/product');
const { processProductImage } = require('../services/imageProcessingService');
const ImagePrompt = require('../models/ImagePrompt');

// ─── Image gallery helpers ────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function downloadAndSave(remoteUrl) {
  const res = await axios.get(remoteUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ProductGalleryBot/1.0)',
      Accept: 'image/*,*/*',
    },
    maxContentLength: 10 * 1024 * 1024,
  });
  const contentType = res.headers['content-type'] || '';
  if (!contentType.startsWith('image/')) throw new Error(`Not an image: ${contentType}`);
  const processed = await sharp(Buffer.from(res.data))
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
  const filename = `gallery-${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), processed);
  return `/uploads/${filename}`;
}


// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/';
    // Ensure directory exists to prevent 500 errors on save
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

// --- ROUTES ---

// GET Meta
router.get('/meta', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    const categories = await Product.distinct('category');
    const products = await Product.find({}, 'category subCategory');
    const subCategories = {};
    products.forEach(p => {
      if (p.category && p.subCategory) {
        if (!subCategories[p.category]) subCategories[p.category] = [];
        if (!subCategories[p.category].includes(p.subCategory)) {
          subCategories[p.category].push(p.subCategory);
        }
      }
    });
    res.json({ brands, categories, subCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ updatedAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// GET single product by ID (used by ProductImageGallery to refresh after changes)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const productData = { ...req.body, imageUrl };
    const product    = new Product(productData);
    const newProduct = await product.save();

    // Respond immediately — image processing runs in background
    res.status(201).json(newProduct);

    // ── Background image processing ─────────────────────────────────────────
    if (req.file && req.body.processImage === 'true') {
      setImmediate(async () => {
        try {
          const { promptId, promptText, category } = req.body;

          // Resolve prompt: explicit text > saved prompt by ID > category default
          let finalPrompt = promptText?.trim() || null;
          if (!finalPrompt && promptId) {
            const saved = await ImagePrompt.findById(promptId);
            if (saved) finalPrompt = saved.prompt;
          }
          if (!finalPrompt) {
            const def = await ImagePrompt.findOne({ category, isDefault: true });
            if (def) finalPrompt = def.prompt;
          }

          const inputPath  = path.join(process.cwd(), 'public', imageUrl);
          const inputBuf   = require('fs').readFileSync(inputPath);
          const processed  = await processProductImage(inputBuf, { category, promptText: finalPrompt });
          const newFilename = imageUrl.replace(/\.[^.]+$/, '-proc.webp');
          const outputPath  = path.join(process.cwd(), 'public', newFilename);
          require('fs').writeFileSync(outputPath, processed);
          await Product.findByIdAndUpdate(newProduct._id, { imageUrl: newFilename });
          console.log(`✅ Image processed for: ${newProduct.name}`);
        } catch (e) {
          console.error(`❌ Image processing failed for ${newProduct._id}:`, e.message);
        }
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE (FIXED LOGIC)
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const productId = req.params.id;
    
    // 1. Find existing product first
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 2. Build the update object
    const updateData = {
      name: req.body.name || existingProduct.name,
      description: req.body.description || existingProduct.description,
      brand: req.body.brand || existingProduct.brand,
      category: req.body.category || existingProduct.category,
      subCategory: req.body.subCategory || existingProduct.subCategory,
      markupPercent: req.body.markupPercent !== undefined ? Number(req.body.markupPercent) : existingProduct.markupPercent,
      purchasePrice: req.body.purchasePrice !== undefined ? Number(req.body.purchasePrice) : existingProduct.purchasePrice,
    };

    // 3. Handle Image Logic: Only update if a NEW file is provided
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
      
      // Optional: Delete old image file from server to save space
      if (existingProduct.imageUrl) {
        const oldPath = path.join(process.cwd(), 'public', existingProduct.imageUrl);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) { console.error("Cleanup failed:", e); }
        }
      }
    } else {
      // Keep existing image if no new one is uploaded
      updateData.imageUrl = existingProduct.imageUrl;
    }

    // 4. Update
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Respond immediately
    res.json(updatedProduct);

    // ── Background image processing ─────────────────────────────────────────
    if (req.file && req.body.processImage === 'true') {
      setImmediate(async () => {
        try {
          const newImageUrl = updateData.imageUrl;
          const { promptId, promptText } = req.body;
          const category = updatedProduct.category;

          let finalPrompt = promptText?.trim() || null;
          if (!finalPrompt && promptId) {
            const saved = await ImagePrompt.findById(promptId);
            if (saved) finalPrompt = saved.prompt;
          }
          if (!finalPrompt) {
            const def = await ImagePrompt.findOne({ category, isDefault: true });
            if (def) finalPrompt = def.prompt;
          }

          const inputPath  = path.join(process.cwd(), 'public', newImageUrl);
          const inputBuf   = require('fs').readFileSync(inputPath);
          const processed  = await processProductImage(inputBuf, { category, promptText: finalPrompt });
          const newFilename = newImageUrl.replace(/\.[^.]+$/, '-proc.webp');
          const outputPath  = path.join(process.cwd(), 'public', newFilename);
          require('fs').writeFileSync(outputPath, processed);
          await Product.findByIdAndUpdate(productId, { imageUrl: newFilename });
          console.log(`✅ Image processed for: ${updatedProduct.name}`);
        } catch (e) {
          console.error(`❌ Image processing failed for ${productId}:`, e.message);
        }
      });
    }
  } catch (err) {
    console.error("PUT Error:", err);
    res.status(500).json({ message: "Server error during update", error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.imageUrl) {
      const absolutePath = path.join(process.cwd(), 'public', product.imageUrl);
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// ─── POST /:id/image-search — Serper reverse image search ────────────────────
router.post('/:id/image-search', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return res.status(503).json({ message: 'SERPER_API_KEY not configured in .env' });

    const query = req.body.query?.trim()
      || [product.brand, product.name, product.category].filter(Boolean).join(' ');

    const serperRes = await axios.post(
      'https://google.serper.dev/images',
      { q: query, num: 20, gl: 'in', hl: 'en' },
      { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );

    const rawImages = serperRes.data?.images || [];
    const results = rawImages
      .filter(img => img.imageUrl && img.imageUrl.startsWith('http'))
      .map(img => ({
        url:       img.imageUrl,
        thumbnail: img.thumbnailUrl || img.imageUrl,
        source:    img.source || img.link || '',
        title:     img.title || '',
        width:     img.imageWidth  || null,
        height:    img.imageHeight || null,
      }));

    res.json({ query, results });
  } catch (err) {
    const status  = err.response?.status;
    const serperMsg = err.response?.data?.message
      || (typeof err.response?.data === 'string' ? err.response.data : null)
      || err.message;

    console.error('[image-search] Serper error:', status, serperMsg);

    if (status === 401 || status === 403) {
      return res.status(500).json({
        message: `Serper API key rejected (${status}). Check SERPER_API_KEY in your .env file. Get a free key at https://serper.dev`,
      });
    }
    res.status(500).json({ message: serperMsg });
  }
});

// ─── POST /:id/save-images — download & persist selected URLs ─────────────────
router.post('/:id/save-images', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const urls = req.body.urls || [];
    if (!Array.isArray(urls) || urls.length === 0)
      return res.status(400).json({ message: 'urls array is required' });

    const saved = [], failed = [];
    for (const url of urls) {
      try { saved.push(await downloadAndSave(url)); }
      catch (e) { failed.push({ url, reason: e.message }); }
    }

    const existing = product.additionalImages || [];
    const next = [...existing, ...saved].slice(0, 30);
    await Product.findByIdAndUpdate(req.params.id, { additionalImages: next });

    res.json({ saved, failed, total: next.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /:id/images/:index — remove one gallery image ────────────────────
router.delete('/:id/images/:index', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const idx = parseInt(req.params.index, 10);
    const imgs = [...(product.additionalImages || [])];
    if (idx < 0 || idx >= imgs.length)
      return res.status(400).json({ message: 'Invalid index' });

    const imgPath = imgs[idx];
    if (imgPath?.startsWith('/uploads/')) {
      const abs = path.join(process.cwd(), 'public', imgPath);
      if (fs.existsSync(abs)) { try { fs.unlinkSync(abs); } catch {} }
    }

    imgs.splice(idx, 1);
    await Product.findByIdAndUpdate(req.params.id, { additionalImages: imgs });
    res.json({ additionalImages: imgs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /:id/primary-image/:index — promote gallery image to primary ─────────
router.put('/:id/primary-image/:index', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const idx = parseInt(req.params.index, 10);
    const imgs = [...(product.additionalImages || [])];
    if (idx < 0 || idx >= imgs.length)
      return res.status(400).json({ message: 'Invalid index' });

    const newPrimary = imgs[idx];
    const oldPrimary = product.imageUrl;
    imgs[idx] = oldPrimary || '';
    const filtered = imgs.filter(Boolean);

    await Product.findByIdAndUpdate(req.params.id, {
      imageUrl: newPrimary,
      additionalImages: filtered,
    });

    res.json({ imageUrl: newPrimary, additionalImages: filtered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /:id/video — save video URL ─────────────────────────────────────────
router.put('/:id/video', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { videoUrl: req.body.videoUrl?.trim() || '' },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ videoUrl: product.videoUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─── POST /:id/upload-images — direct multi-file upload to gallery ─────────────
router.post('/:id/upload-images', upload.array('images', 20), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: 'No images uploaded' });

    const saved = [];
    for (const file of req.files) {
      try {
        // Normalise to webp for consistency
        const processed = await sharp(file.path)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 88 })
          .toBuffer();
        const newFilename = file.filename.replace(/\.[^.]+$/, '') + '-gallery.webp';
        const outPath = path.join(process.cwd(), 'public', 'uploads', newFilename);
        fs.writeFileSync(outPath, processed);
        try { fs.unlinkSync(file.path); } catch {}  // remove multer temp file
        saved.push('/uploads/' + newFilename);
      } catch (e) {
        console.warn('Image normalise failed, keeping original:', e.message);
        saved.push('/uploads/' + file.filename);
      }
    }

    const existing = product.additionalImages || [];
    const next = [...existing, ...saved].slice(0, 30);
    await Product.findByIdAndUpdate(req.params.id, { additionalImages: next });
    res.json({ saved, total: next.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─── POST /products/upload-temp-image — upload image for discussion-only items ─
// Not linked to any Product doc. Returns { imageUrl } for use in portal items.
router.post('/upload-temp-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const processed = await sharp(req.file.path)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    const newFilename = req.file.filename.replace(/\.[^.]+$/, '') + '-custom.webp';
    const outPath = path.join(process.cwd(), 'public', 'uploads', newFilename);
    fs.writeFileSync(outPath, processed);
    try { fs.unlinkSync(req.file.path); } catch {}
    res.json({ imageUrl: '/uploads/' + newFilename });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;