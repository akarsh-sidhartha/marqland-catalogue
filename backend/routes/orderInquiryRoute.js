'use strict';
const express = require('express');
const router = express.Router();
const OrderInquiry = require('../models/orderInquiry');
const ClientPortal = require('../models/ClientPortal');

const {
  buildOrderFolderHierarchy,
  uploadFiles,
  listFolderContents,
  deleteFile,
  deleteFolderByPath,
  renameItem,
  getFolderIdFromUrl,
  getFinancialYear,
} = require('../services/msGraphService');

// ── GET all orders ────────────────────────────────────────────────────────────
// FAST path: returns MongoDB data immediately, NO OneDrive calls.
// Attachments are stored as metadata in the DB (name, type, size + webUrl).
// The frontend loads the live OneDrive folder only when an order is opened.
router.get('/', async (req, res) => {
  try {
    const orders = await OrderInquiry.find().sort({ updatedAt: -1 }).lean();
    // Return stored attachment metadata (name, type, webUrl) without hitting OneDrive.
    // webUrl is persisted on the DB record from the time of upload, so links still work.
    res.json(orders.map(o => ({ ...o, attachments: o.attachments || [] })));
  } catch (err) {
    console.error('Order GET error:', err.message);
    res.status(500).json([]);
  }
});

// ── GET /api/orders/:id/attachments ──────────────────────────────────────────
// Lazy: called only when a specific order is opened in the edit modal.
// Fetches live OneDrive listing for that one order only.
router.get('/:id/attachments', async (req, res) => {
  try {
    const order = await OrderInquiry.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.oneDriveFolderUrl) return res.json([]);

    const folderId = await getFolderIdFromUrl(order.oneDriveFolderUrl).catch(() => null);
    if (!folderId) return res.json(order.attachments || []);

    const files = await listFolderContents(folderId);
    res.json(files.map(f => ({
      name:        f.name,
      size:        f.size,
      webUrl:      f.webUrl,
      downloadUrl: f['@microsoft.graph.downloadUrl'],
      isOneDrive:  true,
    })));
  } catch (err) {
    console.error('Attachment fetch error:', err.message);
    res.json([]); // non-fatal — return empty rather than 500
  }
});

// ── POST create new order ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, clientName, orderPlacedBy, description, refNumber, attachments, orderType } = req.body;

    if (!clientName || !orderPlacedBy) {
      return res.status(400).json({ error: 'Client Name and Contact Person are required.' });
    }

    // Create OneDrive folder and upload attachments (non-blocking on failure)
    const folderLink = await (async () => {
      try {
        const { folderId, folderUrl } = await buildOrderFolderHierarchy(req.body);
        await uploadFiles(folderId, attachments);
        return folderUrl;
      } catch (err) {
        console.error('OneDrive upload failed:', err.message);
        return null;
      }
    })();

    // Strip base64 from attachment records before saving to MongoDB
    const cleanedAttachments = (attachments || []).map(({ name, type, size, lastModified }) => ({
      name, type, size, lastModified,
    }));

    const order = new OrderInquiry({
      title, clientName, orderPlacedBy, description, refNumber,
      orderType: orderType || 'product',
      status: 'inquiry',
      oneDriveFolderUrl: folderLink,
      attachments: cleanedAttachments,
    });

    await order.save();

    // ── Auto-create ClientPortal ─────────────────────────────────────────────
    try {
      const genToken = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let t = '';
        for (let i = 0; i < 5; i++) t += chars[Math.floor(Math.random() * chars.length)];
        return t;
      };
      const baseSlug = (order.refNumber || order._id.toString())
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = `${genToken()}-${baseSlug}`;
      console.log('🔵 Portal slug created:', slug);
      await ClientPortal.create({
        orderId: order._id,
        slug,
        type: order.orderType || 'product',
        orderRef: order.refNumber || '',
        clientName: order.clientName,
        orderPlacedBy: order.orderPlacedBy || '',
        title: order.title || '',
      });
    } catch (portalErr) {
      console.warn('Portal auto-create skipped:', portalErr.message);
    }

    res.status(201).json(order);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Reference number already exists.' });
    console.error('Order POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH update order ────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { attachments, ...updateData } = req.body;
    const existing = await OrderInquiry.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    if (existing.oneDriveFolderUrl) {
      const folderId = await getFolderIdFromUrl(existing.oneDriveFolderUrl).catch(() => null);

      if (folderId) {
        if (updateData.refNumber && updateData.refNumber !== existing.refNumber) {
          const newFolderName = updateData.refNumber.replace(/\//g, '-').trim();
          const newUrl = await renameItem(folderId, newFolderName).catch(() => null);
          if (newUrl) updateData.oneDriveFolderUrl = newUrl;
        }

        if (attachments) {
          const currentFiles = await listFolderContents(folderId).catch(() => []);
          const filesToDelete = currentFiles.filter(f => !attachments.some(a => a.name === f.name));
          for (const f of filesToDelete) await deleteFile(f.id).catch(() => {});

          const newUploads = attachments.filter(a => a.base64);
          if (newUploads.length) await uploadFiles(folderId, newUploads);
        }
      }
    }

    const updated = await OrderInquiry.findByIdAndUpdate(
      req.params.id,
      { ...updateData, updatedAt: Date.now() },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error('Order PATCH error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE order + OneDrive folder ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const order = await OrderInquiry.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.clientName && order.refNumber) {
      const orderDate = new Date(order.createdAt || order.updatedAt || new Date());
      const mo = orderDate.getMonth() + 1;
      const y  = orderDate.getFullYear();
      const sh = n => String(n).slice(-2).padStart(2, '0');
      const fy = mo >= 4 ? `${sh(y)}-${sh(y + 1)}` : `${sh(y - 1)}-${sh(y)}`;

      await deleteFolderByPath([
        'Orders',
        (order.clientName || 'Unknown Client').trim(),
        fy,
        (order.orderPlacedBy || 'General').trim(),
        order.refNumber.replace(/\//g, '-').trim(),
      ]).catch(err => console.error('OneDrive delete error:', err.message));
    }

    await OrderInquiry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    console.error('Order DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;