'use strict';
const express      = require('express');
const router       = express.Router();
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

// ── GET all orders (with live OneDrive attachment links) ──────────────────────
router.get('/', async (req, res) => {
  try {
    const orders = await OrderInquiry.find().sort({ updatedAt: -1 }).lean();

    const enhanced = await Promise.all(orders.map(async (order) => {
      if (!order.oneDriveFolderUrl) return { ...order, attachments: [] };
      try {
        const folderId = await getFolderIdFromUrl(order.oneDriveFolderUrl);
        if (!folderId) return { ...order, attachments: [] };
        const files = await listFolderContents(folderId);
        return {
          ...order,
          attachments: files.map((f) => ({
            name:        f.name,
            size:        f.size,
            webUrl:      f.webUrl,
            downloadUrl: f['@microsoft.graph.downloadUrl'],
            isOneDrive:  true,
          })),
        };
      } catch {
        return { ...order, attachments: [] };
      }
    }));

    res.json(enhanced);
  } catch (err) {
    console.error('Order GET error:', err.message);
    res.status(500).json([]);
  }
});

// ── POST create new order ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, clientName, orderPlacedBy, description, refNumber, attachments, orderType } = req.body;

    if (!clientName || !orderPlacedBy) {
      return res.status(400).json({ error: 'Client Name and Contact Person are required.' });
    }

    // Create OneDrive folder and upload attachments
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

    // ── Auto-create ClientPortal when order is created ───────────────────────
    // This ensures the portal exists immediately so ProductList / PropertyList
    // can add items to it via usePortalItems hook without waiting for a manual step.
    try {
      const slug = (order.refNumber || order._id.toString())
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await ClientPortal.create({
        orderId:       order._id,
        slug,
        type:          order.orderType || 'product',
        orderRef:      order.refNumber || '',
        clientName:    order.clientName,
        orderPlacedBy: order.orderPlacedBy || '',
        title:         order.title || '',
      });
    } catch (portalErr) {
      // Don't fail the order creation if portal creation fails (e.g. duplicate)
      console.warn('Portal auto-create skipped:', portalErr.message);
    }

    res.status(201).json(order);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Reference number already exists.' });
    console.error('Order POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH update order + handle attachment sync ───────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { attachments, ...updateData } = req.body;
    const existing = await OrderInquiry.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    // ── OneDrive operations ──
    if (existing.oneDriveFolderUrl) {
      const folderId = await getFolderIdFromUrl(existing.oneDriveFolderUrl).catch(() => null);

      if (folderId) {
        // Rename folder if refNumber changed
        if (updateData.refNumber && updateData.refNumber !== existing.refNumber) {
          const newFolderName = updateData.refNumber.replace(/\//g, '-').trim();
          const newUrl = await renameItem(folderId, newFolderName).catch(() => null);
          if (newUrl) updateData.oneDriveFolderUrl = newUrl;
        }

        // Sync attachments: delete removed, upload new
        if (attachments) {
          const currentFiles  = await listFolderContents(folderId).catch(() => []);
          const filesToDelete = currentFiles.filter((f) => !attachments.some((a) => a.name === f.name));
          for (const f of filesToDelete) await deleteFile(f.id).catch(() => {});

          const newUploads = attachments.filter((a) => a.base64);
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

    // Delete the OneDrive folder
    if (order.clientName && order.refNumber) {
      const orderDate = new Date(order.createdAt || order.updatedAt || new Date());
      const mo = orderDate.getMonth() + 1;
      const y  = orderDate.getFullYear();
      const sh = (n) => String(n).slice(-2).padStart(2, '0');
      const fy = mo >= 4 ? `${sh(y)}-${sh(y + 1)}` : `${sh(y - 1)}-${sh(y)}`;

      await deleteFolderByPath([
        'Orders',
        (order.clientName    || 'Unknown Client').trim(),
        fy,
        (order.orderPlacedBy || 'General').trim(),
        order.refNumber.replace(/\//g, '-').trim(),
      ]).catch((err) => console.error('OneDrive delete error:', err.message));
    }

    await OrderInquiry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    console.error('Order DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;