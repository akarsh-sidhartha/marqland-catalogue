import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { getBaseUrl } from '../baseurl';
import { 
  Plus, Trash2, Truck, Search, Calendar, Hash, Package, 
  Camera, X, Check, AlertCircle, ChevronRight, User, 
  FileText, Archive, Filter, Eye, Edit3, Image as ImageIcon,
  ShieldAlert, ClipboardEdit, Paperclip, Info, Clock, AlertTriangle,
  CheckCircle2, Upload, Download, File, ExternalLink
} from 'lucide-react';

/*
const getBaseUrl = () => {
  const { hostname } = window.location;
  const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
    ? 'localhost' 
    : hostname;
  return `http://${host}:5000/api`;
};
*/

const SamplesProvided = () => {
  const [challans, setChallans] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); 
  const [activeTab, setActiveTab] = useState('open');
  const [showModal, setShowModal] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [modalMode, setModalMode] = useState('edit'); 
  const [currentChallan, setCurrentChallan] = useState(null);
  const [settleReason, setSettleReason] = useState('');
  const [targetSettleId, setTargetSettleId] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = `${getBaseUrl()}/challans`;

  useEffect(() => {
    fetchChallans();
  }, []);

  const fetchChallans = async () => {
    try {
      const res = await axios.get(API_URL);
      setChallans(res.data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleSave = async () => {
    if (!currentChallan.challanNumber || !currentChallan.clientName) return;
    setLoading(true);
    try {
      if (currentChallan._id) {
        await axios.put(`${API_URL}/${currentChallan._id}`, currentChallan);
      } else {
        await axios.post(API_URL, currentChallan);
      }
      fetchChallans();
      setShowModal(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setLoading(false);
    }
  };

  const initiateSettle = (challan) => {
    const hasPending = challan.samples.some(s => s.qtyMissing > 0);
    setTargetSettleId(challan._id);
    setSettleReason('');
    setShowSettleConfirm(true);
  };

  const handleSettleConfirm = async () => {
    try {
      const challan = challans.find(c => c._id === targetSettleId);
      // Apply the reason to all samples with missing items
      const updatedSamples = challan.samples.map(s => ({
        ...s,
        writeOffRemarks: s.qtyMissing > 0 ? settleReason : s.writeOffRemarks
      }));
  
      await axios.put(`${API_URL}/${targetSettleId}`, { 
        status: 'settled',
        settledAt: new Date(),
        samples: updatedSamples,
        dcAttachments: challan.dcAttachments
      });
      fetchChallans();
      setShowSettleConfirm(false);
    } catch (err) {
      console.error("Settle error:", err);
    }
  };

  const openAddModal = () => {
    setModalMode('edit');
    setCurrentChallan({
      challanNumber: `CH-${Date.now().toString().slice(-6)}`,
      clientName: '',
      orderedBy: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      samples: [],
      dcAttachments: [],
      status: 'open'
    });
    setShowModal(true);
  };

  const openEditModal = (challan) => {
    setModalMode('edit');
    setCurrentChallan({ ...challan });
    setShowModal(true);
  };

  const openViewModal = (challan) => {
    setModalMode('view');
    setCurrentChallan({ ...challan });
    setShowModal(true);
  };

  const filteredChallans = useMemo(() => {
    return challans.filter(c => {
      const matchesTab = c.status === activeTab;
      const matchesSearch = 
        c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = clientFilter === '' || c.clientName === clientFilter;
      
      let matchesDate = true;
      if (dateFilter === 'older') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        matchesDate = new Date(c.date) < oneMonthAgo;
      }
      return matchesTab && matchesSearch && matchesClient && matchesDate;
    });
  }, [challans, activeTab, searchTerm, clientFilter, dateFilter]);

  const clients = useMemo(() => [...new Set(challans.map(c => c.clientName))], [challans]);

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleDCUpload = async (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = await Promise.all(files.map(async file => ({
      name: file.name,
      type: file.type,
      size: (file.size / 1024).toFixed(1) + ' KB',
      data: await toBase64(file)
    })));
    
    setCurrentChallan(prev => ({
      ...prev,
      dcAttachments: [...(prev.dcAttachments || []), ...newAttachments]
    }));
  };

  const removeItem = (id) => {
    setCurrentChallan(prev => ({
      ...prev,
      samples: prev.samples.filter(s => s.id !== id)
    }));
  };

  const updateItem = (id, field, value) => {
    setCurrentChallan(prev => ({
      ...prev,
      samples: prev.samples.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const isOlderThanMonth = (dateString) => {
    const date = new Date(dateString);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return date < oneMonthAgo;
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const viewFile = (file) => {
    const win = window.open();
    win.document.write(`<iframe src="${file.data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  };

  const ItemFileDrop = ({ item, onFileSelect, disabled }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const handleDrop = async (e) => {
      e.preventDefault();
      if (disabled) return;
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const base64 = await toBase64(file);
        onFileSelect(base64);
      }
    };

    return (
      <div 
        onClick={() => !disabled && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-14 h-14 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden shrink-0 ${
          isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'
        } ${disabled ? 'cursor-default' : ''}`}
      >
        <input 
          ref={inputRef}
          type="file" 
          hidden 
          onChange={async (e) => {
            const file = e.target.files[0];
            if (file) {
              const base64 = await toBase64(file);
              onFileSelect(base64);
            }
          }}
        />
        {item.image ? (
          <img src={item.image} className="w-full h-full object-cover" alt="Item" />
        ) : (
          <Camera size={18} className="text-slate-400" />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                <Package className="text-white" size={28} />
              </div>
              Samples Provided
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Asset Management & Tracking</p>
          </div>
          
          <button 
            onClick={openAddModal}
            className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-[1.5rem] font-bold text-sm shadow-xl shadow-indigo-100 transition-all active:scale-95"
          >
            <Plus size={20} strokeWidth={3} />
            Create Manifest
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
              {['open', 'settled', 'archived'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === tab 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex flex-1 flex-wrap gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="ID or Client Name..."
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-sm outline-none font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select 
                className="px-6 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold text-slate-600 outline-none"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="">All Clients</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {activeTab === 'open' && (
                <select 
                  className="px-6 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold text-slate-600 outline-none"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="all">All Dates</option>
                  <option value="older">Older than 30 Days</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Data List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredChallans.map(challan => {
                        // Logic to calculate totals for the current challan row
            const totals = (challan.samples || []).reduce((acc, s) => ({
              sent: acc.sent + (Number(s.qtySent) || 0),
              received: acc.received + (Number(s.qtyReturned) || 0),
              pending: acc.pending + Math.max(0, (Number(s.qtySent) || 0) - (Number(s.qtyReturned) || 0))
            }), { sent: 0, received: 0, pending: 0 });
            return(
            <div 
              key={challan._id}
              className={`group bg-white p-5 rounded-[2rem] border transition-all hover:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                activeTab === 'open' && isOlderThanMonth(challan.date) 
                ? 'border-red-200 bg-red-50/10' 
                : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-5">
                <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-indigo-50">
                  <Hash className="text-slate-400 group-hover:text-indigo-500" size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-slate-900">{challan.challanNumber}</span>
                    {activeTab === 'open' && isOlderThanMonth(challan.date) && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black uppercase rounded-md flex items-center gap-1">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5"><User size={14}/> {challan.clientName}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(challan.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              

                
              <div className="flex items-center gap-8">
                                              {/* Desktop Grid Columns for Quantities */}
                <div className="flex-1 grid grid-cols-3 gap-4 max-w-md">
                  <div className="text-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Qty Sent</div>
                    <div className="text-sm font-black text-slate-700">{totals.sent}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Received</div>
                    <div className="text-sm font-black text-green-600">{totals.received}</div>
                  </div>
                  <div className="text-center border-l border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending</div>
                    <div className={`text-sm font-black ${totals.pending > 0 ? 'text-red-500' : 'text-slate-400'}`}>{totals.pending}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => openViewModal(challan)} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <Eye size={20} />
                  </button>
                  
                  {activeTab === 'open' && (
                    <>
                      <button onClick={() => openEditModal(challan)} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                        <Edit3 size={20} />
                      </button>
                      <button 
                        onClick={() => initiateSettle(challan)}
                        className="flex items-center gap-2 px-5 py-3 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        <CheckCircle2 size={16} />
                        Settle
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Manifest Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <ClipboardEdit className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Manifest: {currentChallan.challanNumber}</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{activeTab} Record</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-1 space-y-8">
                    <section>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Details</h3>
                      <div className="space-y-4">
                        <input 
                          placeholder="Client Name"
                          disabled={modalMode === 'view'}
                          className="w-full px-4 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                          value={currentChallan.clientName}
                          onChange={(e) => setCurrentChallan(prev => ({ ...prev, clientName: e.target.value }))}
                        />
                        <input 
                          placeholder="Ordered By"
                          disabled={modalMode === 'view'}
                          className="w-full px-4 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                          value={currentChallan.orderedBy || ''}
                          onChange={(e) => setCurrentChallan(prev => ({ ...prev, orderedBy: e.target.value }))}
                        />
                        <input 
                          type="date"
                          disabled={modalMode === 'view'}
                          className="w-full px-4 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                          value={currentChallan.date?.split('T')[0]}
                          onChange={(e) => setCurrentChallan(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">DC Attachments</h3>
                      <div className="space-y-3">
                        {modalMode !== 'view' && (
                          <label className="flex flex-col items-center justify-center w-full h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-slate-100 transition-all">
                            <Upload className="text-slate-400 mb-1" size={20} />
                            <p className="text-[10px] font-black text-slate-500 uppercase">Drop or Click</p>
                            <input type="file" multiple className="hidden" onChange={handleDCUpload} accept="image/*,.pdf" />
                          </label>
                        )}
                        <div className="space-y-2">
                          {currentChallan.dcAttachments?.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              {file.type.includes('pdf') ? <File className="text-red-400" size={16}/> : <ImageIcon className="text-indigo-400" size={16}/>}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-slate-700 truncate">{file.name}</p>
                                <p className="text-[9px] font-bold text-slate-400">{file.size}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => viewFile(file)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="View"><ExternalLink size={14}/></button>
                                <button onClick={() => downloadFile(file)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Download"><Download size={14}/></button>
                                {modalMode !== 'view' && (
                                  <button 
                                    onClick={() => setCurrentChallan(prev => ({ ...prev, dcAttachments: prev.dcAttachments.filter((_, i) => i !== idx) }))}
                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                  ><X size={14} /></button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Table</h3>
                      {modalMode !== 'view' && (
                        <button 
                          onClick={() => setCurrentChallan(prev => ({
                            ...prev,
                            samples: [...prev.samples, { id: Date.now(), name: '', qtySent: 1, qtyReturned: 0, qtyMissing: 0, image: '', writeOffRemarks: '' }]
                          }))}
                          className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                        >Add Item</button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quantity Sent</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quantity Received</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quantity Pending</th>
                            {modalMode !== 'view' && <th className="pb-4 w-10"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {currentChallan.samples.map((item) => (
                            <React.Fragment key={item.id}>
                              <tr className="group">
                                <td className="py-4">
                                  <div className="flex items-center gap-4">
                                    <ItemFileDrop item={item} disabled={modalMode === 'view'} onFileSelect={(data) => updateItem(item.id, 'image', data)} />
                                    <input 
                                      placeholder="Name..."
                                      disabled={modalMode === 'view'}
                                      className="bg-transparent border-none font-bold text-slate-700 text-sm outline-none w-full"
                                      value={item.name}
                                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                    />
                                  </div>
                                </td>
                                <td className="py-4 text-center">
                                  <input 
                                    type="number"
                                    disabled={modalMode === 'view'}
                                    className="w-16 bg-slate-50 border-none rounded-lg p-2 text-center text-sm font-bold text-slate-600"
                                    value={item.qtySent}
                                    onChange={(e) => {
                                      const s = parseInt(e.target.value) || 0;
                                      updateItem(item.id, 'qtySent', s);
                                      updateItem(item.id, 'qtyMissing', Math.max(0, s - item.qtyReturned));
                                    }}
                                  />
                                </td>
                                <td className="py-4 text-center">
                                  <input 
                                    type="number"
                                    disabled={modalMode === 'view'}
                                    className="w-16 bg-green-50 border-none rounded-lg p-2 text-center text-sm font-bold text-green-600"
                                    value={item.qtyReturned}
                                    onChange={(e) => {
                                      const r = parseInt(e.target.value) || 0;
                                      updateItem(item.id, 'qtyReturned', r);
                                      updateItem(item.id, 'qtyMissing', Math.max(0, item.qtySent - r));
                                    }}
                                  />
                                </td>
                                <td className="py-4 text-center">
                                  <span className={`text-sm font-black ${item.qtyMissing > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                    {item.qtyMissing}
                                  </span>
                                </td>
                                {modalMode !== 'view' && (
                                  <td className="py-4 text-right">
                                    <button onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                              {/* Display Write-off Reason in View Mode if exists */}
                              {item.writeOffRemarks && (modalMode === 'view' || activeTab !== 'open') && (
                                <tr>
                                  <td colSpan={5} className="pb-4 pt-0">
                                    <div className="flex items-center gap-2 bg-amber-50 text-amber-700 p-2 rounded-xl text-[10px] font-bold">
                                      <AlertTriangle size={12}/> Write-off Reason: {item.writeOffRemarks}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
                <div className="text-slate-400 text-[10px] font-bold uppercase flex items-center gap-2">
                  <ShieldAlert size={14} className="text-indigo-400" /> Digital audit trail active
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  <button onClick={() => setShowModal(false)} className="flex-1 px-8 py-4 text-slate-400 font-black text-[10px] uppercase">
                    {modalMode === 'view' ? 'Close' : 'Discard'}
                  </button>
                  {modalMode === 'edit' && (
                    <button onClick={handleSave} disabled={loading} className="flex-1 px-14 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase">
                      {loading ? 'Saving...' : 'Confirm Save'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settle Confirmation Popup */}
        {showSettleConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="text-center mb-6">
                <div className="inline-flex p-4 bg-green-50 text-green-600 rounded-full mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900">Settle Manifest</h3>
                <p className="text-sm text-slate-500 mt-2 font-medium">Are you sure you want to finalize this record?</p>
              </div>

              {challans.find(c => c._id === targetSettleId)?.samples.some(s => s.qtyMissing > 0) && (
                <div className="mb-6 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Write-off Reason (Pending Items Exist)</label>
                  <textarea 
                    autoFocus
                    placeholder="Enter reason for missing items..."
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-200 outline-none h-24 resize-none"
                    value={settleReason}
                    onChange={(e) => setSettleReason(e.target.value)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowSettleConfirm(false)}
                  className="py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest"
                >Cancel</button>
                <button 
                  onClick={handleSettleConfirm}
                  className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
                >Yes, Settle</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default SamplesProvided;