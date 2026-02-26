const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); 
const app = express();
/**
 * 2. PARSER CONFIGURATION
 * Increased limit is mandatory for base64 images
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/**
 * 1. CORS CONFIGURATION
 * Allows other laptops in the office to make requests to this server.
 */
app.use(cors({
  origin: '*', // Allows all local network IPs
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

mongoose.connect('mongodb://127.0.0.1:27017/bizManager')
  .then(() => console.log('✅ Connected to MongoDB (bizManager)'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/catalogues', catalogueRoutes);
app.use('/api/properties', propertyRoutes); 
app.use('/api/offsitecatalogues', offsiteCatalogueRoutes);
app.use('/api/invoices',invoiceRoutes);
app.use('/api/orders',orderInquiry);
app.use('/api/challans', SamplesProvided);

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
  console.log(`🌐 Network: http://YOUR_PC_IP_HERE:${PORT}`);
  console.log(`--------------------------------------------------`);
});