const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const Product = require('../models/product');
const { processProductImage } = require('../services/imageProcessingService');
const ImagePrompt = require('../models/ImagePrompt');

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

module.exports = router;