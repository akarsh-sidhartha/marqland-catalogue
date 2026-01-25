const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const Product = require('../models/product');

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// --- ROUTES ---

// GET Meta data for dropdowns
router.get('/meta', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    const categories = await Product.distinct('category');
    const products = await Product.find({}, 'category subCategory');
    
    const subCategoryMap = {};
    products.forEach(p => {
      if (!subCategoryMap[p.category]) {
        subCategoryMap[p.category] = new Set();
      }
      subCategoryMap[p.category].add(p.subCategory);
    });

    const formattedSubMap = {};
    for (let cat in subCategoryMap) {
      formattedSubMap[cat] = Array.from(subCategoryMap[cat]);
    }

    res.json({ 
      brands, 
      categories, 
      subCategoryMap: formattedSubMap 
    });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// GET all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST Create Product
router.post('/', upload.single('productImage'), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : ''
    };
    
    const product = new Product(productData);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT Update Product
router.put('/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      { 
        markupPercent: req.body.markupPercent,
        description: req.body.description,
        name: req.body.name,
        purchasePrice: req.body.purchasePrice
      },
      { new: true }
    );
    res.json(updatedProduct);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// --- FIXED DELETE ROUTE ---
// Changed from '/api/products/:id' to just '/:id'
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete the physical image file if it exists
    if (product.imageUrl) {
      const relativePath = product.imageUrl.replace(/^\//, ''); 
      const absolutePath = path.join(process.cwd(), 'public', relativePath);

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Product and image deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Server error during deletion" });
  }
});

module.exports = router;