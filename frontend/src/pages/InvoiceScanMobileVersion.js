import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  X,
  Share2,
  AlertTriangle,
  Plus,
  ArrowLeft,
  Image as ImageIcon
} from 'lucide-react';

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
      const MAX_SIDE = 1200; 
      if (width > height) {
        if (width > MAX_SIDE) { height *= MAX_SIDE / width; width = MAX_SIDE; }
      } else {
        if (height > MAX_SIDE) { width *= MAX_SIDE / height; height = MAX_SIDE; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); 
    };
  });
};

export default function App() {
  const [status, setStatus] = useState('idle'); // idle, processing, reviewing, manual, success, error
  const [errorMessage, setErrorMessage] = useState("");
  const [capturedFile, setCapturedFile] = useState({ data: null, type: null });
  const [extractedData, setExtractedData] = useState({
    vendor_name: '',
    vendor_gst: '',
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    total_amount: '',
    cgst: '',
    sgst: '',
    igst: ''
  });
  const [isDuplicate, setShowDuplicatePopup] = useState(false);
  const fileInputRef = useRef(null);
  const manualFileRef = useRef(null);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/invoices`);
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  };
  
  const checkForDuplicate = async (gstNum, invoiceNum) => {
    if (!gstNum || !invoiceNum) return false;
    try {
      const latestInvoices = await fetchInvoices();
      const duplicate = latestInvoices.some(inv => 
        inv.invoice_number?.toString().toLowerCase().trim() === invoiceNum?.toString().toLowerCase().trim() &&
        inv.vendor_gst?.toString().toLowerCase().trim() === gstNum?.toString().toLowerCase().trim()
      );
      setShowDuplicatePopup(duplicate);
      return duplicate;
    } catch (err) {
      console.error("Duplicate verification failed", err);
      return false;
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setStatus('processing');
    setShowDuplicatePopup(false);

    const reader = new FileReader();
    reader.onload = async () => {
      let data = reader.result;
      if (file.type.startsWith('image/')) {
        data = await compressImage(reader.result);
      }
      setCapturedFile({ data, type: file.type });
      processInvoice(data, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleManualImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let data = reader.result;
      if (file.type.startsWith('image/')) {
        data = await compressImage(reader.result);
      }
      setCapturedFile({ data, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const processInvoice = async (base64, mimeType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64, 
          mimeType: mimeType,
          prompt: "Extract exactly: vendor_name, vendor_gst, invoice_number, date, total_amount, cgst, sgst, igst. Return JSON."
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to process document");

      setExtractedData(data);
      await checkForDuplicate(data.vendor_gst, data.invoice_number);
      setStatus('reviewing');
    } catch (err) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  };

  const submitToVault = async () => {
    if (!capturedFile.data && status === 'manual') {
      setErrorMessage("Please upload an invoice image or PDF.");
      setStatus('error');
      return;
    }

    setStatus('processing');
    try {
      const exists = await checkForDuplicate(extractedData.vendor_gst, extractedData.invoice_number);
      if (exists) {
        setErrorMessage("Duplicate Entry: This Invoice # for the given GSTIN already exists.");
        setStatus('error');
        return;
      }

      const d = new Date(extractedData.date || new Date());
      const month = d.toLocaleString('default', { month: 'long' });
      const year = d.getFullYear();
      const fy = d.getMonth() < 3 ? `${year - 1}-${year}` : `${year}-${year + 1}`;

      const res = await fetch(`${API_BASE_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...extractedData,
          image: capturedFile.data,
          mimeType: capturedFile.type,
          financialYear: fy,
          month: month
        })
      });

      if (!res.ok) throw new Error("Could not save to database");
      setStatus('success');
    } catch (err) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setExtractedData({
      vendor_name: '', vendor_gst: '', invoice_number: '',
      date: new Date().toISOString().split('T')[0],
      total_amount: '', cgst: '', sgst: '', igst: ''
    });
    setCapturedFile({ data: null, type: null });
    setShowDuplicatePopup(false);
  };

  // --- Views ---

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={56} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Vaulted!</h1>
        <button onClick={resetForm} className="mt-10 w-full max-w-xs bg-indigo-600 text-white py-5 rounded-[24px] font-black shadow-xl">
          DONE
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={40} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 uppercase">Error</h1>
        <p className="text-rose-700 text-sm mt-4 font-bold">{errorMessage}</p>
        <button onClick={() => setStatus(capturedFile.data ? 'reviewing' : 'idle')} className="mt-10 w-full max-w-xs bg-slate-900 text-white py-5 rounded-[24px] font-black">
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {status !== 'idle' && (
            <button onClick={resetForm} className="p-2 -ml-2 text-slate-400">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <span className="font-black text-xs uppercase tracking-tight block">Marqland Studios</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {status === 'manual' ? 'Manual Entry' : 'Invoice Scanner'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 overflow-y-auto">
        {status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Choose Entry Method</h2>
              <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-widest">Digital Archive System</p>
            </div>
            
            <button 
              onClick={() => fileInputRef.current.click()}
              className="w-full max-w-[320px] bg-white border-2 border-dashed border-indigo-200 rounded-[32px] p-8 flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all"
            >
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <Camera size={32} />
              </div>
              <div className="text-center">
                <span className="font-black text-sm text-indigo-600 uppercase block">Launch Camera</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">AI Auto-Extraction</span>
              </div>
            </button>

            <button 
              onClick={() => setStatus('manual')}
              className="w-full max-w-[320px] bg-white border-2 border-indigo-50 rounded-[32px] p-8 flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all"
            >
              <div className="w-16 h-16 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center">
                <Plus size={32} />
              </div>
              <div className="text-center">
                <span className="font-black text-sm text-slate-700 uppercase block">Manual Upload</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">Form Fill Entry</span>
              </div>
            </button>
            
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" capture="environment" className="hidden" />
          </div>
        )}

        {status === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest mt-6">Reading Document...</p>
          </div>
        )}

        {(status === 'reviewing' || status === 'manual') && (
          <div className="flex-1 max-w-md mx-auto w-full space-y-6 pb-12">
            {isDuplicate && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                <p className="text-amber-900 font-bold text-[11px] leading-tight uppercase">Duplicate: This Invoice already exists in the vault.</p>
              </div>
            )}

            <div className="bg-white rounded-[32px] p-6 shadow-xl border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Company Name</label>
                  <input className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm" value={extractedData.vendor_name} onChange={e => setExtractedData({...extractedData, vendor_name: e.target.value})} placeholder="Vendor Name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">GSTIN</label>
                    <input className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm uppercase" value={extractedData.vendor_gst} onChange={e => setExtractedData({...extractedData, vendor_gst: e.target.value.toUpperCase()})} placeholder="GSTIN" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Invoice #</label>
                    <input className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm" value={extractedData.invoice_number} onChange={e => setExtractedData({...extractedData, invoice_number: e.target.value})} placeholder="INV-001" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Date</label>
                    <input type="date" className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm" value={extractedData.date} onChange={e => setExtractedData({...extractedData, date: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Amount</label>
                    <input type="number" className="w-full bg-slate-50 p-3 rounded-xl font-black text-indigo-600 text-sm" value={extractedData.total_amount} onChange={e => setExtractedData({...extractedData, total_amount: e.target.value})} placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">CGST</label>
                    <input type="number" className="w-full bg-slate-50 p-3 rounded-xl font-bold text-xs" value={extractedData.cgst} onChange={e => setExtractedData({...extractedData, cgst: e.target.value})} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">SGST</label>
                    <input type="number" className="w-full bg-slate-50 p-3 rounded-xl font-bold text-xs" value={extractedData.sgst} onChange={e => setExtractedData({...extractedData, sgst: e.target.value})} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">IGST</label>
                    <input type="number" className="w-full bg-slate-50 p-3 rounded-xl font-bold text-xs" value={extractedData.igst} onChange={e => setExtractedData({...extractedData, igst: e.target.value})} placeholder="0" />
                  </div>
                </div>
              </div>

              {/* Image Upload for Manual mode or Preview for Reviewing mode */}
              <div className="pt-4 border-t border-dashed">
                {capturedFile.data ? (
                  <div className="relative group">
                    <div className="w-full h-32 rounded-2xl overflow-hidden border">
                      {capturedFile.type?.includes('pdf') ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><FileText size={32} /></div>
                      ) : (
                        <img src={capturedFile.data} className="w-full h-full object-cover grayscale opacity-50" />
                      )}
                    </div>
                    <button onClick={() => setCapturedFile({data:null, type:null})} className="absolute -top-2 -right-2 bg-white shadow-md rounded-full p-1 text-red-500 border"><X size={16} /></button>
                  </div>
                ) : (
                  <button 
                    onClick={() => manualFileRef.current.click()}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-colors"
                  >
                    <ImageIcon size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Attach Invoice Image</span>
                  </button>
                )}
                <input type="file" ref={manualFileRef} onChange={handleManualImageUpload} className="hidden" accept="image/*,application/pdf" />
              </div>

              <button 
                disabled={isDuplicate}
                onClick={submitToVault}
                className={`w-full py-5 rounded-[20px] font-black text-sm shadow-lg transition-all ${
                  isDuplicate ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white active:scale-95'
                }`}
              >
                {isDuplicate ? 'DUPLICATE' : 'SAVE TO VAULT'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}