const mongoose = require('mongoose');

const OrderInquirySchema = new mongoose.Schema({
  // Mandatory core fields
  title: { 
    type: String, 
    required: [true, 'Project title is required'], 
    trim: true 
  },
  clientName: { 
    type: String, 
    required: [true, 'Client name is required'], 
    trim: true 
  },
  description: { 
    type: String, 
    required: [true, 'Description is required'], 
    trim: true 
  },
  orderPlacedBy: { 
    type: String, 
    required: [true, 'Assignee/Order placer is required'], 
    trim: true 
  },
  
  // Optional at creation, added later during quote approval
  refNumber: { 
    type: String, 
    trim: true 
  }, 

    // ADDED: Invoice Number required for archiving/completion
  invoiceNumber: {
    type: String,
    trim: true
  },
  
  // Status Tracking: inquiry, ongoing, completed
  status: { 
    type: String, 
    enum: ['inquiry', 'ongoing', 'completed'], 
    default: 'inquiry' 
  },

  // Attachments: Fully optional array
  attachments: [{
    fileName: String,
    fileType: String, // image, pdf, excel, word
    data: String,     // base64 data
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Metadata
  budget: { type: Number },
  deadline: { type: Date },
  completedAt: { type: Date }, 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  // Automatically manage createdAt and updatedAt timestamps
  timestamps: true
});

module.exports = mongoose.model('OrderInquiry', OrderInquirySchema);