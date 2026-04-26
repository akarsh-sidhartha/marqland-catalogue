/**
 * backend/middleware/activityLogger.js
 *
 * Express middleware that intercepts every API response and writes an
 * ActivityLog document for meaningful actions (mutations + auth events).
 *
 * Mount BEFORE route handlers (but AFTER express.json) in server.js.
 * req.user is read inside setImmediate — by then authenticate has already
 * populated it, so the correct user name/role is always captured.
 *
 * Usage in server.js:
 *   const activityLogger = require('./middleware/activityLogger');
 *   app.use(activityLogger);   // before all app.use('/api/...') lines
 */

const ActivityLog = require('../models/ActivityLog');

// ── Route → { action, category, summary fn } mapping ─────────────────────────
// Summary receives (req) and returns a human-readable string.
// Patterns are matched against req.originalUrl (the full /api/... path).
const ROUTE_MAP = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/auth\/login$/,                     action: 'LOGIN',              category: 'auth',      summary: r => `Login: ${r.body?.email || '?'}` },
  { method: 'POST',   pattern: /^\/api\/auth\/logout$/,                    action: 'LOGOUT',             category: 'auth',      summary: _r => `Logout` },
  { method: 'POST',   pattern: /^\/api\/auth\/register$/,                  action: 'REGISTER',           category: 'auth',      summary: r => `Registered: ${r.body?.email || '?'}` },
  { method: 'POST',   pattern: /^\/api\/auth\/invite\/register$/,          action: 'INVITE_REGISTER',    category: 'auth',      summary: r => `Invite registration completed` },
  { method: 'POST',   pattern: /^\/api\/auth\/forgot-password$/,           action: 'FORGOT_PASSWORD',    category: 'auth',      summary: r => `Password reset requested: ${r.body?.email || '?'}` },
  { method: 'POST',   pattern: /^\/api\/auth\/reset-password$/,            action: 'RESET_PASSWORD',     category: 'auth',      summary: _r => `Password reset completed` },

  // ── Admin: user management ────────────────────────────────────────────────
  { method: 'PATCH',  pattern: /^\/api\/auth\/users\/[^/]+\/approve$/,     action: 'APPROVE_USER',       category: 'admin',     summary: r => `Approved user with role: ${r.body?.role || '?'}` },
  { method: 'PATCH',  pattern: /^\/api\/auth\/users\/[^/]+\/role$/,        action: 'CHANGE_ROLE',        category: 'admin',     summary: r => `Role changed to: ${r.body?.role || '?'}` },
  { method: 'PATCH',  pattern: /^\/api\/auth\/users\/[^/]+\/suspend$/,     action: 'SUSPEND_USER',       category: 'admin',     summary: _r => `User suspended` },
  { method: 'PATCH',  pattern: /^\/api\/auth\/users\/[^/]+\/reactivate$/,  action: 'REACTIVATE_USER',    category: 'admin',     summary: _r => `User reactivated` },
  { method: 'DELETE', pattern: /^\/api\/auth\/users\/[^/]+$/,              action: 'DELETE_USER',        category: 'admin',     summary: _r => `User deleted` },
  { method: 'PATCH',  pattern: /^\/api\/auth\/users\/[^/]+\/routes$/,      action: 'UPDATE_ROUTES',      category: 'admin',     summary: r => `Route access updated: ${(r.body?.allowedRoutes || []).join(', ') || 'none'}` },
  { method: 'POST',   pattern: /^\/api\/auth\/invite$/,                    action: 'SEND_INVITE',        category: 'admin',     summary: r => `Invite sent to: ${r.body?.email || '?'}` },

  // ── Orders ────────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/orders$/,                          action: 'CREATE_ORDER',       category: 'orders',    summary: r => `Created order: ${r.body?.title || '?'} for ${r.body?.clientName || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/orders\/[^/]+$/,                   action: 'UPDATE_ORDER',       category: 'orders',    summary: _r => `Updated order` },
  { method: 'DELETE', pattern: /^\/api\/orders\/[^/]+$/,                   action: 'DELETE_ORDER',       category: 'orders',    summary: _r => `Deleted order` },
  { method: 'PATCH',  pattern: /^\/api\/orders\/[^/]+$/,                   action: 'PATCH_ORDER',        category: 'orders',    summary: _r => `Patched order` },

  // ── Clients ───────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/clients$/,                         action: 'CREATE_CLIENT',      category: 'clients',   summary: r => `Created client: ${r.body?.companyName || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/clients\/[^/]+$/,                  action: 'UPDATE_CLIENT',      category: 'clients',   summary: r => `Updated client: ${r.body?.companyName || '?'}` },
  { method: 'DELETE', pattern: /^\/api\/clients\/[^/]+$/,                  action: 'DELETE_CLIENT',      category: 'clients',   summary: _r => `Deleted client` },

  // ── Products ──────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/products$/,                        action: 'CREATE_PRODUCT',     category: 'products',  summary: r => `Created product: ${r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/products\/[^/]+$/,                 action: 'UPDATE_PRODUCT',     category: 'products',  summary: _r => `Updated product` },
  { method: 'DELETE', pattern: /^\/api\/products\/[^/]+$/,                 action: 'DELETE_PRODUCT',     category: 'products',  summary: _r => `Deleted product` },

  // ── Vendors ───────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/vendors$/,                         action: 'CREATE_VENDOR',      category: 'vendors',   summary: r => `Created vendor: ${r.body?.vendorName || r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/vendors\/[^/]+$/,                  action: 'UPDATE_VENDOR',      category: 'vendors',   summary: _r => `Updated vendor` },
  { method: 'DELETE', pattern: /^\/api\/vendors\/[^/]+$/,                  action: 'DELETE_VENDOR',      category: 'vendors',   summary: _r => `Deleted vendor` },

  // ── Catalogues ────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/catalogues$/,                      action: 'CREATE_CATALOGUE',   category: 'inventory', summary: r => `Created catalogue: ${r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/catalogues\/[^/]+$/,               action: 'UPDATE_CATALOGUE',   category: 'inventory', summary: _r => `Updated catalogue` },
  { method: 'DELETE', pattern: /^\/api\/catalogues\/[^/]+$/,               action: 'DELETE_CATALOGUE',   category: 'inventory', summary: _r => `Deleted catalogue` },

  // ── Properties ────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/properties$/,                      action: 'CREATE_PROPERTY',    category: 'inventory', summary: r => `Created property: ${r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/properties\/[^/]+$/,               action: 'UPDATE_PROPERTY',    category: 'inventory', summary: _r => `Updated property` },
  { method: 'DELETE', pattern: /^\/api\/properties\/[^/]+$/,               action: 'DELETE_PROPERTY',    category: 'inventory', summary: _r => `Deleted property` },

  // ── Offsite Catalogues ────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/offsitecatalogues$/,               action: 'CREATE_OFFSITE',     category: 'inventory', summary: r => `Created offsite catalogue: ${r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/offsitecatalogues\/[^/]+$/,        action: 'UPDATE_OFFSITE',     category: 'inventory', summary: _r => `Updated offsite catalogue` },
  { method: 'DELETE', pattern: /^\/api\/offsitecatalogues\/[^/]+$/,        action: 'DELETE_OFFSITE',     category: 'inventory', summary: _r => `Deleted offsite catalogue` },

  // ── Challans ──────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/challans$/,                        action: 'CREATE_CHALLAN',     category: 'inventory', summary: r => `Created challan` },
  { method: 'PUT',    pattern: /^\/api\/challans\/[^/]+$/,                 action: 'UPDATE_CHALLAN',     category: 'inventory', summary: _r => `Updated challan` },
  { method: 'DELETE', pattern: /^\/api\/challans\/[^/]+$/,                 action: 'DELETE_CHALLAN',     category: 'inventory', summary: _r => `Deleted challan` },

  // ── Sourcing Hub / Inquiries ───────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/inquiries$/,                       action: 'CREATE_INQUIRY',     category: 'sourcing',  summary: r => `Created inquiry: ${r.body?.title || r.body?.productName || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/inquiries\/[^/]+$/,                action: 'UPDATE_INQUIRY',     category: 'sourcing',  summary: _r => `Updated inquiry` },
  { method: 'DELETE', pattern: /^\/api\/inquiries\/[^/]+$/,                action: 'DELETE_INQUIRY',     category: 'sourcing',  summary: _r => `Deleted inquiry` },
  { method: 'PATCH',  pattern: /^\/api\/inquiries\/[^/]+$/,                action: 'PATCH_INQUIRY',      category: 'sourcing',  summary: _r => `Updated inquiry status` },

  // ── Shipments ─────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/shipments$/,                       action: 'CREATE_SHIPMENT',    category: 'logistics', summary: r => `Created shipment: ${r.body?.trackingNumber || r.body?.title || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/shipments\/[^/]+$/,                action: 'UPDATE_SHIPMENT',    category: 'logistics', summary: _r => `Updated shipment` },
  { method: 'DELETE', pattern: /^\/api\/shipments\/[^/]+$/,                action: 'DELETE_SHIPMENT',    category: 'logistics', summary: _r => `Deleted shipment` },
  { method: 'PATCH',  pattern: /^\/api\/shipments\/[^/]+$/,                action: 'PATCH_SHIPMENT',     category: 'logistics', summary: _r => `Updated shipment status` },

  // ── Shipping Partners ─────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/shipping-partners$/,               action: 'CREATE_SHIPPING_PARTNER',  category: 'logistics', summary: r => `Created shipping partner: ${r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/shipping-partners\/[^/]+$/,        action: 'UPDATE_SHIPPING_PARTNER',  category: 'logistics', summary: _r => `Updated shipping partner` },
  { method: 'DELETE', pattern: /^\/api\/shipping-partners\/[^/]+$/,        action: 'DELETE_SHIPPING_PARTNER',  category: 'logistics', summary: _r => `Deleted shipping partner` },

  // ── Portal ────────────────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/portal$/,                          action: 'CREATE_PORTAL',      category: 'portal',    summary: r => `Created portal for order: ${r.body?.orderRef || '?'}` },
  { method: 'POST',   pattern: /^\/api\/portal\/[^/]+\/message\/team$/,   action: 'SEND_PORTAL_MSG',    category: 'portal',    summary: _r => `Sent message on portal` },
  { method: 'PUT',    pattern: /^\/api\/portal\/[^/]+\/items$/,            action: 'UPDATE_PORTAL_ITEMS',category: 'portal',    summary: _r => `Updated portal items` },
  { method: 'DELETE', pattern: /^\/api\/portal\/[^/]+$/,                   action: 'DELETE_PORTAL',      category: 'portal',    summary: _r => `Deleted portal` },
  { method: 'PATCH',  pattern: /^\/api\/portal\/[^/]+$/,                   action: 'PATCH_PORTAL',       category: 'portal',    summary: _r => `Updated portal` },

  // ── Payment Tracker ───────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/payment-tracker/,                  action: 'PAYMENT_ACTION',     category: 'finance',   summary: _r => `Payment tracker action` },
  { method: 'PUT',    pattern: /^\/api\/payment-tracker\/[^/]+$/,          action: 'UPDATE_PAYMENT',     category: 'finance',   summary: _r => `Updated payment record` },
  { method: 'DELETE', pattern: /^\/api\/payment-tracker\/[^/]+$/,          action: 'DELETE_PAYMENT',     category: 'finance',   summary: _r => `Deleted payment record` },
  { method: 'PATCH',  pattern: /^\/api\/payment-tracker\/[^/]+$/,          action: 'PATCH_PAYMENT',      category: 'finance',   summary: _r => `Updated payment status` },

  // ── Image Processing ──────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/image-processing/,                 action: 'IMAGE_PROCESS',      category: 'general',   summary: _r => `Image processing task` },

  // ── Trending Products ─────────────────────────────────────────────────────
  { method: 'POST',   pattern: /^\/api\/trending-products$/,               action: 'CREATE_TRENDING',    category: 'products',  summary: r => `Added trending product: ${r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/trending-products\/[^/]+$/,        action: 'UPDATE_TRENDING',    category: 'products',  summary: _r => `Updated trending product` },
  { method: 'DELETE', pattern: /^\/api\/trending-products\/[^/]+$/,        action: 'DELETE_TRENDING',    category: 'products',  summary: _r => `Deleted trending product` },
];

// Methods we always skip (read-only, high frequency)
const SKIP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── Derive category from URL when no ROUTE_MAP match ─────────────────────────
const getCategory = (url) => {
  if (url.includes('/auth'))              return 'auth';
  if (url.includes('/orders'))            return 'orders';
  if (url.includes('/clients'))           return 'clients';
  if (url.includes('/products'))          return 'products';
  if (url.includes('/vendors'))           return 'vendors';
  if (url.includes('/portal'))            return 'portal';
  if (url.includes('/payment-tracker'))   return 'finance';
  if (url.includes('/challans'))          return 'inventory';
  if (url.includes('/catalogues'))        return 'inventory';
  if (url.includes('/properties'))        return 'inventory';
  if (url.includes('/offsitecatalogues')) return 'inventory';
  if (url.includes('/inquiries'))         return 'sourcing';
  if (url.includes('/shipments'))         return 'logistics';
  if (url.includes('/shipping-partners')) return 'logistics';
  if (url.includes('/trending-products')) return 'products';
  return 'general';
};

const activityLogger = (req, res, next) => {
  // Skip GET/HEAD/OPTIONS and public portal client-facing routes
  if (SKIP_METHODS.has(req.method)) return next();
  if (req.path.includes('/portal/public/')) return next();

  const start = Date.now();

  // ── Snapshot request body NOW (before any middleware mutates it) ──────────
  // We do NOT snapshot req.user here — it may not be populated yet.
  // req.user is read inside setImmediate, after authenticate has run.
  const bodyCopy = req.body ? { ...req.body } : {};

  // Intercept res.json to capture status + body after the full middleware chain
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const duration = Date.now() - start;
    const status   = res.statusCode;
    const success  = status < 400;

    // ── Match route map using the snapshot body ───────────────────────────
    const fakeReq = { body: bodyCopy, originalUrl: req.originalUrl };
    const match = ROUTE_MAP.find(r =>
      r.method === req.method && r.pattern.test(req.originalUrl)
    );

    const action   = match ? match.action   : `${req.method}_${getCategory(req.originalUrl).toUpperCase()}`;
    const category = match ? match.category : getCategory(req.originalUrl);
    let   summary  = match ? match.summary(fakeReq) : `${req.method} ${req.originalUrl}`;
    if (!success && body?.message) summary += ` — ${body.message}`;

    // ── Write log async — req.user is read HERE, after authenticate ran ───
    setImmediate(async () => {
      try {
        // For LOGIN, req.user won't exist (public route), but the response
        // body contains the user object — use it as a fallback.
        const user = req.user || null;

        // Derive user fields with fallback chain
        let userId    = user?.id    || user?._id || null;
        let userName  = user?.name  || null;
        let userEmail = user?.email || '';
        let userRole  = user?.role  || '';

        // Login-specific: extract from successful response body
        if (!userId && action === 'LOGIN' && success && body?.user) {
          userId    = body.user.id    || body.user._id || null;
          userName  = body.user.name  || null;
          userEmail = body.user.email || '';
          userRole  = body.user.role  || '';
        }

        await ActivityLog.create({
          userId,
          userName:  userName  || 'Anonymous',
          userEmail,
          userRole,
          action,
          category,
          method:    req.method,
          path:      req.originalUrl,
          summary,
          status,
          success,
          ip:        req.ip || req.headers['x-forwarded-for'] || '',
          userAgent: req.headers['user-agent'] || '',
          duration,
          meta: null,
        });
      } catch { /* never let logging break the app */ }
    });

    return originalJson(body);
  };

  next();
};

module.exports = activityLogger;