import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Trash2, 
  Search, 
  Folder, 
  ChevronRight, 
  ChevronDown,
  FileText,
  Calendar,
  FileUp,
  X,
  ArrowLeft,
  Hash,
  RotateCcw,
  Plus,
  Download,
  Link as LinkIcon,
  AlertTriangle,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  FileArchive
} from 'lucide-react';

// External libraries for Zip functionality
const loadScript = (src) => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

const getBaseUrl = () => {
  const { hostname } = window.location;
  const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
    ? 'localhost' 
    : hostname;
  return `http://${host}:5000/api`;
};

const API_BASE_URL = `${getBaseUrl()}`;



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
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [currentExtraction, setCurrentExtraction] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedMimeType, setCapturedMimeType] = useState('image/jpeg');
  const [errorMsg, setErrorMsg] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [docListView, setDocListView] = useState(null);
  const [expandedFY, setExpandedFY] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchInvoices();
    // Pre-load zip libraries
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');
  }, []);

    const handleManualFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCapturedMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        // Just set the preview, don't call the AI processing function
        setCapturedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/invoices`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startCamera = async () => {
    setShowScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMsg("Camera access denied.");
      setShowScanner(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setShowScanner(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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

  const processWithAI = async (base64Data, mimeType) => {
    setProcessingStatus("Gemini AI extracting all Tax Details...");
    setView('processing');
    setErrorMsg(null);
    try {
      const prompt = `Extract details from this Indian Tax Invoice. Return JSON with: vendor_name, vendor_gst, invoice_number, date, total_amount, cgst, sgst, igst.`;
      const response = await fetch(`${API_BASE_URL}/invoices/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, mimeType: mimeType, prompt: prompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI processing failed");
      setCurrentExtraction({
        ...data,
        invoice_number: data.invoice_number || "NOT_FOUND",
        vendor_gst: data.vendor_gst || "",
        cgst: parseFloat(data.cgst) || 0,
        sgst: parseFloat(data.sgst) || 0,
        igst: parseFloat(data.igst) || 0,
        total_amount: parseFloat(data.total_amount) || 0
      });
      setView('details');
    } catch (error) {
      setErrorMsg(error.message);
      setView('dashboard');
    }
  };

  const saveToDatabase = async () => {
    const isDuplicate = invoices.some(inv => 
      inv.invoice_number?.toString().toLowerCase().trim() === currentExtraction.invoice_number?.toString().toLowerCase().trim() &&
      inv.vendor_gst?.toString().toLowerCase().trim() === currentExtraction.vendor_gst?.toString().toLowerCase().trim()
    );
    if (isDuplicate) {
      setShowDuplicatePopup(true);
      return;
    }
    setLoading(true);
    const { month, fy } = getFinancialDetails(currentExtraction.date);
    try {
      const res = await fetch(`${API_BASE_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentExtraction,
          image: capturedImage,
          mimeType: capturedMimeType,
          financialYear: fy,
          month: month
        })
      });
      if (res.ok) {
        await fetchInvoices();
        setView('dashboard');
        setCurrentExtraction(null);
      } else {
        throw new Error("Failed to save to database");
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Delete this invoice?")) return;
    await fetch(`${API_BASE_URL}/invoices/${id}`, { method: 'DELETE' });
    setInvoices(invoices.filter(i => i._id !== id));
  };

  const exportToExcel = (label, items) => {
    const headers = ["Date", "Vendor Name", "GSTIN", "Invoice Number", "CGST", "SGST", "IGST", "Total Amount"];
    const rows = items.map(inv => [
      inv.date,
      `"${inv.vendor_name?.replace(/"/g, '""')}"`,
      inv.vendor_gst,
      inv.invoice_number,
      inv.cgst || 0,
      inv.sgst || 0,
      inv.igst || 0,
      inv.total_amount || 0
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Invoices_${label}.csv`);
    link.click();
  };
  

  const downloadAsZip = async (label, items, isYearly = false) => {
    const JSZipLib = window.JSZip;
    const saveAsLib = window.saveAs;

    if (!JSZipLib || !saveAsLib) {
      alert("Zip libraries are still loading...");
      return;
    }

    setZipLoading(true);
    const zip = new JSZipLib();
    
    // Create the top-level container folder
    const rootFolder = zip.folder(label);

    try {
      for (const inv of items) {
        if (!inv.image) continue;

        // 1. Determine Extension
        const ext = inv.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
        
        // 2. Determine Filename (Sanitized Invoice Number)
        const safeInvoiceNum = (inv.invoice_number || 'UNKNOWN').replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safeInvoiceNum}.${ext}`;

        // 3. Determine Target Folder
        let targetFolder = rootFolder;
        
        if (isYearly) {
          // Structure: root / MonthName / file
          const date = new Date(inv.date);
          const monthName = !isNaN(date.getTime()) 
            ? date.toLocaleString('default', { month: 'long' }) 
            : 'Unknown_Month';
          targetFolder = rootFolder.folder(monthName);
        }

        // 4. Add File to Zip
        if (inv.image.startsWith('data:')) {
          const base64Data = inv.image.split(',')[1];
          targetFolder.file(fileName, base64Data, { base64: true });
        } else {
          try {
            const res = await fetch(inv.image);
            const blob = await res.blob();
            targetFolder.file(fileName, blob);
          } catch (e) {
            console.error(`Failed to fetch ${inv.image}`, e);
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAsLib(content, `${label.replace(/\s/g, '_')}.zip`);
    } catch (err) {
      console.error("Zip generation failed", err);
      alert("Failed to generate zip file.");
    } finally {
      setZipLoading(false);
    }
  };

  const openDocList = (title, items) => {
    const docsWithImages = items.filter(inv => inv.image);
    if (docsWithImages.length === 0) {
      alert("No document files found in this selection.");
      return;
    }
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
    s.cgst += (Number(i.cgst) || 0);
    s.sgst += (Number(i.sgst) || 0);
    s.igst += (Number(i.igst) || 0);
    return s;
  }, { total: 0, cgst: 0, sgst: 0, igst: 0 });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Loader for Zip */}
      {zipLoading && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="font-black text-xs uppercase tracking-widest text-slate-500">Preparing Zip Archive...</p>
          </div>
        </div>
      )}

      {/* Document List Modal */}
      {docListView && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-black text-lg uppercase tracking-tight">{docListView.title}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{docListView.items.length} Documents Available</p>
              </div>
              <button onClick={() => setDocListView(null)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-900 shadow-sm"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {docListView.items.map((inv) => (
                <div key={inv._id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      {inv.mimeType === 'application/pdf' ? <FileText size={20}/> : <ImageIcon size={20}/>}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{inv.vendor_name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase">INV: {inv.invoice_number} • ₹{inv.total_amount?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setSelectedInvoice(inv); setView('viewer'); setDocListView(null); }}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase"
                    >
                      <Eye size={14}/> View
                    </button>
                    <a 
                      href={inv.image} 
                      download={`Invoice_${inv.invoice_number}.jpg`}
                      className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Download size={14}/>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Alert Popup */}
      {showDuplicatePopup && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-center font-black text-xl uppercase tracking-tight mb-2">Duplicate Invoice</h3>
            <p className="text-center text-slate-500 text-sm font-medium leading-relaxed mb-8">
              An invoice with this <span className="text-slate-900 font-bold">Invoice Number</span> and <span className="text-slate-900 font-bold">GST</span> already exists in your vault.
            </p>
            <button onClick={() => setShowDuplicatePopup(false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-colors">I'll Check Again</button>
          </div>
        </div>
      )}

      {/* Camera UI */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="p-4 flex justify-between items-center text-white">
            <span className="font-bold text-sm uppercase">Scanner</span>
            <button onClick={stopCamera} className="p-2"><X size={24}/></button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
          </div>
          <div className="p-8 flex justify-center bg-black">
            <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300"></button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => {setView('dashboard'); setDocListView(null);}}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <FileText size={20} />
          </div>
          <h1 className="font-black text-lg uppercase tracking-tight">Purchase <span className="text-indigo-600">Invoices</span></h1>
        </div>
        <div className="flex-1 max-w-md mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" placeholder="Search vendor or invoice #..." 
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setCurrentExtraction({ vendor_name: "", vendor_gst: "", invoice_number: "", date: new Date().toISOString().split('T')[0], total_amount: 0, cgst: 0, sgst: 0, igst: 0 }); setCapturedImage(null); setView('details'); }} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-200 border border-slate-200 transition-colors">
            <Plus size={18}/> Manual
          </button>
          <button onClick={startCamera} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700">
            <Camera size={18}/> Scan
          </button>
          <button onClick={() => fileInputRef.current.click()} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
            <FileUp size={18}/> Upload
          </button>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-bold text-sm flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}><X size={14}/></button>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-4">
            {Object.entries(hierarchy).sort().reverse().map(([fy, months]) => {
              const allFYItems = Object.values(months).flat();
              const fyStats = getTotals(allFYItems);
              
              return (
                <div key={fy} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between p-4 bg-slate-100/50 border-b border-slate-200 gap-4">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedFY(expandedFY === fy ? null : fy)}>
                      {expandedFY === fy ? <ChevronDown size={20} className="text-indigo-600"/> : <ChevronRight size={20} className="text-indigo-600"/>}
                      <Folder className="text-indigo-600" size={20} />
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-wide">FY {fy}</span>
                        <span className="text-[10px] font-bold text-slate-400">{allFYItems.length} Invoices Found</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1 max-w-3xl text-left lg:px-6">
                      <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">FY CGST</span><span className="text-xs font-bold">₹{fyStats.cgst.toLocaleString()}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">FY SGST</span><span className="text-xs font-bold">₹{fyStats.sgst.toLocaleString()}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">FY IGST</span><span className="text-xs font-bold">₹{fyStats.igst.toLocaleString()}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">FY Total</span><span className="text-xs font-black text-indigo-600">₹{fyStats.total.toLocaleString()}</span></div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => openDocList(`FY ${fy} Vault`, allFYItems)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors flex items-center gap-1 text-[10px] font-black uppercase"><LinkIcon size={14} /> FY Links</button>
                        <button onClick={() => downloadAsZip(`FY_${fy}`, allFYItems,true)} className="p-2 text-slate-500 hover:text-amber-600 hover:bg-white rounded-lg transition-colors flex items-center gap-1 text-[10px] font-black uppercase"><FileArchive size={14} /> Zip</button>
                        <button onClick={() => exportToExcel(`FY_${fy}`, allFYItems)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm"><Download size={14} /> Export FY Excel</button>
                    </div>
                  </div>

                  {expandedFY === fy && (
                    <div className="px-4 pb-4 space-y-2 bg-slate-50/50 pt-4">
                      {Object.entries(months).map(([month, items]) => {
                        const monthStats = getTotals(items);
                        return (
                          <div key={month} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                            <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-slate-50">
                              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedMonth(expandedMonth === month ? null : month)}>
                                 {expandedMonth === month ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                                 <span className="font-black text-sm text-slate-700">{month}</span>
                                 <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">{items.length} Files</span>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1 max-w-3xl text-left px-4">
                                <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">CGST</span><span className="text-xs font-bold">₹{monthStats.cgst.toLocaleString()}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">SGST</span><span className="text-xs font-bold">₹{monthStats.sgst.toLocaleString()}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">IGST</span><span className="text-xs font-bold">₹{monthStats.igst.toLocaleString()}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-slate-400">Total</span><span className="text-xs font-black text-indigo-600">₹{monthStats.total.toLocaleString()}</span></div>
                              </div>

                              <div className="flex items-center gap-2">
                                 <button onClick={() => openDocList(`${month} Vault`, items)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><LinkIcon size={14} /> Links</button>
                                 <button onClick={() => downloadAsZip(`${month}_${fy}`, items,false)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><FileArchive size={14} /> Zip</button>
                                 <button onClick={() => exportToExcel(`${month}_${fy}`, items)} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"><Download size={14} /> Export Excel</button>
                              </div>
                            </div>
                            
                            {expandedMonth === month && (
                              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/30">
                                {items.map(inv => (
                                  <div key={inv._id} onClick={() => { setSelectedInvoice(inv); setView('viewer'); }} className="group bg-white p-4 rounded-xl border border-slate-100 cursor-pointer hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                      {inv.mimeType === 'application/pdf' ? <FileText className="text-indigo-300" size={18}/> : <ImageIcon className="text-slate-300" size={18} />}
                                      <button onClick={(e) => deleteInvoice(inv._id, e)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"><Trash2 size={14}/></button>
                                    </div>
                                    <p className="font-bold text-xs truncate mb-1">{inv.vendor_name}</p>
                                    <div className="flex justify-between items-center mt-2">
                                      <span className="text-indigo-600 font-black text-xs">₹{inv.total_amount?.toLocaleString()}</span>
                                      <span className="text-[9px] text-slate-400 font-bold uppercase">INV: {inv.invoice_number}</span>
                                    </div>
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
            })}
          </div>
        )}

        {view === 'viewer' && selectedInvoice && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors"><ArrowLeft size={14} /> Back</button>
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl">
                <h2 className="text-2xl font-black mb-1">{selectedInvoice.vendor_name}</h2>
                <div className="flex flex-col gap-1 mb-6">
                   <div className="flex items-center gap-2">
                      <Hash size={14} className="text-slate-300" />
                      <span className="text-[11px] font-black text-slate-500 uppercase">GST: {selectedInvoice.vendor_gst || 'Not Available'}</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <FileText size={14} className="text-slate-300" />
                      <span className="text-[11px] font-black text-slate-500 uppercase">Inv: {selectedInvoice.invoice_number || 'N/A'}</span>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                  <div><p className="text-[10px] font-black uppercase text-slate-300 mb-1">Total Paid</p><p className="text-2xl font-black text-indigo-600">₹{selectedInvoice.total_amount?.toLocaleString()}</p></div>
                  <div><p className="text-[10px] font-black uppercase text-slate-300 mb-1">Invoice Date</p><p className="text-sm font-bold">{selectedInvoice.date}</p></div>
                  <div className="col-span-2 grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl">
                    <div><p className="text-[9px] font-black text-slate-400 uppercase">CGST</p><p className="text-sm font-bold text-slate-700">₹{selectedInvoice.cgst || 0}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase">SGST</p><p className="text-sm font-bold text-slate-700">₹{selectedInvoice.sgst || 0}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase">IGST</p><p className="text-sm font-bold text-slate-700">₹{selectedInvoice.igst || 0}</p></div>
                  </div>
                </div>
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
                   <FileText size={48} strokeWidth={1}/>
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
                <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400"><ArrowLeft size={14}/> Dashboard</button>
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">AI Extraction Results</span>
              </div>
              
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vendor Name</label>
                    <input 
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={currentExtraction.vendor_name}
                      onChange={e => setCurrentExtraction({...currentExtraction, vendor_name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vendor GSTIN</label>
                      <input 
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.vendor_gst}
                        onChange={e => setCurrentExtraction({...currentExtraction, vendor_gst: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Invoice Number</label>
                      <input 
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.invoice_number}
                        onChange={e => setCurrentExtraction({...currentExtraction, invoice_number: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Invoice Date</label>
                      <input 
                        type="date"
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.date}
                        onChange={e => setCurrentExtraction({...currentExtraction, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Total Amount (₹)</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.total_amount}
                        onChange={e => setCurrentExtraction({...currentExtraction, total_amount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">CGST</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-100 border-none rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.cgst}
                        onChange={e => setCurrentExtraction({...currentExtraction, cgst: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">SGST</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-100 border-none rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.sgst}
                        onChange={e => setCurrentExtraction({...currentExtraction, sgst: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">IGST</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-100 border-none rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={currentExtraction.igst}
                        onChange={e => setCurrentExtraction({...currentExtraction, igst: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    onClick={saveToDatabase}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                    Save to Invoice Vault
                  </button>
                  <button onClick={() => setView('dashboard')} className="w-full mt-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-red-500 transition-colors">Discard Entry</button>
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
                   <ImageIcon size={48} strokeWidth={1}/>
                   <span className="text-xs font-bold uppercase">No Document Preview Available</span>
                 </div>
               )}
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleManualFileChange}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
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
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @media print {
          header, button, .flex-none, input { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          .shadow-xl, .border { border: none !important; shadow: none !important; }
        }
      `}</style>
    </div>
  );
}