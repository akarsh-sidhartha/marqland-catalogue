/**
 * backend/middleware/activityLogger.js
 *
 * Express middleware that intercepts every API response and writes an
 * ActivityLog document for meaningful actions (mutations + auth events).
 *
 * Mount AFTER authenticate so req.user is available.
 * Usage in server.js:
 *   const activityLogger = require('./middleware/activityLogger');
 *   app.use('/api', activityLogger);
 */

const ActivityLog = require('../models/ActivityLog');

// ── Route → { action, category, summary fn } mapping ─────────────────────────
// Summary receives (req) and returns a human-readable string.
const ROUTE_MAP = [
  // Auth
  { method: 'POST', pattern: /^\/api\/auth\/login$/,            action: 'LOGIN',             category: 'auth',     summary: r => `Login: ${r.body?.email || '?'}` },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/,           action: 'LOGOUT',            category: 'auth',     summary: r => `Logout` },
  { method: 'POST', pattern: /^\/api\/auth\/register$/,         action: 'REGISTER',          category: 'auth',     summary: r => `Registered: ${r.body?.email || '?'}` },
  { method: 'POST', pattern: /^\/api\/auth\/forgot-password$/,  action: 'FORGOT_PASSWORD',   category: 'auth',     summary: r => `Password reset requested: ${r.body?.email || '?'}` },
  { method: 'PATCH', pattern: /^\/api\/auth\/users\/[^/]+\/approve$/, action: 'APPROVE_USER', category: 'admin',   summary: r => `Approved user with role: ${r.body?.role || '?'}` },
  { method: 'PATCH', pattern: /^\/api\/auth\/users\/[^/]+\/role$/,    action: 'CHANGE_ROLE',  category: 'admin',   summary: r => `Role changed to: ${r.body?.role || '?'}` },
  { method: 'PATCH', pattern: /^\/api\/auth\/users\/[^/]+\/suspend$/, action: 'SUSPEND_USER', category: 'admin',   summary: r => `User suspended` },
  { method: 'PATCH', pattern: /^\/api\/auth\/users\/[^/]+\/reactivate$/, action: 'REACTIVATE_USER', category: 'admin', summary: r => `User reactivated` },
  { method: 'DELETE', pattern: /^\/api\/auth\/users\/[^/]+$/,   action: 'DELETE_USER',       category: 'admin',   summary: r => `User deleted` },
  { method: 'PATCH', pattern: /^\/api\/auth\/users\/[^/]+\/routes$/, action: 'UPDATE_ROUTES', category: 'admin',  summary: r => `Route access updated: ${(r.body?.allowedRoutes||[]).join(', ')||'none'}` },
  { method: 'POST', pattern: /^\/api\/auth\/invite$/,           action: 'SEND_INVITE',       category: 'admin',   summary: r => `Invite sent to: ${r.body?.email || '?'}` },

  // Orders
  { method: 'POST',   pattern: /^\/api\/orders$/,               action: 'CREATE_ORDER',      category: 'orders',  summary: r => `Created order: ${r.body?.title || '?'} for ${r.body?.clientName || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/orders\/[^/]+$/,        action: 'UPDATE_ORDER',      category: 'orders',  summary: r => `Updated order` },
  { method: 'DELETE', pattern: /^\/api\/orders\/[^/]+$/,        action: 'DELETE_ORDER',      category: 'orders',  summary: r => `Deleted order` },
  { method: 'PATCH',  pattern: /^\/api\/orders\/[^/]+$/,        action: 'PATCH_ORDER',       category: 'orders',  summary: r => `Patched order` },

  // Clients
  { method: 'POST',   pattern: /^\/api\/clients$/,              action: 'CREATE_CLIENT',     category: 'clients', summary: r => `Created client: ${r.body?.companyName || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/clients\/[^/]+$/,       action: 'UPDATE_CLIENT',     category: 'clients', summary: r => `Updated client: ${r.body?.companyName || '?'}` },
  { method: 'DELETE', pattern: /^\/api\/clients\/[^/]+$/,       action: 'DELETE_CLIENT',     category: 'clients', summary: r => `Deleted client` },

  // Products
  { method: 'POST',   pattern: /^\/api\/products$/,             action: 'CREATE_PRODUCT',    category: 'products',summary: r => `Created product: ${r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/products\/[^/]+$/,      action: 'UPDATE_PRODUCT',    category: 'products',summary: r => `Updated product` },
  { method: 'DELETE', pattern: /^\/api\/products\/[^/]+$/,      action: 'DELETE_PRODUCT',    category: 'products',summary: r => `Deleted product` },

  // Vendors
  { method: 'POST',   pattern: /^\/api\/vendors$/,              action: 'CREATE_VENDOR',     category: 'vendors', summary: r => `Created vendor: ${r.body?.vendorName || r.body?.name || '?'}` },
  { method: 'PUT',    pattern: /^\/api\/vendors\/[^/]+$/,       action: 'UPDATE_VENDOR',     category: 'vendors', summary: r => `Updated vendor` },
  { method: 'DELETE', pattern: /^\/api\/vendors\/[^/]+$/,       action: 'DELETE_VENDOR',     category: 'vendors', summary: r => `Deleted vendor` },

  // Portal
  { method: 'POST', pattern: /^\/api\/portal$/,                      action: 'CREATE_PORTAL',    category: 'portal', summary: r => `Created portal for order: ${r.body?.orderRef || '?'}` },
  { method: 'POST', pattern: /^\/api\/portal\/[^/]+\/message\/team$/, action: 'SEND_PORTAL_MSG', category: 'portal', summary: r => `Sent message on portal` },
  { method: 'PUT',  pattern: /^\/api\/portal\/[^/]+\/items$/,         action: 'UPDATE_PORTAL_ITEMS', category: 'portal', summary: r => `Updated portal items` },
  { method: 'DELETE', pattern: /^\/api\/portal\/[^/]+$/,              action: 'DELETE_PORTAL',   category: 'portal', summary: r => `Deleted portal` },

  // Payment tracker
  { method: 'POST', pattern: /^\/api\/payment-tracker/,         action: 'PAYMENT_ACTION',    category: 'finance', summary: r => `Payment tracker action` },
];

// Methods we always skip (read-only, high frequency)
const SKIP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const getCategory = (path) => {
  if (path.includes('/auth')) return 'auth';
  if (path.includes('/orders')) return 'orders';
  if (path.includes('/clients')) return 'clients';
  if (path.includes('/products')) return 'products';
  if (path.includes('/vendors')) return 'vendors';
  if (path.includes('/portal')) return 'portal';
  if (path.includes('/payment-tracker')) return 'finance';
  return 'general';
};

const activityLogger = (req, res, next) => {
  // Skip GET/HEAD, skip public portal client routes
  if (SKIP_METHODS.has(req.method)) return next();
  if (req.path.includes('/portal/public/')) return next();

  const start = Date.now();

  // Intercept res.json to capture status + body
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const duration = Date.now() - start;
    const status   = res.statusCode;
    const success  = status < 400;

    // Match route
    const match = ROUTE_MAP.find(r =>
      r.method === req.method && r.pattern.test(req.originalUrl)
    );

    const action   = match ? match.action   : `${req.method}_${getCategory(req.originalUrl).toUpperCase()}`;
    const category = match ? match.category : getCategory(req.originalUrl);
    let   summary  = match ? match.summary(req) : `${req.method} ${req.originalUrl}`;
    if (!success && body?.message) summary += ` — ${body.message}`;

    // Write log async (don't block response)
    setImmediate(async () => {
      try {
        await ActivityLog.create({
          userId:    req.user?.id   || null,
          userName:  req.user?.name  || 'Anonymous',
          userEmail: req.user?.email || '',
          userRole:  req.user?.role  || '',
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
          meta: null, // keep null to avoid storing sensitive data
        });
      } catch { /* never let logging break the app */ }
    });

    return originalJson(body);
  };

  next();
};

module.exports = activityLogger;