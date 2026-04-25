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
 */
app.use(cors({
  origin: '*', // Allows all local network IPs
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const clientRoutes = require('./routes/clientRoutes');
const catalogueRoutes = require('./routes/catalogueRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const offsiteCatalogueRoutes = require('./routes/offsiteCatalogueRoutes');
//const invoiceRoutes = require('./routes/invoiceRoute');
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
/**
 * 2. STATIC FILE SERVING
 * This ensures that images uploaded by one person are visible to 
 * everyone else on their own laptops.
 */
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Path to React build folder
const buildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(buildPath));

// [catch-all moved below API routes — see end of route registrations]

mongoose.connect('mongodb://127.0.0.1:27017/bizManager')
  .then(() => console.log('✅ Connected to MongoDB (bizManager)'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Activity logger — intercepts all API mutations, uses req.originalUrl for full path matching
app.use(activityLogger);

app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/catalogues', catalogueRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/offsitecatalogues', offsiteCatalogueRoutes);
//app.use('/api/invoices', invoiceRoutes.router);
app.use('/api/orders', orderInquiry);
app.use('/api/challans', SamplesProvided);
app.use('/api/inquiries', SourcingHub);
app.use('/api/auth', authRoutes);
app.use('/api/payment-tracker', paymentTracker);
app.use('/api/image-processing', imageProcessing);
app.use('/api/trending-products', trendingProductRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/shipping-partners', shippingPartnerRoutes);

// Client Portal routes
const clientPortalRoutes = require('./routes/clientPortalRoutes');
app.use('/api/portal', clientPortalRoutes);

// Activity logs — admin only
app.use('/api/logs', logRoutes);

// Catch-all: serve React for any non-API route (MUST be after all API routes)
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  if (req.url.startsWith('/api') || req.url.startsWith('/public') || req.url.startsWith('/uploads')) {
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
  if (isMobile && req.url !== '/paymenttracker' && !req.url.startsWith('/paymenttracker')) {
    return res.redirect(302, '/paymenttracker');
  }

  res.sendFile(path.join(buildPath, 'index.html'));
});


startScheduler(); // Start background scheduler (runs at 02:00 IST daily)
startTrackingScheduler(); // Start the 2-hour background tracking scheduler:

/**
 * 5. AUTOMATED TASKS (CRON)
 * Runs daily at 10:00 AM (IST) to sync Outlook invoices and 
 * send a status report to your WhatsApp.
 */
cron.schedule('0 10 * * *', async () => {
  console.log("--- Starting Scheduled Automation Task ---");
  let stats = { outlookStatus: "Pending", invoicesCount: 0 };

  try {
    // Trigger the Outlook Sync function exported from invoiceRoute
    if (invoiceRoutes.syncOutlookInvoices) {
      console.log("📡 Scanning Outlook for new invoices...");
      const syncResult = await invoiceRoutes.syncOutlookInvoices();
      stats.outlookStatus = syncResult.success ? "Success" : "Failed";
      stats.invoicesCount = syncResult.processed || 0;
    } else {
      stats.outlookStatus = "Sync function missing";
    }
    console.log("📱 Checking WhatsApp for invoices...");
    // You need to implement this 'syncWhatsAppInvoices' in your service
    await whatsappService.syncWhatsAppInvoices();
    // Send the summary report via WhatsApp
    console.log("📱 Sending daily status report to WhatsApp...");
    await whatsappService.sendDailyStatus(stats);

  } catch (err) {
    console.error("❌ Global Cron Error:", err);
    // Alert admin of the system error
    await whatsappService.sendDailyStatus({
      outlookStatus: `Error: ${err.message}`,
      invoicesCount: 0
    }).catch(() => { });
  }

  console.log("--- Scheduled Task Cycle Finished ---");
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});


/**
 * 5. SERVER STARTUP
 * Listening on '0.0.0.0' makes the server accessible via your IP address
 * on the local office network.
 */
const PORT = 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`--------------------------------------------------`);
  console.log(`🚀 BIZ MANAGER SERVER IS LIVE`);
  console.log(`🏠 Local:   http://localhost:${PORT}`);
  console.log(`📡 Tunnel:  https://internalportal.marqland.com`);
  console.log(`🌐 Network: http://YOUR_PC_IP_HERE:${PORT}`);
  console.log(`--------------------------------------------------`);
});