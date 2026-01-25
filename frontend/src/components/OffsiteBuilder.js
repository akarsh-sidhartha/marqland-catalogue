import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Printer, ChevronLeft, Save, Globe, MapPin, Sun, Loader2, FileText, XCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';

const OffsiteBuilder = () => {
  const [clientName, setClientName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [items, setItems] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTC, setShowTC] = useState(true);
  const [tcContent, setTcContent] = useState('1. Prices are valid for 7 days.\n2. Standard check-in/check-out times apply.\n3. Taxes as applicable by government norms.');
  const [saveLoading, setSaveLoading] = useState(false);
  const [currentCatalogueId, setCurrentCatalogueId] = useState(null);
  const printRef = useRef(null);

  // Load PDF libraries via CDN
  useEffect(() => {
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    ];
    scripts.forEach(src => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
      }
    });
  }, []);

  useEffect(() => {
    const savedSelection = localStorage.getItem('offsite_selection');
    const editCatalogueData = localStorage.getItem('edit_offsite_catalogue');
    
    if (savedSelection) {
      setClientName('');
      setSubtitle('');
      setCurrentCatalogueId(null);
      
      const rawData = JSON.parse(savedSelection);
      const formattedItems = rawData.map(p => ({
        id: Math.random().toString(36).substr(2, 9),
        type: p.type || 'Night Stay',
        name: p.propertyName || 'Untitled Property',
        location: p.place ? `${p.place}, ${p.state}` : 'Location Not Specified',
        desc: p.details || p.Details || '', 
        website: p.website || '',
        image: p.image || null,
        doubleOccupancy: String(p.doublePrice || '0'),
        tripleOccupancy: String(p.triplePrice || '0'),
        djCost: String(p.djCost || '0'),
        licenseFeeDJ: String(p.licenseFeeDJ || '0'),
        cocktailSnacks: String(p.cocktailSnacks || '0'),
        banquetHall: String(p.banquetHall || '0'),
        packagePrice: String(p.packagePrice || '0')
      }));

      setItems(formattedItems);
      localStorage.removeItem('offsite_selection');
    } else if (editCatalogueData) {
      const data = JSON.parse(editCatalogueData);
      setClientName(data.title || ''); 
      setSubtitle(data.description || ''); 
      
      if (data.items) {
        setItems(data.items.map(item => ({
            ...item,
            id: item._id || Math.random().toString(36).substr(2, 9),
            // Map saved DB fields back to the specific UI keys used in state
            name: item.name,
            location: item.sku || 'Location Not Specified',
            type: item.type || 'Night Stay',
            desc: item.desc || '',
            image: item.image || null,
            website: item.website || '',
            doubleOccupancy: String(item.doubleOccupancy || '0'),
            tripleOccupancy: String(item.tripleOccupancy || '0'),
            djCost: String(item.djCost || '0'),
            licenseFeeDJ: String(item.licenseFeeDJ || '0'),
            cocktailSnacks: String(item.cocktailSnacks || '0'),
            banquetHall: String(item.banquetHall || '0'),
            packagePrice: String(item.packagePrice || '0')
        })));
      }
      
      setCurrentCatalogueId(data._id || data.id);
      localStorage.removeItem('edit_offsite_catalogue');
    }
  }, []);

  const updateItemField = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handlePrint = async () => {
    if (!window.html2canvas || !window.jspdf) {
      return alert("PDF libraries are loading. Please try again in a moment.");
    }
    
    setIsGenerating(true);
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = printRef.current.querySelectorAll('.a4-page');
      
      for (let i = 0; i < pages.length; i++) {
        const canvas = await window.html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      pdf.save(`${clientName || 'Offsite'}_Proposal.pdf`);
    } catch (error) {
      console.error("PDF Gen Error:", error);
      alert("Error generating PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToDb = async () => {
    console.log("Saving Offsite Catalogue with full details");
    if (items.length === 0) return alert("Add properties before saving.");
    
    let nameToSave = clientName;
    if (!currentCatalogueId && !clientName) {
      nameToSave = prompt("Enter Offsite Catalogue Name:", "New Offsite Proposal");
      if (!nameToSave) return;
      setClientName(nameToSave);
    }

    setSaveLoading(true);
    try {
      // Map ALL details from the state into the items array to ensure no data is lost
      const schemaItems = items.map(item => ({
        name: item.name,
        price: parseFloat(item.type === 'Night Stay' ? item.doubleOccupancy : item.packagePrice) || 0,
        sku: item.location,
        // Custom fields stored in the DB to preserve state
        type: item.type,
        desc: item.desc,
        image: item.image,
        website: item.website,
        doubleOccupancy: item.doubleOccupancy,
        tripleOccupancy: item.tripleOccupancy,
        djCost: item.djCost,
        licenseFeeDJ: item.licenseFeeDJ,
        cocktailSnacks: item.cocktailSnacks,
        banquetHall: item.banquetHall,
        packagePrice: item.packagePrice
      }));

      const payload = {
        title: nameToSave || clientName,
        description: subtitle || 'Curated Offsite Proposal',
        items: schemaItems,
        status: 'draft',
        progress: 100
      };
      
      const hostname = window.location.hostname || 'localhost';
      const baseUrl = `http://${hostname}:5000/api/offsitecatalogues`;
      
      let response;

      if (currentCatalogueId) {
        response = await axios.put(`${baseUrl}/${currentCatalogueId}`, payload);
      } else {
        response = await axios.post(baseUrl, payload);
        const newId = response.data?.data?._id || response.data?._id;
        if (newId) setCurrentCatalogueId(newId);
      }
      
      alert("Offsite Catalogue Saved Successfully!");
    } catch (err) {
      console.error("Save error details:", err.response?.data);
      alert("Error saving: " + (err.response?.data?.error || err.response?.data?.message || err.message));
    } finally {
      setSaveLoading(false);
    }
  };

  const renderPages = () => {
    const pages = [];

    // COVER PAGE
    pages.push(
      <div key="cover" className="a4-page shadow-2xl">
        <div className="border-wrapper cover-border">
          <div className="content-inner flex flex-col items-center justify-center h-full text-center relative">
            <div className="text-[#C5A059] tracking-[0.4em] uppercase text-[10px] font-bold mb-12">By Marqland</div>
            <h1 className="font-serif text-6xl mb-8 leading-tight text-gray-900 break-words w-full px-4">
              {clientName || "Client Name"}
            </h1>
            <div className="w-16 h-[2px] bg-[#C5A059] mb-8"></div>
            <h2 className="font-serif text-3xl text-gray-400 italic font-light">
              {subtitle || "Project Catalogue"}
            </h2>
            <div className="absolute bottom-10 left-0 right-0 text-center text-[10px] text-gray-400 font-bold tracking-[0.4em] uppercase">
              Celebrate Teams. Delight Clients.
            </div>
          </div>
        </div>
      </div>
    );

    // PROPERTY PAGES
    items.forEach((item, idx) => {
      const isNightStay = item.type === 'Night Stay';
      const websiteUrl = item.website?.startsWith('http') ? item.website : `https://${item.website}`;

      pages.push(
        <div key={item.id || idx} className="a4-page shadow-2xl flex flex-col bg-white">
          <div className="w-full h-[100mm] overflow-hidden bg-gray-100 relative">
            {item.image ? (
                <img 
                  src={item.image} 
                  className="w-full h-full object-cover" 
                  alt={item.name} 
                  crossOrigin="anonymous"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50 uppercase text-[10px] tracking-widest font-bold">No Image Provided</div>
            )}
          </div>

          <div className="flex-1 p-12 flex flex-col relative z-10">
            <div className="mb-6">
              <h2 className="font-serif text-4xl text-gray-900 mb-2 uppercase tracking-tight">{item.name}</h2>
              <div className="flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-widest">
                <MapPin size={14} /> {item.location}
              </div>
            </div>

            <div className="mb-8">
              {isNightStay ? (
                <div className="grid grid-cols-4 gap-4 border-y border-gray-100 py-6">
                  <div className="border-l-2 border-[#C5A059] pl-4">
                    <div className="text-[9px] uppercase font-black text-gray-400 mb-1 tracking-widest">Double</div>
                    <div className="text-base font-serif text-gray-900 font-bold">₹{item.doubleOccupancy}</div>
                  </div>
                  <div className="border-l-2 border-[#C5A059] pl-4">
                    <div className="text-[9px] uppercase font-black text-gray-400 mb-1 tracking-widest">Triple</div>
                    <div className="text-base font-serif text-gray-900 font-bold">₹{item.tripleOccupancy}</div>
                  </div>
                  <div className="border-l-2 border-[#C5A059] pl-4">
                    <div className="text-[9px] uppercase font-black text-gray-400 mb-1 tracking-widest">DJ / License</div>
                    <div className="text-base font-serif text-gray-900 font-bold leading-tight">
                        ₹{item.djCost} / ₹{item.licenseFeeDJ}
                    </div>
                  </div>
                  <div className="border-l-2 border-[#C5A059] pl-4">
                    <div className="text-[9px] uppercase font-black text-gray-400 mb-1 tracking-widest">Hall / Snacks</div>
                    <div className="text-base font-serif text-gray-900 font-bold leading-tight">
                        ₹{item.banquetHall} / ₹{item.cocktailSnacks}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-y border-gray-100 py-6">
                  <div className="border-l-2 border-[#C5A059] pl-4">
                    <div className="text-[10px] uppercase font-black text-gray-400 mb-1 tracking-widest flex items-center gap-2">
                      <Sun size={12}/> Day Outing Package
                    </div>
                    <div className="text-2xl font-serif text-gray-900">₹{item.packagePrice} <span className="text-xs italic text-gray-400">/ person</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1">
              <h3 className="text-[10px] uppercase font-black text-gray-400 mb-3 tracking-[0.2em]">About the Property</h3>
              <p className="text-gray-600 leading-relaxed font-serif text-lg italic whitespace-pre-line">
                {item.desc || "No description available."}
              </p>
            </div>

            <div className="mt-auto pt-8 border-t border-gray-100 flex justify-between items-end">
              <div className="relative z-20">
                <div className="text-[9px] uppercase font-bold text-gray-400 mb-1">Official Website</div>
                <a 
                  href={websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-[#C5A059] font-bold flex items-center gap-1 hover:underline cursor-pointer relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe size={12} /> {item.website || 'Available on request'}
                </a>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase font-black tracking-widest text-gray-300 mb-1">
                  Property {idx + 1} of {items.length}
                </div>
                <div className="text-[9px] uppercase font-black tracking-widest text-gray-300">
                  © Marqland Design Studio
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    });

    // TERMS AND CONDITIONS PAGE
    if (showTC) {
      pages.push(
        <div key="terms-page" className="a4-page shadow-2xl">
          <div className="border-wrapper">
            <div className="content-inner flex flex-col h-full p-16">
              <div className="border-b border-gray-100 pb-8 mb-12">
                <h2 className="text-center font-serif text-2xl uppercase tracking-[0.3em] text-gray-800">
                  Terms and Conditions
                </h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-gray-600 leading-relaxed font-serif text-lg italic whitespace-pre-line">
                  {tcContent}
                </p>
              </div>
              <div className="mt-auto pt-8 border-t border-gray-100 text-center">
                <div className="text-[9px] uppercase font-black tracking-widest text-gray-300">
                  © Marqland Design Studio • Confidential Proposal
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // CONTACT PAGE
    pages.push(
      <div key="contact" className="a4-page shadow-2xl">
        <div className="border-wrapper">
          <div className="content-inner flex flex-col items-center justify-center h-full text-center px-12 relative">
            <div className="mb-10 text-[#C5A059] font-serif">
              <h3 className="text-2xl mb-2">Connect With Us</h3>
              <h2 className="text-4xl leading-tight">Inquiries & Further Information</h2>
            </div>
            <p className="font-serif text-xl italic text-gray-600 mb-12 leading-relaxed">
              For bespoke inquiries and detailed specifications, our design team is at your disposal. 
              We invite you to connect with us to explore how we can elevate your vision.
            </p>
            <div className="space-y-6 mb-16 text-gray-800">
               <p className="text-sm"><span className="text-[#C5A059] block font-bold text-[10px] uppercase tracking-widest mb-1">Email</span><b>info@marqland.com</b></p>
               <p className="text-sm"><span className="text-[#C5A059] block font-bold text-[10px] uppercase tracking-widest mb-1">Phone</span><b>+91 9980069897 | +91 9886521187</b></p>
            </div>
            <div className="border border-[#C5A059] p-2 bg-white inline-block mb-4 shadow-sm">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.instagram.com/marqland" alt="QR" className="w-24 h-24" />
            </div>
            <br/><span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">@marqland</span>
            <div className="absolute bottom-10 left-0 right-0 text-center">
              <span className="text-[9px] text-gray-300 font-bold uppercase tracking-[0.3em]">© Marqland Design Studio</span>
            </div>
          </div>
        </div>
      </div>
    );

    return pages;
  };

  return (
    <div className="w-full bg-gray-200 min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700;900&display=swap');
        .a4-page { width: 210mm; height: 297mm; background: white; margin: 0 auto 30px; position: relative; box-sizing: border-box; overflow: hidden; }
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
        .font-serif { font-family: 'Playfair Display', serif; }
        .border-wrapper { position: absolute; top: 15mm; left: 15mm; right: 15mm; bottom: 15mm; border: 1px solid #C5A059; pointer-events: none; z-index: 5; }
        .border-wrapper > * { pointer-events: auto; }
        .cover-border { border: 2.5pt solid #C5A059 !important; }
        .content-inner { padding: 10mm; height: 100%; width: 100%; box-sizing: border-box; }
        #print-root { position: fixed; top: 0; left: -5000px; width: 210mm; height: auto; z-index: -100; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden; height: 0; overflow: hidden; margin: 0; }
          #print-root, #print-root * { visibility: visible; height: auto; overflow: visible; display: block !important; left: 0; position: absolute; }
          .a4-page { margin: 0 !important; page-break-after: always !important; box-shadow: none !important; border: none !important; }
          .border-wrapper { border: 1px solid #C5A059 !important; -webkit-print-color-adjust: exact; }
          .cover-border { border: 2.5pt solid #C5A059 !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {isGenerating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin mb-4 text-[#C5A059]" size={64} />
          <p className="font-serif text-3xl italic tracking-wide">Crafting Your Proposal...</p>
          <p className="text-xs uppercase tracking-widest mt-4 opacity-50">Please do not close this window</p>
        </div>
      )}

      <div id="print-root" ref={printRef}>
        {renderPages()}
      </div>

      <div id="screen-ui" className="flex h-screen overflow-hidden">
        <div id="sidebar" className="w-[450px] bg-white border-r flex flex-col shadow-xl z-20">
          <div className="p-6 border-b flex justify-between items-center bg-[#1a1a1a] text-white">
            <div className="flex gap-2">
              <button 
                onClick={saveToDb} 
                disabled={saveLoading}
                className="bg-white/10 hover:bg-white/20 p-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {saveLoading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                {saveLoading ? 'Saving...' : 'Save Progress'}
              </button>
              <button onClick={handlePrint} className="bg-[#C5A059] p-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:brightness-110 transition-all">
                <Printer size={14}/> Download PDF
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Branding</h3>
              <div className="space-y-3">
                <label className="text-[9px] font-bold uppercase text-gray-400">Client Name</label>
                <input 
                  className="w-full p-3 border rounded text-sm bg-gray-50 focus:bg-white focus:ring-1 ring-[#C5A059] outline-none font-bold" 
                  placeholder="Enter Client Name..." 
                  value={clientName} 
                  onChange={e => setClientName(e.target.value)} 
                />
                <label className="text-[9px] font-bold uppercase text-gray-400">Subtitle</label>
                <input 
                  className="w-full p-3 border rounded text-sm bg-gray-50 focus:bg-white focus:ring-1 ring-[#C5A059] outline-none" 
                  placeholder="e.g. Curated Property Portfolio" 
                  value={subtitle} 
                  onChange={e => setSubtitle(e.target.value)} 
                />
              </div>
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="text-[10px] font-black uppercase text-[#C5A059] tracking-widest flex justify-between">
                  <span>Property Data ({items.length})</span>
              </h3>
              {items.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-xl p-4 border relative group hover:border-[#C5A059] transition-all">
                  <div className="flex gap-4 mb-4">
                    <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                      {item.image && <img src={item.image} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input className="w-full bg-transparent font-bold text-sm mb-1 outline-none truncate" value={item.name} onChange={e => updateItemField(item.id, 'name', e.target.value)} />
                      <input className="w-full bg-transparent text-xs text-gray-400 mb-1 outline-none truncate" value={item.location} onChange={e => updateItemField(item.id, 'location', e.target.value)} />
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ${item.type === 'Night Stay' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  {item.type === 'Night Stay' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-2 rounded border">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Double</label>
                          <input className="w-full text-sm font-bold text-[#C5A059] outline-none" value={item.doubleOccupancy} onChange={e => updateItemField(item.id, 'doubleOccupancy', e.target.value)} />
                        </div>
                        <div className="bg-white p-2 rounded border">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Triple</label>
                          <input className="w-full text-sm font-bold text-[#C5A059] outline-none" value={item.tripleOccupancy} onChange={e => updateItemField(item.id, 'tripleOccupancy', e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-2 rounded border">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">DJ / License</label>
                          <div className="flex gap-1">
                              <input className="w-1/2 text-xs outline-none border-r" placeholder="DJ" value={item.djCost} onChange={e => updateItemField(item.id, 'djCost', e.target.value)} />
                              <input className="w-1/2 text-xs outline-none" placeholder="Lic" value={item.licenseFeeDJ} onChange={e => updateItemField(item.id, 'licenseFeeDJ', e.target.value)} />
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded border">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Hall / Snacks</label>
                          <div className="flex gap-1">
                              <input className="w-1/2 text-xs outline-none border-r" placeholder="Hall" value={item.banquetHall} onChange={e => updateItemField(item.id, 'banquetHall', e.target.value)} />
                              <input className="w-1/2 text-xs outline-none" placeholder="Snack" value={item.cocktailSnacks} onChange={e => updateItemField(item.id, 'cocktailSnacks', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-2 rounded border mb-3">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Package Price (₹)</label>
                      <input className="w-full text-sm font-bold text-[#C5A059] outline-none" value={item.packagePrice} onChange={e => updateItemField(item.id, 'packagePrice', e.target.value)} />
                    </div>
                  )}

                  <textarea 
                    className="w-full h-20 mt-3 p-2 text-xs bg-white border rounded resize-none outline-none focus:ring-1 ring-[#C5A059]" 
                    placeholder="Property Description"
                    value={item.desc}
                    onChange={e => updateItemField(item.id, 'desc', e.target.value)}
                  />
                </div>
              ))}
            </section>

            <section className="space-y-4 border-t pt-6 pb-12">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Legal / T&C</h3>
                  <button 
                    onClick={() => setShowTC(!showTC)}
                    className={`text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter transition-all ${showTC ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}
                  >
                    {showTC ? 'Remove T&C Page' : 'Add T&C Page'}
                  </button>
                </div>
                {showTC && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-300">
                    <div className="flex items-center gap-2 mb-3 text-gray-500">
                      <FileText size={14} />
                      <span className="text-[9px] font-bold uppercase">Page Content</span>
                    </div>
                    <textarea 
                      className="w-full h-40 p-3 text-xs bg-white border rounded resize-none outline-none focus:ring-1 ring-[#C5A059]" 
                      placeholder="Enter terms and conditions here..."
                      value={tcContent}
                      onChange={e => setTcContent(e.target.value)}
                    />
                  </div>
                )}
            </section>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-12 bg-gray-300">
          <div className="max-w-[210mm] mx-auto scale-[0.85] origin-top">
            {renderPages()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OffsiteBuilder;