const dotenv = require('dotenv');
// ⚠ MUST call before any require that reads process.env
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const cron = require('node-cron');

const app = express();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const whatsappService = require('./services/whatsappService');
const { startScheduler } = require('./services/trendingProductService');
const { startTrackingScheduler } = require('./services/shipmentTrackingService');

/**
 * ─── CORS CONFIGURATION ───────────────────────────────────────────────────────
 *
 * DEV:  Allows localhost:3000 (internal portal) and localhost:3001 (public site)
 * PROD: Allows only the two live domains
 *
 * Update ALLOWED_ORIGINS in .env to override for any environment.
 */
const defaultOrigins = IS_PRODUCTION
  ? [
      // ── New domains (marqlandstudios.com) ──────────────────────────────────
      'https://admin.marqlandstudios.com',   // Task 2: Employee admin panel
      'https://www.marqlandstudios.com',     // Task 3: Public site
      'https://marqlandstudios.com',
      // ── Legacy domains (kept during transition; remove after cutover) ───────
      'https://internalportal.marqland.com',
      'https://www.marqland.com',
      'https://marqland.com',
    ]
  : [
      'http://localhost:3000', // DEV: Internal portal React dev server
      'http://localhost:3001', // DEV: Public site React dev server
      'http://localhost:5000',
    ];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    // Strip trailing slash — browsers sometimes send it, sometimes don't
    const normalised = origin?.replace(/\/$/, '');
    if (!normalised || allowedOrigins.includes(normalised)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,  // required for cookies (authenticateStatic) to work cross-origin
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ─── Route Imports ────────────────────────────────────────────────────────────

// www.marqland.com routes
const publicSiteRoutes = require('./routes/public-site/publicSiteRoutes');

// www.internalportal.marqland.com routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const clientRoutes = require('./routes/clientRoutes');
const catalogueRoutes = require('./routes/catalogueRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const offsiteCatalogueRoutes = require('./routes/offsiteCatalogueRoutes');
const orderInquiry = require('./routes/orderInquiryRoute');
const SamplesProvided = require('./routes/samplesProvided');
const SourcingHub = require('./routes/inquiryRoutes');
const { router: paymentTracker, syncOutlookInvoices } = require('./routes/paymentTrackerRoutes');
const activityLogger = require('./middleware/activityLogger');
const { authenticateStatic } = require('./middleware/authMiddleware');
const logRoutes = require('./routes/logRoutes');
const imageProcessing = require('./routes/imageProcessingRoutes');
const trendingProductRoutes = require('./routes/trendingProductRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const shippingPartnerRoutes = require('./routes/shippingPartnerRoutes');
const leadScoutRoutes = require('./routes/leadScoutRoutes');
const clientPortalRoutes = require('./routes/clientPortalRoutes');

app.use(cookieParser()); // Required for reading httpOnly cookies in authenticateStatic
app.use('/public', express.static(path.join(__dirname, 'public')));

// ─── Static File Serving ──────────────────────────────────────────────────────
// More specific routes MUST come before the broader /uploads catch-all.

// Public site images — no auth, accessible to www.marqland.com visitors
app.use('/uploads/store',       express.static(path.join(__dirname, 'public', 'uploads', 'store')));
app.use('/uploads/publicApp',   express.static(path.join(__dirname, 'public', 'uploads', 'publicApp')));

// Internal app images — protected by httpOnly cookie set on login
// authenticateStatic verifies the JWT from the cookie before serving any file
app.use('/uploads/internalApp', authenticateStatic, express.static(path.join(__dirname, 'public', 'uploads', 'internalApp')));




/**
 * PRODUCTION ONLY: Serve both built React apps as static files.
 * In development, React apps run on their own dev servers (ports 3000 & 3001)
 * so we don't need to serve static builds here.
 *
 * ─── TO SWITCH TO PRODUCTION ──────────────────────────────────────────────────
 * Set NODE_ENV=production in your .env file (or your deployment environment).
 * Then run `npm run build` in both /frontend and /public-site before starting.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Adjust these paths to match your actual folder structure
const internalBuildPath = path.join(__dirname, '..', 'frontend', 'build');    // Internal portal build
const publicBuildPath   = path.join(__dirname, '..', 'public-site', 'build'); // Public marqland.com build

if (IS_PRODUCTION) {
  // Serve static assets for both React apps.
  // Note: If both builds have files with the same name, the FIRST one registered wins.
  // index.html is intentionally NOT served here — the catch-all below handles it by hostname.
  app.use(express.static(internalBuildPath));
  app.use(express.static(publicBuildPath));
}

// ─── Database ─────────────────────────────────────────────────────────────────
//const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bizManager';
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log(`✅ Connected to MongoDB: ${MONGO_URI.split('/').pop().split('?')[0]}`))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(activityLogger);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/products',          productRoutes);
app.use('/api/vendors',           vendorRoutes);
app.use('/api/clients',           clientRoutes);
app.use('/api/catalogues',        catalogueRoutes);
app.use('/api/properties',        propertyRoutes);
app.use('/api/offsitecatalogues', offsiteCatalogueRoutes);
app.use('/api/orders',            orderInquiry);
app.use('/api/challans',          SamplesProvided);
app.use('/api/inquiries',         SourcingHub);
app.use('/api/auth',              authRoutes);
app.use('/api/payment-tracker',   paymentTracker);
app.use('/api/image-processing',  imageProcessing);
app.use('/api/trending-products', trendingProductRoutes);
app.use('/api/shipments',         shipmentRoutes);
app.use('/api/shipping-partners', shippingPartnerRoutes);
app.use('/api/lead-scout',        leadScoutRoutes);
app.use('/api/public-site',       publicSiteRoutes);
app.use('/api/portal',            clientPortalRoutes);
app.use('/api/logs',              logRoutes); // Admin only

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    error: IS_PRODUCTION ? 'Internal Server Error' : err.message
  });
});

// ─── Catch-All: Serve React ───────────────────────────────────────────────────
// MUST be after all API routes.
//
// DEV:  This catch-all is never reached for React pages because the browser
//       talks directly to the React dev servers (localhost:3000 / localhost:3001).
//       It only applies to /api calls proxied through this server.
//
// PROD: Routes every non-API request to the correct React build based on hostname.
//
app.use((req, res, next) => {
  // Always pass through API and asset requests
  if (
    req.url.startsWith('/api') ||
    req.url.startsWith('/public') ||
    req.url.startsWith('/uploads')
  ) {
    return next();
  }

  // In development, React dev servers handle their own HTML — nothing to serve here
  if (!IS_PRODUCTION) {
    return next();
  }

  // ── PRODUCTION ROUTING BY HOSTNAME ────────────────────────────────────────
  const host = req.hostname;

  // ── Task 4: Legacy redirect ────────────────────────────────────────────────
  // Old client portal URLs (internalportal.marqland.com/p/*) → new domain.
  // Cloudflare handles the bulk redirect, but this catches any traffic that
  // reaches the Node server directly (e.g. direct IP, or during DNS cut-over).
  if (host === 'internalportal.marqland.com') {
    const target = `https://www.marqlandstudios.com${req.url}`;
    return res.redirect(301, target);
  }

  // ── Task 3: Public site — www.marqlandstudios.com ─────────────────────────
  // Serve public-site build. No auth required, no mobile restrictions.
  // /p/* and /respond/* paths are NOT public-site — they fall through to the
  // admin panel section below so client portal links still work on this domain.
  const isPublicSite =
    host === 'marqlandstudios.com' ||
    host === 'www.marqlandstudios.com' ||
    // Legacy marqland.com — keep working during transition
    host === 'marqland.com' ||
    host === 'www.marqland.com';

  if (isPublicSite && !req.url.startsWith('/p/') && !req.url.startsWith('/respond/')) {
    return res.sendFile(path.join(publicBuildPath, 'index.html'));
  }

  // ── Task 2 & 4: Admin panel + client portal ────────────────────────────────
  // Covers:
  //   admin.marqlandstudios.com   → employee admin panel (all routes)
  //   www.marqlandstudios.com/p/* → client view portal   (Task 4)
  //   www.marqlandstudios.com/respond/* → vendor respond links

  // Public-facing catalogue/portal links — no mobile block, no auth wall
  if (req.url.startsWith('/p/') || req.url.startsWith('/respond/')) {
    return res.sendFile(path.join(internalBuildPath, 'index.html'));
  }

  // Block mobile from all internal admin routes except /paymenttracker
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  if (isMobile && !req.url.startsWith('/paymenttracker')) {
    return res.redirect(302, '/paymenttracker');
  }

  res.sendFile(path.join(internalBuildPath, 'index.html'));
});

// ─── Background Schedulers ────────────────────────────────────────────────────
startScheduler();         // Runs at 02:00 IST daily
startTrackingScheduler(); // Runs every 2 hours

/**
 * ─── CRON: Daily Outlook + WhatsApp Sync ─────────────────────────────────────
 * Runs daily at 10:00 AM IST.
 */
cron.schedule('0 10 * * *', async () => {
  console.log('--- Starting Scheduled Automation Task ---');
  let stats = { outlookStatus: 'Pending', invoicesCount: 0 };

  try {
    if (syncOutlookInvoices) {
      console.log('📡 Scanning Outlook for new invoices...');
      const syncResult = await syncOutlookInvoices();
      stats.outlookStatus = syncResult.success ? 'Success' : 'Failed';
      stats.invoicesCount = syncResult.processed || 0;
    } else {
      stats.outlookStatus = 'Sync function missing';
    }

    console.log('📱 Checking WhatsApp for invoices...');
    await whatsappService.syncWhatsAppInvoices();

    console.log('📱 Sending daily status report to WhatsApp...');
    await whatsappService.sendDailyStatus(stats);

  } catch (err) {
    console.error('❌ Global Cron Error:', err);
    await whatsappService.sendDailyStatus({
      outlookStatus: `Error: ${err.message}`,
      invoicesCount: 0
    }).catch(() => { });
  }

  console.log('--- Scheduled Task Cycle Finished ---');
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected.');
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Server Startup ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || (IS_PRODUCTION ? 80 : 5000);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`--------------------------------------------------`);
  console.log(`🚀 BIZ MANAGER SERVER IS LIVE  [${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  if (IS_PRODUCTION) {
    console.log(`🌐 Admin Panel     : https://admin.marqlandstudios.com`);
    console.log(`🌐 Public Site     : https://www.marqlandstudios.com`);
    console.log(`🌐 Client Portal   : https://www.marqlandstudios.com/p/*`);
    console.log(`↩️  Legacy redirect : https://internalportal.marqland.com → marqlandstudios.com`);
  } else {
    console.log(`🔧 API Server      : http://localhost:${PORT}`);
    console.log(`🔧 Internal Portal : http://localhost:3000  (React dev server)`);
    console.log(`🔧 Public Site     : http://localhost:3001  (React dev server)`);
    console.log(`💡 Set NODE_ENV=production in .env to switch to production mode`);
  }
  console.log(`--------------------------------------------------`);
});