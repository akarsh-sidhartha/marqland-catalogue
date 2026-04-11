import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { getBaseUrl } from '../baseurl';
import { 
  Camera, CheckCircle, XCircle, Loader2, Trash2, Search, Folder,
  ChevronRight, ChevronDown, FileText, Calendar, FileUp, X, ArrowLeft,
  Hash, RotateCcw, Plus, Download, Link as LinkIcon, AlertTriangle,
  ExternalLink, Eye, Image as ImageIcon, FileArchive
} from 'lucide-react';

const loadScript = (src) => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

const compressImage = (base64Str) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_SIDE = 1600;
      if (width > height) {
        if (width > MAX_SIDE) { height *= MAX_SIDE / width; width = MAX_SIDE; }
      } else {
        if (height > MAX_SIDE) { width *= MAX_SIDE / height; height = MAX_SIDE; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const getFinancialDetails = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  if (isNaN(d.getTime())) return { month: 'Unknown', fy: 'Unknown' };
  const month = d.toLocaleString('default', { month: 'long' });
  const year = d.getFullYear();
  const fy = d.getMonth() < 3 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  return { month, fy };
};

export default function App() {
  const [invoices, setInvoices]               = useState([]);
  const [searchQuery, setSearchQuery]         = useState("");
  const [view, setView]                       = useState('dashboard');
  const [loading, setLoading]                 = useState(false);
  const [zipLoading, setZipLoading]           = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [currentExtraction, setCurrentExtraction] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [capturedImage, setCapturedImage]     = useState(null);
  const [capturedMimeType, setCapturedMimeType] = useState('image/jpeg');
  const [errorMsg, setErrorMsg]               = useState(null);
  const [showScanner, setShowScanner]         = useState(false);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [docListView, setDocListView]         = useState(null);
  const [expandedFY, setExpandedFY]           = useState(null);
  const [expandedMonth, setExpandedMonth]     = useState(null);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchInvoices();
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
  }, []);

  const handleManualFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCapturedMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => { setCapturedImage(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  // ── All API calls use `api` instance (auto-attaches JWT) ─────────────────

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/invoices');
      setInvoices(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const processWithAI = async (base64Data, mimeType) => {
    setProcessingStatus("Gemini AI extracting all Tax Details...");
    setView('processing');
    setErrorMsg(null);
    try {
      const prompt = `Extract details from this Indian Tax Invoice. Return JSON with: vendor_name, vendor_gst, invoice_number, date, total_amount, cgst, sgst, igst.`;
      const res = await api.post('/invoices/process', {
        image: base64Data, mimeType, prompt
      });
      const data = res.data;
      setCurrentExtraction({
        ...data,
        invoice_number: data.invoice_number || "NOT_FOUND",
        vendor_gst:     data.vendor_gst || "",
        cgst:           parseFloat(data.cgst)         || 0,
        sgst:           parseFloat(data.sgst)         || 0,
        igst:           parseFloat(data.igst)         || 0,
        total_amount:   parseFloat(data.total_amount) || 0
      });
      setView('details');
    } catch (error) {
      setErrorMsg(error.response?.data?.error || error.message);
      setView('dashboard');
    }
  };

  const saveToDatabase = async () => {
    const isDuplicate = invoices.some(inv =>
      inv.invoice_number?.toString().toLowerCase().trim() === currentExtraction.invoice_number?.toString().toLowerCase().trim() &&
      inv.vendor_gst?.toString().toLowerCase().trim() === currentExtraction.vendor_gst?.toString().toLowerCase().trim()
    );
    if (isDuplicate) { setShowDuplicatePopup(true); return; }

    setLoading(true);
    const { month, fy } = getFinancialDetails(currentExtraction.date);
    try {
      await api.post('/invoices', {
        ...currentExtraction,
        image: capturedImage,
        mimeType: capturedMimeType,
        financialYear: fy,
        month
      });
      await fetchInvoices();
      setView('dashboard');
      setCurrentExtraction(null);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Delete this invoice?")) return;
    await api.delete(`/invoices/${id}`);
    setInvoices(invoices.filter(i => i._id !== id));
  };

  // ── Non-API functions (unchanged) ─────────────────────────────────────────

  const startCamera = async () => {
    setShowScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setErrorMsg("Camera access denied.");
      setShowScanner(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    setShowScanner(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    setView('processing');
    const optimized = await compressImage(base64);
    setCapturedImage(optimized);
    setCapturedMimeType('image/jpeg');
    processWithAI(optimized, 'image/jpeg');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let dataToProcess = reader.result;
      let actualMimeType = file.type;
      if (file.type.startsWith('image/')) {
        setView('processing');
        dataToProcess = await compressImage(reader.result);
        actualMimeType = 'image/jpeg';
      }
      setCapturedImage(dataToProcess);
      setCapturedMimeType(actualMimeType);
      processWithAI(dataToProcess, actualMimeType);
    };
    reader.readAsDataURL(file);
  };

  const exportToExcel = (label, items) => {
    const headers = ["Date", "Vendor Name", "GSTIN", "Invoice Number", "CGST", "SGST", "IGST", "Total Amount"];
    const rows = items.map(inv => [
      inv.date,
      `"${inv.vendor_name?.replace(/"/g, '""')}"`,
      inv.vendor_gst, inv.invoice_number,
      inv.cgst || 0, inv.sgst || 0, inv.igst || 0, inv.total_amount || 0
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Invoices_${label}.csv`);
    link.click();
  };

  const downloadAsZip = async (label, items, isYearly = false) => {
    const JSZipLib = window.JSZip;
    const saveAsLib = window.saveAs;
    if (!JSZipLib || !saveAsLib) { alert("Zip libraries are still loading..."); return; }
    setZipLoading(true);
    const zip = new JSZipLib();
    const rootFolder = zip.folder(label);
    try {
      for (const inv of items) {
        if (!inv.image) continue;
        const ext = inv.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
        const safeInvoiceNum = (inv.invoice_number || 'UNKNOWN').replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safeInvoiceNum}.${ext}`;
        let targetFolder = rootFolder;
        if (isYearly) {
          const date = new Date(inv.date);
          const monthName = !isNaN(date.getTime()) ? date.toLocaleString('default', { month: 'long' }) : 'Unknown_Month';
          targetFolder = rootFolder.folder(monthName);
        }
        if (inv.image.startsWith('data:')) {
          targetFolder.file(fileName, inv.image.split(',')[1], { base64: true });
        } else {
          try {
            const res = await fetch(inv.image);
            targetFolder.file(fileName, await res.blob());
          } catch (e) { console.error(`Failed to fetch ${inv.image}`, e); }
        }
      }
      saveAsLib(await zip.generateAsync({ type: "blob" }), `${label.replace(/\s/g, '_')}.zip`);
    } catch (err) {
      console.error("Zip generation failed", err);
      alert("Failed to generate zip file.");
    } finally {
      setZipLoading(false);
    }
  };

  const openDocList = (title, items) => {
    const docsWithImages = items.filter(inv => inv.image);
    if (docsWithImages.length === 0) { alert("No document files found in this selection."); return; }
    setDocListView({ title, items: docsWithImages });
  };

  const hierarchy = invoices.filter(inv => {
    const s = searchQuery.toLowerCase();
    return inv.vendor_name?.toLowerCase().includes(s) || inv.invoice_number?.toLowerCase().includes(s);
  }).reduce((acc, inv) => {
    const fy = inv.financialYear || 'Other';
    const mo = inv.month || 'Other';
    if (!acc[fy]) acc[fy] = {};
    if (!acc[fy][mo]) acc[fy][mo] = [];
    acc[fy][mo].push(inv);
    return acc;
  }, {});

  const getTotals = (items) => items.reduce((s, i) => {
    s.total += (Number(i.total_amount) || 0);
    s.cgst  += (Number(i.cgst)         || 0);
    s.sgst  += (Number(i.sgst)         || 0);
    s.igst  += (Number(i.igst)         || 0);
    return s;
  }, { total: 0, cgst: 0, sgst: 0, igst: 0 });

  // ── JSX (identical to original — no UI changes) ───────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {zipLoading && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="font-black text-xs uppercase tracking-widest text-slate-500">Preparing Zip Archive...</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl"><FileText className="text-white" size={20} /></div>
            <div>
              <h1 className="font-black text-lg uppercase tracking-tight leading-none">Invoice Vault</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{invoices.length} Documents</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Search vendor or invoice..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition">
              <FileUp size={14} /> Upload
            </button>
            <button onClick={startCamera}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
              <Camera size={14} /> Scan
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <p className="text-sm font-bold text-red-700">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
          </div>
        )}

        {showDuplicatePopup && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
              <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-amber-600" size={32} />
              </div>
              <h3 className="font-black text-xl mb-2">Duplicate Found</h3>
              <p className="text-slate-500 text-sm mb-6">An invoice with this number from this vendor already exists.</p>
              <button onClick={() => setShowDuplicatePopup(false)}
                className="w-full bg-slate-900 text-white py-3 rounded-2xl font-black uppercase text-xs">
                Understood
              </button>
            </div>
          </div>
        )}

        {docListView && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="font-black text-lg uppercase">{docListView.title}</h3>
                <button onClick={() => setDocListView(null)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
              </div>
              <div className="p-4 overflow-y-auto custom-scrollbar space-y-2">
                {docListView.items.map(inv => (
                  <div key={inv._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="bg-slate-200 p-2 rounded-lg"><FileText size={16} className="text-slate-500" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{inv.vendor_name}</p>
                      <p className="text-xs text-slate-400">{inv.invoice_number} · ₹{inv.total_amount?.toLocaleString()}</p>
                    </div>
                    <a href={inv.image} download={`${inv.invoice_number}.${inv.mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`}
                      className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition">
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-4">
            {Object.keys(hierarchy).length === 0 ? (
              <div className="text-center py-24 text-slate-400">
                <FileText size={48} strokeWidth={1} className="mx-auto mb-4" />
                <p className="font-bold uppercase tracking-widest text-sm">No invoices yet</p>
                <p className="text-xs mt-1">Upload or scan a document to begin</p>
              </div>
            ) : (
              Object.entries(hierarchy).sort((a, b) => b[0].localeCompare(a[0])).map(([fy, months]) => {
                const fyItems = Object.values(months).flat();
                const fyTotals = getTotals(fyItems);
                const isFYOpen = expandedFY === fy;
                return (
                  <div key={fy} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div
                      className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition"
                      onClick={() => setExpandedFY(isFYOpen ? null : fy)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2 rounded-xl"><Folder className="text-indigo-600" size={20} /></div>
                        <div>
                          <h3 className="font-black text-base">FY {fy}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{fyItems.length} invoices · ₹{fyTotals.total.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); exportToExcel(`FY_${fy}`, fyItems); }}
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition" title="Export FY to CSV">
                          <Download size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); downloadAsZip(`FY ${fy}`, fyItems, true); }}
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition" title="Download FY as ZIP">
                          <FileArchive size={16} />
                        </button>
                        {isFYOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                      </div>
                    </div>

                    {isFYOpen && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {Object.entries(months).map(([month, items]) => {
                          const monthTotals = getTotals(items);
                          const isMonthOpen = expandedMonth === `${fy}-${month}`;
                          return (
                            <div key={month}>
                              <div
                                className="flex items-center justify-between px-6 py-4 bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition"
                                onClick={() => setExpandedMonth(isMonthOpen ? null : `${fy}-${month}`)}
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar size={14} className="text-slate-400" />
                                  <span className="font-bold text-sm">{month}</span>
                                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{items.length}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                  <span>₹{monthTotals.total.toLocaleString()}</span>
                                  <button onClick={(e) => { e.stopPropagation(); exportToExcel(`${month}_${fy}`, items); }}
                                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition">
                                    <Download size={14} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); downloadAsZip(`${month} ${fy}`, items); }}
                                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition">
                                    <FileArchive size={14} />
                                  </button>
                                  {isMonthOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                </div>
                              </div>

                              {isMonthOpen && (
                                <div className="divide-y divide-slate-50">
                                  {items.map(inv => (
                                    <div key={inv._id}
                                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 cursor-pointer group transition"
                                      onClick={() => { setSelectedInvoice(inv); setView('invoice-detail'); }}
                                    >
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${inv.image ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {inv.mimeType === 'application/pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm truncate">{inv.vendor_name}</p>
                                        <p className="text-xs text-slate-400 font-medium">{inv.invoice_number} · {inv.vendor_gst}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="font-black text-sm text-indigo-600">₹{(inv.total_amount || 0).toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-400">{inv.date}</p>
                                      </div>
                                      <button onClick={(e) => deleteInvoice(inv._id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition">
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === 'invoice-detail' && selectedInvoice && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                <ArrowLeft size={14} /> Dashboard
              </button>
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl space-y-4">
                <h2 className="font-black text-xl uppercase">{selectedInvoice.vendor_name}</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-[10px] font-black text-slate-400 uppercase block">GSTIN</span><span className="font-bold">{selectedInvoice.vendor_gst}</span></div>
                  <div><span className="text-[10px] font-black text-slate-400 uppercase block">Invoice #</span><span className="font-bold">{selectedInvoice.invoice_number}</span></div>
                  <div><span className="text-[10px] font-black text-slate-400 uppercase block">Date</span><span className="font-bold">{selectedInvoice.date}</span></div>
                  <div><span className="text-[10px] font-black text-slate-400 uppercase block">Total</span><span className="font-black text-indigo-600 text-lg">₹{selectedInvoice.total_amount?.toLocaleString()}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-4 border-t">
                  <div className="bg-slate-50 p-3 rounded-xl text-center"><span className="text-[9px] font-black text-slate-400 uppercase block">CGST</span><span className="font-black">₹{selectedInvoice.cgst || 0}</span></div>
                  <div className="bg-slate-50 p-3 rounded-xl text-center"><span className="text-[9px] font-black text-slate-400 uppercase block">SGST</span><span className="font-black">₹{selectedInvoice.sgst || 0}</span></div>
                  <div className="bg-slate-50 p-3 rounded-xl text-center"><span className="text-[9px] font-black text-slate-400 uppercase block">IGST</span><span className="font-black">₹{selectedInvoice.igst || 0}</span></div>
                </div>
                <button onClick={(e) => { deleteInvoice(selectedInvoice._id, e); setView('dashboard'); }}
                  className="w-full mt-4 py-3 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-100 transition flex items-center justify-center gap-2">
                  <Trash2 size={14} /> Delete Invoice
                </button>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden border bg-slate-200 h-[700px] shadow-inner relative group">
              {selectedInvoice.image ? (
                selectedInvoice.mimeType === 'application/pdf' ? (
                  <iframe src={selectedInvoice.image} className="w-full h-full" title="PDF Preview" />
                ) : (
                  <div className="overflow-auto h-full"><img src={selectedInvoice.image} className="w-full" alt="Invoice" /></div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <FileText size={48} strokeWidth={1} />
                  <span className="text-xs font-bold uppercase">Manual Entry - No Document Image</span>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'details' && currentExtraction && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400"><ArrowLeft size={14} /> Dashboard</button>
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">AI Extraction Results</span>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vendor Name</label>
                    <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={currentExtraction.vendor_name}
                      onChange={e => setCurrentExtraction({...currentExtraction, vendor_name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vendor GSTIN</label>
                      <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.vendor_gst}
                        onChange={e => setCurrentExtraction({...currentExtraction, vendor_gst: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Invoice Number</label>
                      <input className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.invoice_number}
                        onChange={e => setCurrentExtraction({...currentExtraction, invoice_number: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Invoice Date</label>
                      <input type="date" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.date}
                        onChange={e => setCurrentExtraction({...currentExtraction, date: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Total Amount (₹)</label>
                      <input type="number" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.total_amount}
                        onChange={e => setCurrentExtraction({...currentExtraction, total_amount: parseFloat(e.target.value) || 0})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {['cgst','sgst','igst'].map(tax => (
                      <div key={tax}>
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">{tax.toUpperCase()}</label>
                        <input type="number" className="w-full bg-slate-100 border-none rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={currentExtraction[tax]}
                          onChange={e => setCurrentExtraction({...currentExtraction, [tax]: parseFloat(e.target.value) || 0})} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-6">
                  <button onClick={saveToDatabase} disabled={loading}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                    Save to Invoice Vault
                  </button>
                  <button onClick={() => setView('dashboard')} className="w-full mt-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-red-500 transition-colors">
                    Discard Entry
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden border bg-slate-200 h-[700px] shadow-inner relative">
              {capturedImage ? (
                capturedMimeType === 'application/pdf' ? (
                  <iframe src={capturedImage} className="w-full h-full" title="Upload Preview" />
                ) : (
                  <div className="overflow-auto h-full"><img src={capturedImage} className="w-full" alt="Extracted" /></div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={48} strokeWidth={1} />
                  <span className="text-xs font-bold uppercase">No Document Preview Available</span>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleManualFileChange} accept="image/*,application/pdf" className="hidden" />
            </div>
          </div>
        )}

        {view === 'processing' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 animate-pulse">
                  <FileText size={24} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-xl uppercase tracking-tight">AI is Reading Document</h3>
              <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">{processingStatus}</p>
            </div>
          </div>
        )}

        {showScanner && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="flex items-center justify-between p-4">
              <span className="text-white font-black uppercase text-sm">Scanner</span>
              <button onClick={stopCamera} className="text-white"><X size={24} /></button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
            <div className="p-6 flex justify-center">
              <button onClick={capturePhoto}
                className="w-16 h-16 bg-white rounded-full border-4 border-indigo-600 shadow-lg active:scale-95 transition" />
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}