const express = require('express');
const router = express.Router();
const Client = require('../models/Client');

router.get('/', async (req, res) => {
  const clients = await Client.find();
  res.json(clients);
});

router.post('/', async (req, res) => {
  const client = new Client(req.body);
  try {
    await client.save();
    res.status(201).json(client);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PUT (UPDATE) client
router.put('/:id', async (req, res) => {
  try {
    const updatedClient = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedClient);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  await Client.findByIdAndDelete(req.params.id);
  res.json({ message: 'Client Deleted' });
});

// GET /api/clients/lookup?name=Acme  — used by OrderTracker after order creation
router.get('/lookup', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: 'name query param required' });
    // Case-insensitive exact match on companyName
    const client = await Client.findOne({
      companyName: { $regex: new RegExp('^' + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') }
    });
    res.json({ found: !!client, client: client || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;