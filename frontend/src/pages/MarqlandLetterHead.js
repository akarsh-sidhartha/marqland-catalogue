import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Printer, RefreshCcw } from 'lucide-react';

const App = () => {
  const [pages, setPages] = useState([{ id: 1 }]);
  const [currentDate, setCurrentDate] = useState('');

  // Set initial date on mount
  useEffect(() => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    setCurrentDate(`Date: ${today.toLocaleDateString('en-US', options)}`);
  }, []);

  const addNewPage = () => {
    const nextId = pages.length > 0 ? Math.max(...pages.map(p => p.id)) + 1 : 1;
    setPages([...pages, { id: nextId }]);
  };

  const removePage = (id) => {
    setPages(pages.filter(p => p.id !== id));
  };

  const resetAll = () => {
    if (window.confirm('This will clear all content and reset the pages. Continue?')) {
      window.location.reload();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 font-sans">
      {/* CSS Styles for A4 and Print Isolation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@300;400;600&display=swap');
        
        .a4-page {
          width: 210mm;
          height: 297mm;
          background: white;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          position: relative;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 3px solid;
          border-image-source: linear-gradient(45deg, #d26724 0, #c9003b 100%);
          border-image-slice: 1;
        }

        .company-title {
          font-family: 'Playfair Display', serif;
          font-size: 42pt;
          letter-spacing: 0.1em;
          color: #c9003b;
          text-transform: uppercase;
        }

        .content-body {
          flex-grow: 1;
          padding: 0 60px;
          outline: none;
          font-size: 11pt;
          line-height: 1.6;
          color: #374151;
        }

        @media print {
          /* Hide EVERYTHING by default */
          body * {
            visibility: hidden;
          }

          /* Show only the letterhead container and its children */
          .print-section, .print-section * {
            visibility: visible;
          }

          /* Position the print section at the very top-left of the page */
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Hide common sidebar/nav class names just in case */
          nav, aside, .sidebar, .no-print, header:not(.letterhead-header) {
            display: none !important;
            height: 0 !important;
            width: 0 !important;
          }

          @page {
            size: A4;
            margin: 0;
          }

          .a4-page {
            margin: 0 !important;
            box-shadow: none !important;
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            border-image-slice: 1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            visibility: visible !important;
          }
        }
      `}} />

      {/* Floating Controls */}
      <div className="no-print fixed top-6 z-50 flex gap-4 bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white">
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition-all active:scale-95"
        >
          <Printer size={18} /> Download PDF
        </button>
        <button 
          onClick={addNewPage}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition-all active:scale-95"
        >
          <Plus size={18} /> Add New Page
        </button>
        <button 
          onClick={resetAll}
          className="flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-red-600 transition-all active:scale-95"
        >
          <RefreshCcw size={18} /> Reset
        </button>
      </div>

      {/* Pages Container - Wrapped in print-section for isolation */}
      <div className="print-section flex flex-col gap-8 mt-12 print:mt-0 print:gap-0">
        {pages.map((page, index) => (
          <div key={page.id} className="relative group">
            <div className="a4-page">
              {/* Delete Button (Hover) */}
              {pages.length > 1 && (
                <button 
                  onClick={() => removePage(page.id)}
                  className="no-print absolute top-6 right-6 opacity-0 group-hover:opacity-100 bg-red-100 text-red-600 p-2 rounded-full transition-opacity hover:bg-red-200"
                  title="Delete this page"
                >
                  <Trash2 size={20} />
                </button>
              )}

              {/* Header */}
              <header className="letterhead-header pt-8 pb-2 text-center">
                <h1 className="company-title">MARQLAND</h1>
              </header>

              {/* Sub-Header info (Page 1 Only) */}
              {index === 0 && (
                <div className="flex justify-between px-[60px] py-4 text-[11pt] text-gray-700">
                  <div contentEditable suppressContentEditableWarning className="outline-none">
                    <strong>To,</strong><br />
                    [Recipient Name]<br />
                    [Address Line]
                  </div>
                  <div contentEditable suppressContentEditableWarning className="outline-none text-right">
                    {currentDate}
                  </div>
                </div>
              )}

              {/* Editable Content Area */}
              <div 
                className="content-body py-4 outline-none overflow-y-auto" 
                contentEditable 
                suppressContentEditableWarning
              >
                {index === 0 ? (
                  <>
                    <p><strong>Subject: [Enter Subject Here]</strong></p>
                    <p><br /></p>
                    <p>Start typing your letter content here...</p>
                  </>
                ) : (
                  <p>Continue your content here (Page {index + 1})...</p>
                )}
              </div>

              {/* Signature Section */}
              {index === pages.length - 1 && (
                <div className="px-[60px] pb-6 flex flex-col items-end mt-auto">
                  <div className="w-[180px] border-t border-gray-400 mb-1"></div>
                  <div className="font-bold text-gray-900 uppercase">RADHA KRISHNA TS</div>
                  <div className="text-gray-600 text-sm italic">Proprietor</div>
                </div>
              )}

              {/* Footer */}
              <footer className="footer-bg mx-[60px] border-t border-gray-100 pt-4 pb-8 text-center text-gray-500">
                <div className="flex justify-center items-center gap-4 mb-1 font-semibold text-red-600 text-[9pt]">
                  <a href="https://www.marqland.com" target="_blank" rel="noreferrer" className="hover:underline">www.marqland.com</a>
                  <span className="text-gray-300">|</span>
                  <a href="https://instagram.com/marqland" target="_blank" rel="noreferrer" className="hover:underline">@marqland</a>
                  <span className="text-gray-300">|</span>
                  <a href="mailto:info@marqland.com" className="hover:underline">info@marqland.com</a>
                </div>
                <div className="flex justify-center gap-4 text-[8pt]">
                  <span><strong>GST:</strong> 29AHTPR5349D1ZP</span>
                  <span className="text-gray-300">|</span>
                  <span>219, 3rd cross bds Nagar K.Naryanpura Bangalore 560077</span>
                </div>
                
                <div className="text-[8pt] mt-2 italic text-gray-400">
                  Page {index + 1} of {pages.length}
                </div>
              </footer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;