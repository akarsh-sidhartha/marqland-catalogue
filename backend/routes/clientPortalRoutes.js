'use strict';
/**
 * backend/routes/clientPortalRoutes.js
 *
 * Mounted at /api/portal
 *
 * TEAM (authenticated):
 *   POST   /api/portal              — create portal for an order
 *   GET    /api/portal/order/:id    — get portal by orderId (team view)
 *   PUT    /api/portal/:slug/items  — replace items array
 *   PUT    /api/portal/:slug/meta   — update teamNote, clientEmail, reviewLink
 *   POST   /api/portal/:slug/message/team — team sends a message
 *   PUT    /api/portal/:slug/complete     — mark completed
 *   DELETE /api/portal/:slug        — delete portal
 *
 * PUBLIC (no auth — client facing):
 *   GET    /api/portal/public/:slug          — get portal data for client
 *   POST   /api/portal/public/:slug/message  — client sends a message
 *   POST   /api/portal/public/:slug/view     — record a view (analytics)
 */

const express        = require('express');
const router         = express.Router();
const ClientPortal   = require('../models/ClientPortal');
const Product        = require('../models/product'); // for category enrichment
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');

// ── File upload for message attachments ────────────────────────────────────────
const msgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'public/uploads/portal');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const uploadMsg = multer({ storage: msgStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Helper ────────────────────────────────────────────────────────────────────
const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM ROUTES (require auth middleware in server.js)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/portal
 * Create a new client portal for an order.
 * Called automatically when an order is created, or manually.
 */
router.post('/', async (req, res) => {
  try {
    const { orderId, type, orderRef, clientName, clientEmail, title } = req.body;

    if (!orderId || !type || !orderRef) {
      return res.status(400).json({ message: 'orderId, type, and orderRef are required.' });
    }

    // Check if portal already exists for this order
    const existing = await ClientPortal.findOne({ orderId });
    if (existing) return res.status(409).json({ message: 'Portal already exists.', portal: existing });

    const slug = slugify(orderRef);

    const portal = new ClientPortal({
      orderId,
      slug,
      type,
      orderRef,
      clientName,
      clientEmail,
      title,
    });
    await portal.save();

    res.status(201).json(portal);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Slug already exists.' });
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/portal
 * List all portals, optionally filtered by type and/or status.
 * Used by usePortalItems hook to show active portals when adding items.
 * Query params: ?type=product|offsite  &status=active|completed
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type)   filter.type   = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    const portals = await ClientPortal.find(filter)
      .select('slug type orderRef clientName title status productItems offsiteItems')
      .sort({ createdAt: -1 });
    res.json(portals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/portal?type=product&status=active
 * List portals — used by usePortalItems hook when adding items from ProductList/PropertyList.
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type)   filter.type   = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    const portals = await ClientPortal.find(filter)
      .select('slug type orderRef clientName title status productItems offsiteItems')
      .sort({ createdAt: -1 });
    res.json(portals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/portal/order/:orderId
 * Get portal by order ID — used by team editor.
 */
router.get('/order/:orderId', async (req, res) => {
  try {
    const portal = await ClientPortal.findOne({ orderId: req.params.orderId });
    if (!portal) return res.status(404).json({ message: 'No portal for this order yet.' });
    res.json(portal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/portal/:slug/items
 * Replace the full items array. Accepts productItems or offsiteItems
 * depending on portal type.
 */
router.put('/:slug/items', async (req, res) => {
  try {
    const { productItems, offsiteItems } = req.body;
    const portal = await ClientPortal.findOne({ slug: req.params.slug });
    if (!portal) return res.status(404).json({ message: 'Portal not found.' });

    if (portal.type === 'product' && productItems) portal.productItems = productItems;
    if (portal.type === 'offsite' && offsiteItems) portal.offsiteItems = offsiteItems;

    await portal.save();
    res.json(portal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/portal/:slug/meta
 * Update portal metadata: teamNote, clientEmail, title, reviewLink.
 */
router.put('/:slug/meta', async (req, res) => {
  try {
    const { teamNote, clientEmail, title, reviewLink } = req.body;
    const portal = await ClientPortal.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: { teamNote, clientEmail, title, reviewLink } },
      { new: true }
    );
    if (!portal) return res.status(404).json({ message: 'Portal not found.' });
    res.json(portal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/portal/:slug/message/team
 * Team member sends a message (with optional file attachments).
 * Accepts multipart/form-data: text, senderName, files[]
 */
router.post('/:slug/message/team', uploadMsg.array('files', 5), async (req, res) => {
  try {
    const { text, senderName } = req.body;
    if (!text?.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: 'Message text or attachment required.' });
    }

    const attachments = (req.files || []).map(f => ({
      name:     f.originalname,
      url:      `/uploads/portal/${f.filename}`,
      mimeType: f.mimetype,
      size:     f.size,
    }));

    const portal = await ClientPortal.findOneAndUpdate(
      { slug: req.params.slug },
      { $push: { messages: {
          sender:      'team',
          senderName:  senderName || 'Marqland Team',
          text:        text?.trim() || '',
          attachments,
      }}},
      { new: true }
    );
    if (!portal) return res.status(404).json({ message: 'Portal not found.' });
    res.json(portal.messages[portal.messages.length - 1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/portal/:slug/complete
 * Mark order as completed. Shows thank you screen to client.
 */
router.put('/:slug/complete', async (req, res) => {
  try {
    const { reviewLink } = req.body;
    const portal = await ClientPortal.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: { status: 'completed', completedAt: new Date(), ...(reviewLink && { reviewLink }) } },
      { new: true }
    );
    if (!portal) return res.status(404).json({ message: 'Portal not found.' });
    res.json(portal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/portal/:slug
 */
router.delete('/:slug', async (req, res) => {
  try {
    await ClientPortal.findOneAndDelete({ slug: req.params.slug });
    res.json({ message: 'Portal deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — no auth, client-facing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/portal/public/:slug
 * Returns portal data for the client view.
 * Strips internal fields (orderId, clientEmail etc.)
 */
router.get('/public/:slug', async (req, res) => {
  try {
    const portal = await ClientPortal.findOne({ slug: req.params.slug }).lean();
    if (!portal) return res.status(404).json({ message: 'This link is invalid or has expired.' });

    // ── Enrich productItems that are missing category/subCategory ────────────
    // Handles items added before the fix — looks up the original Product document
    // using the stored productId and backfills category + subCategory on-the-fly.
    // Does NOT modify MongoDB — enrichment is only applied to the response.
    let productItems = portal.productItems || [];
    if (productItems.length > 0) {
      const missingCatIds = productItems
        .filter(i => !i.category && i.productId)
        .map(i => i.productId);

      if (missingCatIds.length > 0) {
        const products = await Product.find(
          { _id: { $in: missingCatIds } },
          'category subCategory'
        ).lean();
        const productMap = {};
        products.forEach(p => { productMap[p._id.toString()] = p; });

        productItems = productItems.map(item => {
          if (!item.category && item.productId && productMap[item.productId]) {
            const src = productMap[item.productId];
            return {
              ...item,
              category:    src.category    || '',
              subCategory: src.subCategory || '',
            };
          }
          return item;
        });
      }
    }

    const clientData = {
      slug:          portal.slug,
      type:          portal.type,
      orderRef:      portal.orderRef,
      clientName:    portal.clientName,
      orderPlacedBy: portal.orderPlacedBy || '',
      title:         portal.title,
      teamNote:      portal.teamNote,
      productItems,
      offsiteItems:  portal.offsiteItems || [],
      messages:      portal.messages     || [],
      status:        portal.status,
      completedAt:   portal.completedAt,
      reviewLink:    portal.reviewLink,
    };

    res.json(clientData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/portal/public/:slug/message
 * Client sends a message (with optional file attachments).
 * Accepts multipart/form-data: text, senderName, files[]
 */
router.post('/public/:slug/message', uploadMsg.array('files', 5), async (req, res) => {
  try {
    const { text, senderName } = req.body;
    if (!text?.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: 'Message text or attachment required.' });
    }

    const portal = await ClientPortal.findOne({ slug: req.params.slug });
    if (!portal) return res.status(404).json({ message: 'Portal not found.' });
    if (portal.status === 'completed') return res.status(400).json({ message: 'This order is completed.' });

    const attachments = (req.files || []).map(f => ({
      name:     f.originalname,
      url:      `/uploads/portal/${f.filename}`,
      mimeType: f.mimetype,
      size:     f.size,
    }));

    portal.messages.push({
      sender:      'client',
      senderName:  senderName || portal.clientName || 'Client',
      text:        text?.trim() || '',
      attachments,
    });
    await portal.save();
    res.json(portal.messages[portal.messages.length - 1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/portal/public/:slug/view
 * Track that client opened the page (analytics).
 */
router.post('/public/:slug/view', async (req, res) => {
  try {
    await ClientPortal.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // silent fail — analytics should never error
  }
});

/**
 * POST /api/portal/send-email
 * Sends the portal link to the client by email.
 * Body: { slug, clientEmail, contactName, clientName, orderRef, title, portalUrl }
 *   contactName = the individual person's name (orderPlacedBy)
 *   clientName  = company name
 */
router.post('/send-email', async (req, res) => {
  try {
    const { slug, clientEmail, contactName, clientName, orderRef, title, portalUrl } = req.body;
    if (!clientEmail) return res.status(400).json({ message: 'clientEmail required' });

    const nodemailer  = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const url = portalUrl || `${process.env.APP_URL || 'http://localhost:3000'}/p/${slug}`;
    // Greet the individual contact person, not the company
    const greetName = contactName || clientName || 'there';

    await transporter.sendMail({
      from:    `"Marqland Studios" <${process.env.EMAIL_USER}>`,
      to:      clientEmail,
      subject: `Marqland Studios - Your Curated Options — ${orderRef}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;background:#f4f1ea;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <div style="background:#1a2332;padding:32px 40px;text-align:center;">
            <div style="display:inline-block;background:rgba(197,163,87,0.15);border:1px solid rgba(197,163,87,0.3);border-radius:8px;padding:6px 18px;margin-bottom:14px;">
              <span style="color:#c5a357;font-size:10px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;">MARQLAND STUDIOS</span>
            </div>
            <h1 style="color:#f4f1ea;font-size:24px;font-weight:700;margin:0;font-family:Georgia,serif;letter-spacing:-0.02em;">Your curated options are ready</h1>
          </div>
          <!-- Body -->
          <div style="padding:36px 40px;background:#f4f1ea;">
            <p style="color:#1a2332;font-size:15px;line-height:1.8;margin:0 0 10px;">
              Dear <strong style="color:#1a2332;">${greetName}</strong>,
            </p>
            <p style="color:#64748b;font-size:14px;line-height:1.8;margin:0 0 28px;">
              We've hand-curated a selection of options for <strong style="color:#c5a357;">${title || orderRef}</strong>.
              Please review them and share your preferences — we're here to make it seamless.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${url}" style="display:inline-block;background:#1a2332;color:#c5a357;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.05em;border:1px solid rgba(197,163,87,0.3);">
                View Your Portal &rarr;
              </a>
            </div>
            <p style="color:#94a3b8;font-size:11px;text-align:center;margin:24px 0 0;border-top:1px solid rgba(197,163,87,0.15);padding-top:20px;">
              Ref: ${orderRef} &nbsp;&middot;&nbsp; This link is private — please do not share.
            </p>
          </div>
          <!-- Footer -->
          <div style="background:#1a2332;padding:18px 40px;text-align:center;">
            <p style="color:rgba(197,163,87,0.6);font-size:10px;margin:0;letter-spacing:0.08em;text-transform:uppercase;">Marqland Studios · Premium Corporate Gifting &amp; Events</p>
          </div>
        </div>
      `,
    });

    if (slug) {
      await ClientPortal.findOneAndUpdate({ slug }, { $set: { clientEmail } });
    }

    res.json({ ok: true, sentTo: clientEmail });
  } catch (err) {
    console.error('Portal email error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;