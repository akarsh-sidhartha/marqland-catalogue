import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getBaseUrl } from '../baseurl';
import {
  Search, Plus, Send, Paperclip, Mic, X, Filter,
  Link as LinkIcon, Archive, Trash2, ChevronDown,
  ChevronRight, RefreshCcw, User, Phone, MapPin
} from 'lucide-react';

/**
 * FIXED: Removed the relative import that was causing the build error.
 * In this environment, we define getBaseUrl locally or use a fallback.
 */
// const getBaseUrl = () => {
//   // Replace with your actual backend URL if needed
//   return window.location.origin.replace('3000', '5000'); 
// };

const SourcingHub = () => {

  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Data States
  const [inquiries, setInquiries] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [activeTab, setActiveTab] = useState('live');
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filter States (For Right Panes in Modals)
  const [catFilter, setCatFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  // Form States
  const [newInq, setNewInq] = useState({
    clientName: '', quantity: '', deadline: '',
    internalNotes: '', publicDescription: '', targetVendors: [], attachments: []
  });

  const [broadcast, setBroadcast] = useState({
    message: '', attachments: [], targetVendors: []
  });

  // 1. Fetch Data on Mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [inqRes, venRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/inquiries`),
        axios.get(`${getBaseUrl()}/vendors`)
      ]);
      setInquiries(inqRes.data);
      setVendors(venRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Triggered when button is clicked
  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 3. THE FILE CHANGE HANDLER
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      // NOTE: For a real app, upload these to Cloudinary/S3 here.
      // For now, we create local preview URLs.
      const newFileUrls = files.map(file => URL.createObjectURL(file));

      setSelectedFiles(prev => [...prev, ...newFileUrls]);

      // Update the inquiry object so it's ready for the backend
      setNewInq(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...newFileUrls]
      }));
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    setNewInq(prev => ({ ...prev, attachments: updated }));
  };

  // 2. Shared Filtering Logic for Vendor List in Modals
  const getFilteredVendors = () => {
    return vendors.filter(v => {
      const matchesCat = catFilter === '' || v.category === catFilter;
      const matchesState = stateFilter === '' || (v.state && v.state.toLowerCase().includes(stateFilter.toLowerCase()));
      const matchesSearch = v.companyName.toLowerCase().includes(vendorSearch.toLowerCase());
      return matchesCat && matchesState && matchesSearch;
    });
  };

  const handleSelectAll = (isInquiryModal) => {
    const filtered = getFilteredVendors();
    const formatted = filtered.map(v => ({
      vendorId: v._id,
      phone: v.contacts?.[0]?.phone || '',
      companyName: v.companyName
    }));

    if (isInquiryModal) {
      setNewInq(prev => ({ ...prev, targetVendors: formatted }));
    } else {
      setBroadcast(prev => ({ ...prev, targetVendors: formatted }));
    }
  };

  // 3. Actions
  const handleCreateInquiry = async () => {
    if (!newInq.clientName || newInq.targetVendors.length === 0) return alert("Fill required fields and select vendors");
    try {
      await axios.post(`${getBaseUrl()}/inquiries`, newInq);
      setShowInquiryModal(false);
      setNewInq({ clientName: '', quantity: '', deadline: '', internalNotes: '', publicDescription: '', targetVendors: [] });
      fetchInitialData();
    } catch (err) { alert("Failed to send inquiry"); }
  };

  const handleSendBroadcast = async () => {
    if (!broadcast.message || broadcast.targetVendors.length === 0) return alert("Message and Vendors required");
    try {
      await axios.post(`${getBaseUrl()}/inquiries/broadcast`, broadcast);
      setShowBroadcastModal(false);
      setBroadcast({ message: '', attachments: [], targetVendors: [] });
      alert("Broadcast sent successfully!");
    } catch (err) { alert("Failed to send broadcast"); }
  };
  const handleArchive = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'archived' ? 'live' : 'archived';
      await axios.put(`${getBaseUrl()}/inquiries/${id}`, { status: newStatus });
      // Refresh list
      const res = await axios.get(`${getBaseUrl()}/inquiries`);
      setInquiries(res.data);
    } catch (err) {
      console.error("Error archiving:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this inquiry?")) return;
    try {
      await axios.delete(`${getBaseUrl()}/inquiries/${id}`);
      setInquiries(inquiries.filter(inq => inq._id !== id));
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };
  const copyPublicLink = (id) => {
    const link = `${window.location.origin}/respond/${id}`;
    navigator.clipboard.writeText(link);
    alert("Public Vendor Link copied to clipboard!");
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Sourcing Hub</h1>
          <p className="text-slate-400 font-bold text-xs uppercase">Vendor Engagement & Inquiry Tracking</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Send size={16} /> Quick Broadcast
          </button>
          <button
            onClick={() => setShowInquiryModal(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus size={16} /> New Inquiry
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('live')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'live' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Live</button>
            <button onClick={() => setActiveTab('archived')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'archived' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Archive</button>
          </div>
          <button onClick={fetchInitialData} className="p-2 text-slate-400 hover:rotate-180 transition-transform duration-500"><RefreshCcw size={18} /></button>
        </div>

        <table className="w-full text-left">
          <thead className="bg-white border-b border-slate-100">
            <tr className="text-[10px] font-black uppercase text-slate-400">
              <th className="px-8 py-5">Client & Inquiry</th>
              <th className="px-8 py-5">Vendors Reached</th>
              <th className="px-8 py-5 text-center">Responses</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {inquiries.filter(i => i.status === (activeTab === 'live' ? 'active' : 'archived')).map(inq => (
              <React.Fragment key={inq._id}>
                <tr className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="font-black text-slate-800 uppercase text-sm">{inq.clientName}</div>
                    <div className="text-xs text-slate-400 font-medium truncate max-w-xs">{inq.publicDescription}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg inline-block">
                      {inq.targetVendors?.length || 0} TARGETED
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <button
                      onClick={() => setExpandedRow(expandedRow === inq._id ? null : inq._id)}
                      className="px-4 py-2 rounded-xl border-2 border-green-100 bg-green-50 text-green-600 font-black text-[10px] uppercase flex items-center gap-2 mx-auto"
                    >
                      {inq.responses?.length || 0} REVERTS
                      {expandedRow === inq._id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                  <td className="px-8 py-6 text-right space-x-1">
                    <button
                      onClick={() => copyPublicLink(inq._id)}
                      title="Copy Link"
                      className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <LinkIcon size={18} />
                    </button>

                    <button
                      onClick={() => handleArchive(inq._id, inq.status)}
                      title={inq.status === 'archived' ? "Unarchive" : "Archive"}
                      className={`p-2 rounded-lg transition-all ${inq.status === 'archived'
                        ? 'text-amber-600 bg-amber-50'
                        : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'
                        }`}
                    >
                      <Archive size={18} />
                    </button>

                    <button
                      onClick={() => handleDelete(inq._id)}
                      title="Delete"
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
                {/* Expanded Row for Responses */}
                {expandedRow === inq._id && (
                  <tr>
                    <td colSpan="4" className="bg-slate-50/50 px-12 py-8 border-y border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {inq.responses?.length > 0 ? inq.responses.map((res, idx) => (
                          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div className="font-black text-xs text-slate-800 uppercase">{res.companyName}</div>
                              <div className="text-indigo-600 font-black text-xs">₹{res.cost}</div>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Delivery: {res.deliveryDate}</div>
                            {res.notes && <div className="mt-3 text-[11px] text-slate-600 italic">"{res.notes}"</div>}
                          </div>
                        )) : (
                          <div className="col-span-3 text-center py-10 text-slate-300 font-black uppercase text-xs tracking-widest">Awaiting Responses...</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MODAL WRAPPER --- */}
      {(showInquiryModal || showBroadcastModal) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3rem] flex overflow-hidden shadow-2xl">

            {/* LEFT PANE */}
            <div className="flex-1 p-12 overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                  {showInquiryModal ? "Create New Inquiry" : "Direct Message Broadcast"}
                </h2>
              </div>

              {showInquiryModal ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Client Name</label>
                      <input
                        value={newInq.clientName}
                        onChange={e => setNewInq({ ...newInq, clientName: e.target.value })}
                        className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 ring-indigo-500 font-bold"
                        placeholder="e.g. Google India"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Quantity</label>
                      <input
                        value={newInq.quantity}
                        onChange={e => setNewInq({ ...newInq, quantity: e.target.value })}
                        className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 ring-indigo-500 font-bold"
                        placeholder="e.g. 500 Units"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Internal Notes (Private)</label>
                    <textarea
                      value={newInq.internalNotes}
                      onChange={e => setNewInq({ ...newInq, internalNotes: e.target.value })}
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 ring-slate-200 font-bold h-24"
                      placeholder="Pricing strategy, margin details etc..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 text-indigo-600">Notes to Vendor (Public)</label>
                    <textarea
                      value={newInq.publicDescription}
                      onChange={e => setNewInq({ ...newInq, publicDescription: e.target.value })}
                      className="w-full p-4 bg-indigo-50/30 border-2 border-dashed border-indigo-100 rounded-3xl focus:ring-2 ring-indigo-500 font-bold h-32"
                      placeholder="Describe what you need the vendor to see..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Message Content</label>
                    <textarea
                      value={broadcast.message}
                      onChange={e => setBroadcast({ ...broadcast, message: e.target.value })}
                      className="w-full p-6 bg-slate-50 rounded-[2rem] border-none focus:ring-2 ring-indigo-500 font-bold h-64"
                      placeholder="Type your message here..."
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-4">
                {/* 4. ADD THE HIDDEN INPUT SOMEWHERE IN YOUR RENDER */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  accept="image/*,application/pdf"
                />
                <button
                  onClick={handleAttachClick}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 rounded-xl font-black text-[10px] uppercase text-slate-500 hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  <Paperclip size={16} />
                  {isUploading ? "Uploading..." : "Attach Files"}
                </button>
                {/* Preview of attached files */}

                {/* 5. PREVIEW SECTION */}
                {selectedFiles.length > 0 && (
                  <div className="flex gap-3 mt-4 overflow-x-auto p-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="relative group w-20 h-20 bg-white rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 shadow-sm">
                        {/* Simple check: if it looks like a PDF, show icon, else show image */}
                        {file.includes('pdf') ? (
                          <div className="w-full h-full flex items-center justify-center bg-red-50 text-[10px] font-bold text-red-500">PDF</div>
                        ) : (
                          <img src={file} className="w-full h-full object-cover" alt="preview" />
                        )}

                        <button
                          onClick={() => removeFile(idx)}
                          className="absolute top-1 right-1 bg-slate-900/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT PANE: Vendor Selection */}
            <div className="w-[450px] bg-slate-50 border-l border-slate-200 flex flex-col">
              <div className="p-8 border-b border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-xs uppercase text-slate-400">Target Vendors</h3>
                  <button
                    onClick={() => handleSelectAll(showInquiryModal)}
                    className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                  >
                    Select All Filtered
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-xs font-bold border border-slate-200 outline-none focus:ring-2 ring-indigo-500"
                      placeholder="Search company..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="p-2 bg-white rounded-xl text-[10px] font-black uppercase border-slate-200 outline-none"
                      value={catFilter}
                      onChange={(e) => setCatFilter(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {[...new Set(vendors.map(v => v.category))].filter(Boolean).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input
                      className="p-2 bg-white rounded-xl text-[10px] font-black uppercase border-slate-200 outline-none"
                      placeholder="State"
                      value={stateFilter}
                      onChange={(e) => setStateFilter(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {getFilteredVendors().length > 0 ? getFilteredVendors().map(v => {
                  const target = showInquiryModal ? newInq : broadcast;
                  const isSelected = target.targetVendors.find(tv => tv.vendorId === v._id);

                  return (
                    <div
                      key={v._id}
                      onClick={() => {
                        const setTarget = showInquiryModal ? setNewInq : setBroadcast;
                        const exists = target.targetVendors.find(tv => tv.vendorId === v._id);

                        if (exists) {
                          setTarget({ ...target, targetVendors: target.targetVendors.filter(tv => tv.vendorId !== v._id) });
                        } else {
                          setTarget({
                            ...target, targetVendors: [...target.targetVendors, {
                              vendorId: v._id,
                              phone: v.contacts?.[0]?.phone || '',
                              companyName: v.companyName
                            }]
                          });
                        }
                      }}
                      className={`p-4 rounded-[1.5rem] cursor-pointer transition-all border-2 flex items-center gap-4 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-white text-slate-600 hover:border-indigo-100'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                        {v.companyName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-[11px] uppercase truncate">{v.companyName}</div>
                        <div className={`text-[9px] font-bold uppercase opacity-60 flex items-center gap-1 mt-0.5`}>
                          <MapPin size={10} /> {v.state || 'N/A'} • {v.category || 'N/A'}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-20 opacity-20 font-black uppercase text-xs">No Vendors Found</div>
                )}
              </div>

              <div className="p-8 bg-white border-t border-slate-100">
                <div className="flex items-center justify-between mb-4 px-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Selected Recipient(s)</span>
                  <span className="text-sm font-black text-indigo-600">
                    {showInquiryModal ? newInq.targetVendors.length : broadcast.targetVendors.length}
                  </span>
                </div>
                <button
                  onClick={showInquiryModal ? handleCreateInquiry : handleSendBroadcast}
                  className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Send size={18} /> {showInquiryModal ? "Launch Inquiry" : "Send Broadcast"}
                </button>
                <button
                  onClick={() => { setShowInquiryModal(false); setShowBroadcastModal(false); }}
                  className="w-full mt-4 text-slate-400 font-black text-[10px] uppercase hover:text-slate-600"
                >
                  Discard & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourcingHub;