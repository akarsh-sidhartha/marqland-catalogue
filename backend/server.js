const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const app = express();

const whatsappService = require('./services/whatsappService');
// We use path.resolve with __dirname to point specifically to the 'backend' folder
//const envPath = path.resolve(__dirname, '.env');
//const result = dotenv.config({ path: envPath });
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

const productRoutes = require('./routes/productRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const clientRoutes = require('./routes/clientRoutes');
const catalogueRoutes = require('./routes/catalogueRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const offsiteCatalogueRoutes = require('./routes/offsiteCatalogueRoutes');
const invoiceRoutes = require('./routes/invoiceRoute');
const orderInquiry = require('./routes/orderInquiry');
const SamplesProvided = require('./routes/samplesProvided');

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

// B. The Bulletproof Catch-all Middleware
// Instead of app.get('*') or app.get('/:slug'), we use a general middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  // If the request is for an API or a static file, skip this
  if (req.url.startsWith('/api') || req.url.startsWith('/public') || req.url.startsWith('/uploads')) {
    return next();
  }
  // Otherwise, send the index.html for React to handle the routing
  res.sendFile(path.join(buildPath, 'index.html'));
});

mongoose.connect('mongodb://127.0.0.1:27017/bizManager')
  .then(() => console.log('✅ Connected to MongoDB (bizManager)'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/catalogues', catalogueRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/offsitecatalogues', offsiteCatalogueRoutes);
app.use('/api/invoices', invoiceRoutes.router);
//app.use('/api/invoices',invoiceRoutes);
app.use('/api/orders', orderInquiry);
app.use('/api/challans', SamplesProvided);
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
const PORT = 80;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`--------------------------------------------------`);
  console.log(`🚀 BIZ MANAGER SERVER IS LIVE`);
  console.log(`🏠 Local:   http://localhost:${PORT}`);
  console.log(`📡 Tunnel:  https://internalportal.marqland.com`);
  console.log(`🌐 Network: http://YOUR_PC_IP_HERE:${PORT}`);
  console.log(`--------------------------------------------------`);
});