const jwt = require('jsonwebtoken');

/**
 * ROLE HIERARCHY
 */
const ROLES = {
  viewer: 0,
  inventory: 1,
  sales: 2,
  accounts: 3,
  admin: 4,
};

/**
 * ROUTE PERMISSION MAP
 *
 * IMPORTANT: These paths are matched against req.path INSIDE app.use('/api', ...)
 * Express strips the '/api' prefix, so req.path = '/auth/login' not '/api/auth/login'
 *
 * null = fully public (no token needed)
 */
const ROUTE_PERMISSIONS = {
  '/auth': null,   // ALL /api/auth/* routes are public
  '/products': ['inventory', 'sales', 'accounts', 'admin'],
  '/vendors': ['accounts', 'admin'],
  '/clients': ['sales', 'accounts', 'admin'],
  '/catalogues': ['inventory', 'sales', 'accounts', 'admin'],
  '/properties': ['inventory', 'sales', 'accounts', 'admin'],
  '/offsitecatalogues': ['inventory', 'sales', 'accounts', 'admin'],
  '/orders': ['sales', 'accounts', 'admin'],
  '/challans': ['inventory', 'sales', 'accounts', 'admin'],
  '/inquiries': ['sales', 'accounts', 'admin'],
  '/payment-tracker': ['accounts', 'admin'],
  '/portal/public': null,                              // public — client facing, no auth
  '/portal': ['sales', 'accounts', 'admin'],   // team — requires login
};

/**
 * MIDDLEWARE: authenticate
 * Verifies JWT token from Authorization header.
 * Attaches decoded payload to req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};

/**
 * MIDDLEWARE: authorize(allowedRoles[])
 * Use after authenticate to restrict by role.
 * Usage: router.get('/', authenticate, authorize(['admin']), handler)
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Your role (${req.user.role}) does not have permission.`
      });
    }
    next();
  };
};

/**
 * MIDDLEWARE: routeGuard
 * Applied globally via app.use('/api', routeGuard) in server.js.
 * Automatically protects all /api/* routes using ROUTE_PERMISSIONS above.
 *
 * req.path inside app.use('/api', ...) is the path AFTER /api
 * e.g. GET /api/auth/login  →  req.path = '/auth/login'
 * e.g. GET /api/products    →  req.path = '/products'
 */
const routeGuard = (req, res, next) => {
  // Find matching permission entry
  const matchedPrefix = Object.keys(ROUTE_PERMISSIONS).find(prefix =>
    req.path.startsWith(prefix)
  );

  // Route not in map → default to admin-only for safety
  const allowedRoles = matchedPrefix !== undefined
    ? ROUTE_PERMISSIONS[matchedPrefix]
    : ['admin'];

  // null = public route, skip all auth checks
  if (allowedRoles === null) {
    return next();
  }

  // Verify token
  authenticate(req, res, () => {
    if (!req.user) return; // authenticate already sent 401

    // Check role permission
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Your role (${req.user.role}) cannot access this resource.`
      });
    }
    next();
  });
};

module.exports = { authenticate, authorize, routeGuard, ROLES };