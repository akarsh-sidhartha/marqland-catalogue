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
const OrderInquiry   = require('../models/orderInquiry');
const Product        = require('../models/product');
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const mongoose       = require('mongoose');

// ── Web Push setup ────────────────────────────────────────────────────────────
// Requires: npm install web-push
// Generate keys once: npx web-push generate-vapid-keys  → paste into .env
let webpush = null;
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_CONTACT || 'mailto:info@marqland.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } else {
    console.warn('[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push disabled');
    webpush = null;
  }
} catch {
  console.warn('[Push] web-push not installed — run: npm install web-push');
}

// ── PushSubscription model (inline, lightweight) ──────────────────────────────
// Stores each browser's push subscription endpoint.
// userId is optional — if you add auth later you can scope per team member.
const pushSubSchema = new mongoose.Schema({
  endpoint:   { type: String, required: true, unique: true },
  keys:       { p256dh: String, auth: String },
  userAgent:  { type: String },
  createdAt:  { type: Date, default: Date.now },
});
const PushSubscription = mongoose.models.PushSubscription
  || mongoose.model('PushSubscription', pushSubSchema);

// ── Helper: send a push to ALL stored subscriptions ──────────────────────────
const sendPushToAll = async (payload) => {
  if (!webpush) return;
  try {
    const subs = await PushSubscription.find().lean();
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        )
      )
    );
    // Clean up expired/invalid subscriptions (410 Gone)
    const toRemove = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode)) {
        toRemove.push(subs[i].endpoint);
      }
    });
    if (toRemove.length) await PushSubscription.deleteMany({ endpoint: { $in: toRemove } });
  } catch (err) {
    console.warn('[Push] sendPushToAll error:', err.message);
  }
};

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

// ─── Helpers ───────────────────────────────────────────────────────────────────
const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Generate a secure URL token: 5 random alphanumeric chars
const genToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 5; i++) token += chars[Math.floor(Math.random() * chars.length)];
  console.log("gettoken value  = "+ token);
  return token;
};

// Build a slug with a token prefix: e.g. "ac1d4-inq-26-27-002"
const makeSlug = (orderRef) => `${genToken()}-${slugify(orderRef)}`;

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM ROUTES (require auth middleware in server.js)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/portal
 * Create a new client portal for an order.
 * Called automatically when an order is created, or manually.
 */
router.post('/', async (req, res) => {
  console.log('🔵 POST /api/portal hit — body:', JSON.stringify(req.body));
  try {
    const { orderId, type, orderRef, clientName, clientEmail, title } = req.body;

    if (!orderId || !type || !orderRef) {
      return res.status(400).json({ message: 'orderId, type, and orderRef are required.' });
    }

    // Check if portal already exists for this order
    const existing = await ClientPortal.findOne({ orderId });
    if (existing) return res.status(409).json({ message: 'Portal already exists.', portal: existing });

    const slug = makeSlug(orderRef);
    console.log("slug value = "+slug);
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
 *
 * Returns orderStatus (from the linked order) and orderPlacedBy so the
 * frontend hook can filter to inquiry/ongoing only and display the contact.
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type)   filter.type   = req.query.type;
    if (req.query.status) filter.status = req.query.status;

    const portals = await ClientPortal.find(filter)
      .select('slug type orderRef orderPlacedBy clientName title status productItems offsiteItems orderId')
      .populate('orderId', 'status')   // pulls only the status field from OrderInquiry
      .sort({ createdAt: -1 })
      .lean();

    // Flatten the populated order status onto each portal object
    const enriched = portals.map(p => ({
      ...p,
      orderStatus: p.orderId?.status || 'unknown',
      orderId: p.orderId?._id || p.orderId, // keep as plain ID, not the full object
    }));

    res.json(enriched);
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

    // Auto-sync product gallery images + video on every load — no manual step needed
    if (portal.type === 'product' && (portal.productItems || []).length > 0) {
      try {
        const ids = portal.productItems.map(i => i.productId).filter(Boolean);
        const products = await Product.find({ _id: { $in: ids } }).lean();
        const pMap = new Map(products.map(p => [p._id.toString(), p]));
        const calcSell = (pur, mk) => Math.round(parseFloat(pur||0) * (1 + parseFloat(mk||0)/100));
        let dirty = false;
        portal.productItems = portal.productItems.map(item => {
          const src = pMap.get(item.productId);
          if (!src) return item;
          const newExtra = src.additionalImages || [];
          const newVideo = src.videoUrl || '';
          // Only mark dirty if something actually changed
          const changed =
            JSON.stringify(item.additionalImages || []) !== JSON.stringify(newExtra) ||
            (item.videoUrl || '') !== newVideo;
          if (!changed) return item;
          dirty = true;
          const obj = item.toObject ? item.toObject() : { ...item };
          return { ...obj, additionalImages: newExtra, videoUrl: newVideo,
            imageUrl: src.imageUrl || item.imageUrl,
            price: src.price != null ? Number(src.price) : calcSell(src.purchasePrice, src.markupPercent),
          };
        });
        if (dirty) await portal.save();
      } catch (syncErr) {
        console.warn('[portal auto-sync] skipped:', syncErr.message);
      }
    }

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

    // Auto-sync: immediately enrich new product items with gallery + video
    if (portal.type === 'product' && (portal.productItems || []).length > 0) {
      try {
        const ids = portal.productItems.map(i => i.productId).filter(Boolean);
        const products = await Product.find({ _id: { $in: ids } }).lean();
        const pMap = new Map(products.map(p => [p._id.toString(), p]));
        const calcSell = (pur, mk) => Math.round(parseFloat(pur||0) * (1 + parseFloat(mk||0)/100));
        portal.productItems = portal.productItems.map(item => {
          const src = pMap.get(item.productId);
          if (!src) return item;
          const obj = item.toObject ? item.toObject() : { ...item };
          return { ...obj,
            additionalImages: src.additionalImages || [],
            videoUrl:         src.videoUrl || '',
            imageUrl:         src.imageUrl || item.imageUrl,
            price: src.price != null ? Number(src.price) : calcSell(src.purchasePrice, src.markupPercent),
          };
        });
        await portal.save();
      } catch (syncErr) {
        console.warn('[items PUT auto-sync] skipped:', syncErr.message);
      }
    }

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

    // Push notification to client's browser (if they subscribed)
    const newMsg = portal.messages[portal.messages.length - 1];
    sendPushToAll({
      title: `Marqland Studios — ${portal.clientName || 'Your Portal'}`,
      body:  newMsg.text?.slice(0, 80) || (newMsg.attachments?.length ? `📎 ${newMsg.attachments[0].name}` : 'New message from the team'),
      tag:   `portal-team-${portal.slug}`,
      url:   `/p/${portal.slug}`,
    });

    res.json(newMsg);
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
      slug:           portal.slug,
      type:           portal.type,
      orderRef:       portal.orderRef,
      orderId:        portal.orderId,        // needed for shipment tab fetch
      clientName:     portal.clientName,
      orderPlacedBy:  portal.orderPlacedBy || '',
      title:          portal.title,
      teamNote:       portal.teamNote,
      productItems,
      offsiteItems:   portal.offsiteItems  || [],
      messages:       portal.messages      || [],
      status:         portal.status,
      completedAt:    portal.completedAt,
      reviewLink:     portal.reviewLink,
      shortlistedIds: portal.shortlistedIds || [],  // ← persisted client shortlist
    };

    res.json(clientData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/portal/public/:slug/shipments
 * Returns shipments linked to this portal's order.
 * Only returns non-sensitive fields — safe for public client view.
 * Only relevant for product portals; offsite portals won't call this.
 */
router.get('/public/:slug/shipments', async (req, res) => {
  try {
    const portal = await ClientPortal.findOne({ slug: req.params.slug }, 'orderId type').lean();
    if (!portal) return res.status(404).json({ message: 'Portal not found.' });
    if (!portal.orderId) return res.json([]);

    const Shipment = require('../models/Shipment');
    const shipments = await Shipment.find(
      { orderId: portal.orderId },
      'recipientName city state phone trackingId shippingPartner status lastTrackedAt shippedDate'
    ).sort({ createdAt: 1 }).lean();

    res.json(shipments);
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
    const savedMsg = portal.messages[portal.messages.length - 1];

    // Push notification to team's browser(s)
    const clientLabel = senderName || portal.clientName || 'Client';
    sendPushToAll({
      title: `${clientLabel} sent a message`,
      body:  savedMsg.text?.slice(0, 80) || (savedMsg.attachments?.length ? `📎 ${savedMsg.attachments[0].name}` : 'New message'),
      tag:   `portal-client-${portal.slug}`,
      url:   `/orders`,
    });

    res.json(savedMsg);
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
 * Send the portal link to the client.
 * Backend builds the URL from APP_URL env — never trusts window.location from frontend.
 */
router.post('/send-email', async (req, res) => {
  try {
    const { slug, clientEmail, contactName, clientName, orderRef, title, cc } = req.body;
    if (!clientEmail) return res.status(400).json({ message: 'clientEmail required' });
    if (!slug)        return res.status(400).json({ message: 'slug required' });

    // Build URL from env var — correct in all environments (local + production)
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const url    = `${appUrl}/p/${slug}`;
    const greetName = contactName || clientName || 'there';

    // CC address — always copy info@marqland.com (overridable via request body)
    const ccAddress = cc || process.env.PORTAL_CC_EMAIL || 'info@marqland.com';

    // Build transporter — same logic as emailService.js
    const nodemailer = require('nodemailer');
    const isGmail    = process.env.EMAIL_SERVICE === 'gmail';
    const transporter = isGmail
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        })
      : nodemailer.createTransport({
          host:       process.env.EMAIL_HOST || 'smtp.office365.com',
          port:       parseInt(process.env.EMAIL_PORT || '587', 10),
          secure:     parseInt(process.env.EMAIL_PORT || '587', 10) === 465,
          requireTLS: true,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
          tls: { rejectUnauthorized: false },
        });

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || `Marqland Studios <${process.env.EMAIL_USER}>`,
      to:      clientEmail,
      cc:      ccAddress,
      subject: `Marqland Studios - Your Curated Options — ${orderRef}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a1422;font-family:'Segoe UI',system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#17202f;border-radius:16px;overflow:hidden;">
<tr><td style="background:#1a2332;padding:32px 40px;text-align:center;">
  <table cellpadding="0" cellspacing="0" align="center"><tr>
    <td style="background:linear-gradient(45deg,#e6c273,#c5a357);width:32px;height:32px;border-radius:8px;text-align:center;vertical-align:middle;">
      <span style="color:#3f2e00;font-size:16px;font-weight:900;">M</span>
    </td>
    <td style="padding-left:10px;color:#f0e8d6;font-size:16px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;">Marqland Studios</td>
  </tr></table>
</td></tr>
<tr><td style="padding:40px 40px 32px;">
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0e8d6;font-family:Georgia,serif;">Your curated options are ready</h1>
  <p style="margin:0 0 8px;font-size:15px;color:#f0e8d6;line-height:1.8;">Dear <strong style="color:#e6c273;">${greetName}</strong>,</p>
  <p style="margin:0 0 28px;font-size:14px;color:rgba(240,232,214,0.65);line-height:1.8;">
    We have hand-curated a selection for <strong style="color:#c5a357;">${title || orderRef}</strong>. Please review and share your preferences.
  </p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;"><tr>
    <td style="background:linear-gradient(45deg,#e6c273,#c5a357);border-radius:10px;">
      <a href="${url}" style="display:inline-block;padding:14px 36px;color:#3f2e00;text-decoration:none;font-size:15px;font-weight:700;">View Your Portal &rarr;</a>
    </td>
  </tr></table>
  <p style="font-size:12px;color:rgba(240,232,214,0.3);text-align:center;margin:0;">
    Or copy: <a href="${url}" style="color:#c5a357;word-break:break-all;font-size:11px;">${url}</a>
  </p>
</td></tr>
<tr><td style="background:#0a1422;padding:18px 40px;text-align:center;border-top:1px solid rgba(197,163,87,0.15);">
  <p style="margin:0;font-size:11px;color:rgba(197,163,87,0.5);letter-spacing:0.08em;text-transform:uppercase;">Marqland Studios &middot; Premium Corporate Gifting</p>
  <p style="margin:6px 0 0;font-size:10px;color:rgba(255,255,255,0.15);">Ref: ${orderRef} &middot; This link is private.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
    });

    // Store clientEmail on the portal for future reference
    await ClientPortal.findOneAndUpdate({ slug }, { $set: { clientEmail } });

    console.log(`✅ Portal email sent to ${clientEmail} — ${url}`);
    res.json({ ok: true, sentTo: clientEmail, url });
  } catch (err) {
    console.error('Portal send-email error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/portal/push-subscribe ─────────────────────────────────────────
// Saves a browser's Web Push subscription (called from portalNotifications.js).
// Accepts the standard PushSubscription JSON object from the browser.
router.post('/push-subscribe', async (req, res) => {
  try {
    const { endpoint, keys, userAgent } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription object.' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys, userAgent: userAgent || req.headers['user-agent'] || '' },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/portal/vapid-public-key ─────────────────────────────────────────
// Frontend fetches the VAPID public key to set up the push subscription.
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ message: 'Push not configured.' });
  res.json({ publicKey: key });
});

// ── GET /api/portal/unread-counts ────────────────────────────────────────────
// Returns { [orderId]: { clientCount, lastClientMessage } } for all active portals.
router.get('/unread-counts', async (req, res) => {
  try {
    const portals = await ClientPortal.find({ status: 'active' }, {
      orderId: 1, messages: 1,
    }).lean();

    const result = {};
    portals.forEach(portal => {
      const orderId = portal.orderId?.toString();
      if (!orderId) return;
      const clientMsgs = (portal.messages || []).filter(m => m.sender === 'client');
      const last = clientMsgs[clientMsgs.length - 1];
      result[orderId] = {
        clientCount:        clientMsgs.length,
        lastClientMessage:  last
          ? (last.text?.slice(0, 80) || (last.attachments?.length ? `📎 ${last.attachments[0].name}` : ''))
          : '',
        lastClientAt: last?.createdAt || null,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/**
 * POST /api/portal/:slug/sync-products
 *
 * Re-fetches each productItem from the Product collection and updates
 * the portal snapshot with the latest: additionalImages, videoUrl,
 * imageUrl, description, name, price.
 *
 * Only fields that can change after a product is added to a portal are
 * refreshed — orderId / slug / type / messages are untouched.
 */
router.post('/:slug/sync-products', async (req, res) => {
  try {
    const portal = await ClientPortal.findOne({ slug: req.params.slug });
    if (!portal) return res.status(404).json({ message: 'Portal not found.' });
    if (portal.type !== 'product') {
      return res.status(400).json({ message: 'Sync only applies to product portals.' });
    }

    const items = portal.productItems || [];
    if (items.length === 0) return res.json({ synced: 0, portal });

    // Collect all productIds that exist
    const ids = items.map(i => i.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    let synced = 0;
    const calcSell = (purchase, markup) => {
      const p = parseFloat(purchase || 0);
      const m = parseFloat(markup || 0);
      return Math.round(p + p * m / 100);
    };

    portal.productItems = items.map(item => {
      const src = productMap.get(item.productId);
      if (!src) return item; // product deleted — keep existing snapshot

      synced++;
      return {
        ...item.toObject ? item.toObject() : item,
        // Always refresh these fields from the live product
        name:             src.name             || item.name,
        description:      src.description      || item.description,
        imageUrl:         src.imageUrl         || item.imageUrl,
        additionalImages: src.additionalImages  || [],
        videoUrl:         src.videoUrl          || '',
        price:            src.price != null
          ? Number(src.price)
          : calcSell(src.purchasePrice, src.markupPercent),
        category:         src.category    || item.category,
        subCategory:      src.subCategory || item.subCategory,
      };
    });

    await portal.save();
    res.json({ synced, total: items.length, portal });
  } catch (err) {
    console.error('[sync-products] error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ── PUT /api/portal/:slug/shortlist ─────────────────────────────────────────
// Persists the client's shortlisted item IDs to the DB so they survive refresh.
// Body: { ids: string[] }
router.put('/:slug/shortlist', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids must be an array' });
    const portal = await ClientPortal.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: { shortlistedIds: ids } },
      { new: true }
    );
    if (!portal) return res.status(404).json({ message: 'Portal not found' });
    res.json({ shortlistedIds: portal.shortlistedIds || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ── PUT /api/portal/public/:slug/shortlist ───────────────────────────────────
// Public (no auth) — called by the client's browser to persist their shortlist.
router.put('/public/:slug/shortlist', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids must be an array' });
    const portal = await ClientPortal.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: { shortlistedIds: ids } },
      { new: true }
    );
    if (!portal) return res.status(404).json({ message: 'Portal not found' });
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;