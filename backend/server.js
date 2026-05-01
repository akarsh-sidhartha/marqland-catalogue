const dotenv = require('dotenv');
// ⚠ MUST call before any require that reads process.env (authRoutes, msGraph, etc.)
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const app = express();

const whatsappService = require('./services/whatsappService');
const { startScheduler } = require('./services/trendingProductService');
const { startTrackingScheduler } = require('./services/shipmentTrackingService');

/**
 * 1. CORS CONFIGURATION
 * Allows other laptops in the office to make requests to this server.
 * Restricts to known origins for security — update ALLOWED_ORIGINS in .env as needed.
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5000',, 'https://internalportal.marqland.com', 'https://www.marqland.com'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// FIX: Removed duplicate express.json() — keeping only the one with size limit
app.use(express.json({ limit: '100mb' })); // Reduced from 500mb — adjust if large image uploads are required
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ─── Route Imports ────────────────────────────────────────────────────────────

// www.marqland.com routes
const publicSiteRoutes = require('./routes/public-site/publicSiteRoutes');

// www.internalportal.marqland.com Routes
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
const logRoutes = require('./routes/logRoutes');
const imageProcessing = require('./routes/imageProcessingRoutes');
const trendingProductRoutes = require('./routes/trendingProductRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const shippingPartnerRoutes = require('./routes/shippingPartnerRoutes');
const leadScoutRoutes = require('./routes/leadScoutRoutes');
const clientPortalRoutes = require('./routes/clientPortalRoutes');

// ─── Static File Serving ──────────────────────────────────────────────────────
/**
 * 2. STATIC FILE SERVING
 * Ensures that images uploaded by one person are visible to
 * everyone else on their laptops.
 */
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// React build folder
const buildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(buildPath));

// ─── Database ─────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bizManager';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB (bizManager)'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1); // Exit early — app cannot function without DB
  });

// ─── Middleware ───────────────────────────────────────────────────────────────
// Activity logger — intercepts all API mutations, uses req.originalUrl for full path matching
app.use(activityLogger);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/catalogues', catalogueRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/offsitecatalogues', offsiteCatalogueRoutes);
app.use('/api/orders', orderInquiry);
app.use('/api/challans', SamplesProvided);
app.use('/api/inquiries', SourcingHub);
app.use('/api/auth', authRoutes);
app.use('/api/payment-tracker', paymentTracker);
app.use('/api/image-processing', imageProcessing);
app.use('/api/trending-products', trendingProductRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/shipping-partners', shippingPartnerRoutes);
app.use('/api/lead-scout', leadScoutRoutes);
app.use('/api/public-site', publicSiteRoutes);
app.use('/api/portal', clientPortalRoutes);
app.use('/api/logs', logRoutes); // Admin only

// ─── Global Error Handler ─────────────────────────────────────────────────────
// FIX: Added — catches any unhandled errors thrown in route handlers
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

// ─── Catch-All: Serve React ───────────────────────────────────────────────────
// MUST be after all API routes
app.use((req, res, next) => {
  if (
    req.url.startsWith('/api') ||
    req.url.startsWith('/public') ||
    req.url.startsWith('/uploads')
  ) {
    return next();
  }

  // Public portal and vendor links — always serve React regardless of device
  if (req.url.startsWith('/p/') || req.url.startsWith('/respond/')) {
    return res.sendFile(path.join(buildPath, 'index.html'));
  }

  // Detect mobile User-Agent
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // Block mobile from all routes except /paymenttracker (302 = not cached by browser)
  if (isMobile && !req.url.startsWith('/paymenttracker')) {
    return res.redirect(302, '/paymenttracker');
  }

  res.sendFile(path.join(buildPath, 'index.html'));
});

// ─── Background Schedulers ────────────────────────────────────────────────────
startScheduler();        // Runs at 02:00 IST daily
startTrackingScheduler(); // Runs every 2 hours

/**
 * 5. AUTOMATED TASKS (CRON)
 * Runs daily at 10:00 AM (IST) to sync Outlook invoices and
 * send a status report to WhatsApp.
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
// FIX: Added — ensures MongoDB disconnects cleanly on process termination
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
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Server Startup ───────────────────────────────────────────────────────────
/**
 * Listening on '0.0.0.0' makes the server accessible via your IP address
 * on the local office network.
 * NOTE: Running on port 80 requires root/admin. Consider using port 3001
 * behind an Nginx reverse proxy for better security and stability.
 */
const PORT = process.env.PORT || 80;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`--------------------------------------------------`);
  console.log(`🚀 BIZ MANAGER SERVER IS LIVE`);
  console.log(`🏠 Local:   http://localhost:${PORT}`);
  console.log(`📡 Tunnel:  https://internalportal.marqland.com`);
  console.log(`🌐 Network: http://YOUR_PC_IP_HERE:${PORT}`);
  console.log(`--------------------------------------------------`);
});