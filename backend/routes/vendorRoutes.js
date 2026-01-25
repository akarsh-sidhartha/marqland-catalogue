const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');

router.get('/', async (req, res) => {
  const vendors = await Vendor.find();
  res.json(vendors);
});

router.post('/', async (req, res) => {
  const vendor = new Vendor(req.body);
  try {
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  await Vendor.findByIdAndDelete(req.params.id);
  res.json({ message: 'Vendor Deleted' });
});

// PUT (UPDATE) vendor
router.put('/:id', async (req, res) => {
  try {
    const updatedVendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedVendor);
  } catch (err) { res.status(400).json({ message: err.message }); }
});
module.exports = router;