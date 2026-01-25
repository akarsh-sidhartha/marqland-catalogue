import React from 'react';
import { Mail, Globe, MapPin, Hash, Download, Instagram } from 'lucide-react';

const App = () => {
  const handlePrint = () => {
    window.print();
  };

  // SVG Logo Component 
  const MarqlandLogo = () => (
    <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#F4DF4E" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>
      </defs>
      <rect x="15" y="15" width="70" height="70" rx="4" stroke="url(#logoGradient)" strokeWidth="4" />
      <path d="M30 70V30L50 50L70 30V70" stroke="url(#logoGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-12 print:p-0 print:bg-white selection:bg-red-50">
      
      {/* UI Controls */}
      <div className="fixed top-8 right-8 z-50 print:hidden flex flex-col gap-4">
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded shadow-xl hover:bg-slate-800 transition-all font-bold tracking-widest text-xs border border-white/10"
        >
          <Download size={16} /> DOWNLOAD / PRINT PDF
        </button>
      </div>

      {/* A4 Document Container */}
      <div 
        id="document-root"
        className="bg-white shadow-2xl print:shadow-none flex flex-col"
        style={{
          width: '210mm',
          height: '297mm',
          minWidth: '210mm',
          minHeight: '297mm',
          position: 'relative',
          padding: '2mm', // Border width
          background: 'linear-gradient(135deg, #e11d48 0%, #fb7185 50%, #f43f5e 100%)' // Red to Pink Gradient
        }}
      >
        <div className="bg-white h-full w-full flex flex-col pt-16 px-16 pb-12 overflow-hidden">
          
          {/* HEADER SECTION */}
          <div className="flex justify-between items-start mb-16">
            <div className="flex items-center gap-5">
              <MarqlandLogo />
              <div className="header">
                <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">MARQLAND</h1>
              </div>
            </div>
          </div>

          {/* DATE & REF */}
          <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-16 border-b border-slate-50 pb-4">
            <span>Ref: ML/CORP/{new Date().getFullYear()}/001</span>
            <span>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>

          {/* MAIN BODY (Pasteable Area) */}
          <div 
            className="flex-1 text-slate-800 leading-[1.8] text-[15px] outline-none focus:ring-0 min-h-[400px]"
            contentEditable
            suppressContentEditableWarning
            spellCheck="false"
            style={{ 
              fontFamily: "'Inter', sans-serif",
              textAlign: 'justify',
              whiteSpace: 'pre-wrap'
            }}
          >
            <p className="font-bold text-black mb-8">Dear Sir / Madam,</p>
            <p>
              This area is fully editable. You can click here to type your letter or paste text directly from another document. The formatting will adapt to the executive style of this letterhead.
            </p>
          </div>

          {/* SIGNATURE AREA */}
          <div className="mt-12 mb-16">
            <div className="w-48 h-[1px] bg-slate-200 mb-3"></div>
            <p className="text-xs font-black text-slate-900 uppercase">Authorized Signatory</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Marqland Operations</p>
          </div>

          {/* FOOTER AREA */}
          <div className="relative pt-10 border-t border-slate-100 flex justify-between items-end">
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-[9px] uppercase tracking-wider font-bold text-slate-400">
              <div className="flex items-center gap-2">
                <Globe size={10} className="text-rose-500" />
                <span className="text-slate-600">www.marqland.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={10} className="text-rose-500" />
                <span className="text-slate-600">info@marqland.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash size={10} className="text-rose-500" />
                <span className="text-slate-600">GST: 29AHTPR534921ZP</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={10} className="text-rose-500" />
                <span className="text-slate-600">Bangalore 560077</span>
              </div>
            </div>

            {/* INSTAGRAM QR CODE SECTION */}
            <div className="flex flex-col items-center gap-2">
              <div className="p-1.5 bg-slate-50 rounded">
                <svg width="50" height="50" viewBox="0 0 29 29" fill="#e11d48">
                  <path d="M0 0h7v7H0zM2 2v3h3V2H2zm10 0h7v7h-7zM14 4v3h3V4h-3zm8-4h7v7h-7zM24 2v3h3V2h-2zm-24 10h7v7H0zm2 2v3h3V2h-3zm10 0h7v7h-7zM14 14v3h3V14h-3zm8-2h7v7h-7zM24 14v3h3V14h-3zm-22 10h7v7H0zm2 2v3h3V24H2zm10 0h7v7h-7zM14 26v3h3V26h-3zm8-2h7v7h-7zM24 26v3h3V26h-3z" />
                  <rect x="9" y="9" width="3" height="3" />
                  <rect x="17" y="17" width="3" height="3" />
                  <rect x="9" y="17" width="3" height="3" />
                </svg>
              </div>
              <div className="flex items-center gap-1 text-[8px] font-black text-rose-400 uppercase tracking-tighter">
                <Instagram size={8} /> @marqland
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body { font-family: 'Inter', sans-serif; }

        @media print {
          body { background: none; padding: 0; }
          .print\\:hidden { display: none !important; }
          #document-root {
            margin: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default App;