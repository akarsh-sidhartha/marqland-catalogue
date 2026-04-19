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

// PUT (UPDATE) full client record
router.put('/:id', async (req, res) => {
  try {
    const updatedClient = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedClient);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PATCH — add a single contact to an existing client
// Body: { name, phone, email }
router.patch('/:id/add-contact', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Contact name is required' });

    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Avoid duplicate — check by name (case-insensitive)
    const alreadyExists = client.contacts.some(
      c => c.name?.toLowerCase() === name.trim().toLowerCase()
    );
    if (!alreadyExists) {
      client.contacts.push({ name: name.trim(), phone: phone?.trim() || '', email: email?.trim() || '' });
      await client.save();
    }

    res.json(client);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  await Client.findByIdAndDelete(req.params.id);
  res.json({ message: 'Client Deleted' });
});

// GET /api/clients/lookup?name=Acme — used by OrderTracker after order creation
router.get('/lookup', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: 'name query param required' });
    const client = await Client.findOne({
      companyName: { $regex: new RegExp('^' + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') }
    });
    res.json({ found: !!client, client: client || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;