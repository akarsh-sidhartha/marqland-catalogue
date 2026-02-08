const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  // Vendor Identity
  vendor_name: { 
    type: String, 
    default: 'Unknown Vendor' 
  },
  vendor_gst: { 
    type: String, 
    default: '' 
  }, // Added for GST recording

  // Invoice Specifics
  invoice_number: { 
    type: String, 
    default: '---' 
  },
  date: { 
    type: String 
  },
  currency: { 
    type: String, 
    default: 'INR' 
  },

  // Financial Breakdown
  total_amount: { 
    type: Number, 
    default: 0 
  },
  cgst: { 
    type: Number, 
    default: 0 
  }, // Added for Central GST
  sgst: { 
    type: Number, 
    default: 0 
  }, // Added for State GST
  igst: { 
    type: Number, 
    default: 0 
  }, // Added for Integrated GST
  
  // Legacy field (can be used for total tax sum if preferred)
  tax_amount: { 
    type: Number, 
    default: 0 
  },

  // Organization/Filing Data
  financialYear: { 
    type: String 
  }, // e.g., "2024-2025"
  month: { 
    type: String 
  }, // e.g., "August"

  // Storage
  image: { 
    type: String 
  }, // Base64 string
  mimeType: { 
    type: String, 
    default: 'image/jpeg' 
  },

  // Optional Itemized details
  items: [
    {
      description: String,
      quantity: Number,
      total: Number
    }
  ],
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);