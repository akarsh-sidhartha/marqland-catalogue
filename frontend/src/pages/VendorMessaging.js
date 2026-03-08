import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Plus, Check, X, Search, ArrowLeft, 
  Send, Package, MessageCircle, FileText, 
  Video, User, Building2
} from 'lucide-react';
import { getBaseUrl } from '../baseurl';
// Self-contained helper to avoid resolution errors
/*
const getBaseUrl = () => {
  const { hostname } = window.location;
  const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
    ? 'localhost' 
    : hostname;
  return `http://${host}:5000/api`;
};
*/
/**
 * VendorMessaging Component
 * Dedicated view for selecting vendor contacts and sending product broadcasts.
 * Syncs selected products from localStorage if props are missing (e.g., new tab).
 */
const VendorMessaging = ({ selectedProducts: propsProducts = [], onBack, onClearSelection }) => {
  const [vendors, setVendors] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Local state for products to handle tab-syncing from localStorage
  const [selectedProducts, setSelectedProducts] = useState([]);

  // File attachments state
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterState, setFilterState] = useState('');

  const API_URL = getBaseUrl();

  // 1. Sync Products from LocalStorage or Props
  useEffect(() => {
    if (propsProducts && propsProducts.length > 0) {
      setSelectedProducts(propsProducts);
    } else {
      const saved = localStorage.getItem('broadcast_products');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSelectedProducts(parsed);
        } catch (e) {
          console.error("Failed to parse saved products:", e);
        }
      }
    }
  }, [propsProducts]);

  // 2. Fetch Vendors (Retrieves contacts from vendor objects)
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        // Using the existing route from vendorRoutes.js
        const res = await axios.get(`${API_URL}/vendors`);
        setVendors(res.data);
        
        // Flatten all vendor contacts into one searchable list for the UI
        const allContacts = res.data.flatMap(v => 
          (v.contacts || []).map(c => ({
            ...c,
            vendorName: v.companyName,
            vendorCategory: v.category,
            description: v.suppliedProducts,
            vendorState: v.state,
            vendorId: v._id
          }))
        );
        setContacts(allContacts);
      } catch (err) {
        console.error("Error fetching vendors:", err);
      }
    };
    fetchVendors();
  }, [API_URL]);

  // 3. Filter logic
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !filterCategory || c.vendorCategory === filterCategory;
    const matchesState = !filterState || c.vendorState === filterState;

    return matchesSearch && matchesCategory && matchesState;
  });

  const toggleContact = (contact) => {
    const exists = selectedContacts.find(sc => sc.phone === contact.phone && sc.vendorId === contact.vendorId);
    if (exists) {
      setSelectedContacts(selectedContacts.filter(sc => !(sc.phone === contact.phone && sc.vendorId === contact.vendorId)));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(f => ({
      file: f,
      name: f.name,
      type: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file',
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

const handleSendBroadcast = async () => {
    // 1. Validation
    if (selectedContacts.length === 0) {
      alert("Please select at least one contact to send a message.");
      return;
    }

    if (!message && selectedProducts.length === 0 && attachments.length === 0) {
      alert("Please enter a message or select products/files to broadcast.");
      return;
    }

    setIsSending(true);

    try {
      // 2. Prepare payload
      // We combine selectedProducts (images) and manually uploaded attachments
      // into a single 'attachments' array for the sequential backend.
      const productAttachments = selectedProducts.map(p => ({
        url: p.imageUrl.startsWith('http') ? p.imageUrl : `${window.location.origin}${p.imageUrl}`,
        name: p.name,
        type: 'image/jpeg' // Assuming product images are jpegs
      }));

      const payload = {
        contacts: selectedContacts.map(c => ({
          name: c.name,
          phone: c.phone, 
          email: c.email
        })),
        // This maps to Body Parameter 2 in your WhatsApp Template
        message: message || "New products available for review.", 
        // We send all media here to be processed sequentially
        attachments: [...productAttachments, ...attachments]
      };

      // 3. API Call
      const response = await axios.post(`${getBaseUrl()}/whatsapp/broadcast`, payload);

      // 4. Handle Response
      const { summary } = response.data;

      if (summary.failed && summary.failed.length > 0) {
        alert(`Broadcast partially sent: ${summary.success.length} successful, ${summary.failed.length} failed.`);
      } else {
        alert(`Success! Message transmitted to all ${selectedContacts.length} contacts.`);
        
        // 5. Cleanup UI
        setMessage('');
        setSelectedContacts([]);
        setAttachments([]);
        if (onClearSelection) onClearSelection(); 
      }

    } catch (err) {
      console.error("Broadcast transmission error:", err);
      const errorMessage = err.response?.data?.message || "Connection to messaging server failed.";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack || (() => window.close())}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight">Broadcast Messaging</h1>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Target Vendor Network</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
            <Package size={14} className="text-indigo-600" />
            <span className="text-xs font-black text-indigo-700">
              {selectedProducts.length} Products Linked
            </span>
          </div>
        </div>
      </div>

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-73px)]">
        {/* Left Column: Contact Selection */}
        <div className="w-full lg:w-1/2 border-r border-slate-100 flex flex-col bg-white">
          <div className="p-6 border-b border-slate-50">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="text"
                placeholder="Search by name or company..."
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              <select 
                className="bg-slate-50 border-none text-xs font-bold rounded-xl px-4 py-2 focus:ring-0"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {[...new Set(vendors.map(v => v.category))].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select 
                className="bg-slate-50 border-none text-xs font-bold rounded-xl px-4 py-2 focus:ring-0"
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
              >
                <option value="">All States</option>
                {[...new Set(vendors.map(v => v.state))].map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              <button 
                onClick={() => setSelectedContacts(filteredContacts)}
                className="whitespace-nowrap bg-indigo-50 text-indigo-600 text-xs font-black px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
              >
                Select All Visible
              </button>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
            <div className="grid grid-cols-1 gap-3">
              {filteredContacts.length > 0 ? filteredContacts.map((contact, idx) => {
                const isSelected = selectedContacts.some(sc => sc.phone === contact.phone && sc.vendorId === contact.vendorId);
                return (
                  <div 
                    key={`${contact.vendorId}-${idx}`}
                    onClick={() => toggleContact(contact)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-50 hover:border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {contact.name?.charAt(0) || <User size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{contact.name} {contact.vendorName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 size={12} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{contact.description}</span>
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="bg-indigo-600 text-white p-1 rounded-lg">
                        <Check size={16} strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg border-2 border-slate-100 group-hover:border-slate-200"></div>
                    )}
                  </div>
                );
              }) : (
                <div className="text-center py-20">
                    <User size={40} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No matching contacts found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Message Content */}
        <div className="w-full lg:w-1/2 flex flex-col bg-slate-50/50">
          <div className="p-8 flex-grow overflow-y-auto custom-scrollbar">
            <div className="max-w-xl mx-auto">
              <div className="mb-8">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Message Content</h3>
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                    <MessageCircle size={18} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Broadcast Template</span>
                  </div>
                  <textarea 
                    placeholder="Enter your message details here..."
                    className="w-full p-6 border-none focus:ring-0 min-h-[150px] font-medium text-slate-700 resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>

              {/* Selected Products Preview */}
              {selectedProducts.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Linked Products</h3>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {selectedProducts.map(p => (
                      <div key={p._id} className="flex-shrink-0 w-40 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-full aspect-square bg-slate-50 rounded-xl mb-2 overflow-hidden">
                           {p.imageUrl ? (
                             <img 
                               src={`${getBaseUrl().replace('/api','')}${p.imageUrl}`} 
                               alt={p.name} 
                               className="w-full h-full object-cover" 
                               onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image'; }}
                             />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-200 font-black">
                               {p.name?.charAt(0)}
                             </div>
                           )}
                        </div>
                        <p className="text-[10px] font-black truncate">{p.name}</p>
                        <p className="text-indigo-600 font-bold text-[10px]">₹{p.purchasePrice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Media Attachments</h3>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-indigo-600 hover:scale-105 transition-transform"
                  >
                    <Plus size={20} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  {attachments.map((at, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white">
                      {at.type === 'image' ? (
                        <img src={at.preview} className="w-full h-full object-cover" alt="preview" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                           {at.type === 'video' ? <Video size={20} /> : <FileText size={20} />}
                        </div>
                      )}
                      <button 
                        onClick={() => removeAttachment(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                disabled={selectedContacts.length === 0 || isSending}
                onClick={handleSendBroadcast}
                className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-300 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all text-white shadow-xl shadow-indigo-100"
              >
                {isSending ? 'Sending Broadcast...' : `Transmit to ${selectedContacts.length} Contacts`}
                {!isSending && <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default VendorMessaging;