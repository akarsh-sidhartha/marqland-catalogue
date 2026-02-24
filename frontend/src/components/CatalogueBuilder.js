import React, { useState, useEffect } from 'react';
import { Trash2, Printer, ChevronLeft, Upload, GripVertical, Save } from 'lucide-react';
import { getBaseUrl } from '../baseurl'; // Import the central function
import axios from 'axios';

const CatalogueBuilder = () => {
  const [clientName, setClientName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [items, setItems] = useState([]);
  const [customProduct, setCustomProduct] = useState({ name: '', desc: '', price: '', image: null });
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

    // Determine the API Base URL based on the current environment
  /*
  const getApiUrl = () => {
    const hostname = window.location.hostname;
    // If running in a cloud/preview environment, we might need a relative path or specific proxy
    // For local development, it defaults to localhost:5000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:5000/api/offsitecatalogues`;
    }
    // Fallback for custom local network IPs or production
    return `http://${hostname}:5000/api/offsitecatalogues`;
  };
  */
   const API_URL_PROPERTIES = `${getBaseUrl()}/offsitecatalogues`;
    /**
   * Helper function to format image URLs correctly
   * If it's Base64 or already a full URL, return it as is.
   * Otherwise, prepend the server URL.
   */
  const formatImageUrl = (imgStr) => {
    if (!imgStr) return null;
    if (imgStr.startsWith('data:') || imgStr.startsWith('http')) {
      return imgStr;
    }
    // If it's a local path like /uploads/... ensure it has leading slash or fix it
    const path = imgStr.startsWith('/') ? imgStr : `/${imgStr}`;
    return `${getApiUrl()}${path}`;
  };

  // Initialize data from localStorage on component mount

useEffect(() => {
    const savedSelection  = localStorage.getItem('catalogue_selection');
     const savedCatalogueItems = localStorage.getItem('current_catalogue_items');
    if (savedSelection) {
        try {
          // Clear branding fields for a new catalogue
          setClientName('');
          setSubtitle('');
          localStorage.removeItem('current_catalogue_id');
          localStorage.removeItem('current_catalogue_name');
          localStorage.removeItem('current_catalogue_subtitle');
          localStorage.removeItem('current_catalogue_items');

          // Load the freshly selected items
          const rawData = JSON.parse(savedSelection);
          const selectedProducts = rawData.map(p => ({
            id: p.id || p._id || Date.now() + Math.random(),
            name: p.name,
            desc: p.desc || p.description || '', 
            price: p.price ? p.price.toString().replace('₹', '').trim() : '0',
            image: p.image || (p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : `http://localhost:5000${p.imageUrl}`) : null)
          }));
          setItems(selectedProducts);
          
          // Clean up the trigger so a refresh doesn't treat it as "new" again
          localStorage.removeItem('catalogue_selection');
        } catch (e) {
            console.error("Error parsing saved items", e);
        }
    } else if (savedCatalogueItems){
        // PRIORITY 2: Resume an existing session (Saved State or Refresh)
        const savedName = localStorage.getItem('current_catalogue_name');
        if (savedName) setClientName(savedName);

        const savedSubtitle = localStorage.getItem('current_catalogue_subtitle');
        if (savedSubtitle) setSubtitle(savedSubtitle);

        const rawData = JSON.parse(savedCatalogueItems);
        const resumedProducts = rawData.map(p => ({
          id: p.id || p._id || Date.now() + Math.random(),
          name: p.name,
          desc: p.desc || p.description || '', 
          price: p.price ? p.price.toString().replace('₹', '').trim() : '0',
          image: formatImageUrl(p.imageUrl || p.image)
          //image: p.image || (p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : `http://localhost:5000/${p.imageUrl}`) : null)
        }));
        setItems(resumedProducts);
      }
}, []);

  const handlePriceChange = (id, newPrice) => {
    const updatedItems = items.map(item => 
      item.id === id ? { ...item, price: newPrice } : item
    );
    setItems(updatedItems);
  };

  const onDragStart = (index) => setDraggedItemIndex(index);

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newItems = [...items];
    const draggedItem = newItems[draggedItemIndex];
    newItems.splice(draggedItemIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setDraggedItemIndex(index);
    setItems(newItems);
  };

  const onDragEnd = () => setDraggedItemIndex(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomProduct({ ...customProduct, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const saveCatalogueToDb = async () => {
    const currentId = localStorage.getItem('current_catalogue_id');
    const existingName = clientName || localStorage.getItem('current_catalogue_name') || "New Catalogue";
    
    // Use prompt only if name doesn't exist, or allow renaming
    const name = prompt("Enter Catalogue Name:", existingName);
    if (!name) return;

    // Helper to sync local storage reliably
    const syncLocalStorage = (id, finalName, savedItems) => {
      if (id && id !== 'undefined') localStorage.setItem('current_catalogue_id', id);
      localStorage.setItem('current_catalogue_name', finalName);
      localStorage.setItem('current_catalogue_subtitle', subtitle);
      // Save items exactly as they are in state to maintain 'image' property locally
      localStorage.setItem('current_catalogue_items', JSON.stringify(savedItems));
    };

    try {
      // Map frontend 'image' to backend 'imageUrl'
      const mappedItems = items.map(item => ({
        _id: item.id?.toString().includes('.') ? Math.trunc(item.id).toString() : item.id,
        name: item.name,
        description: item.desc || item.description, 
        price: item.price,
        imageUrl: item.image || item.imageUrl // Ensure we catch both possibilities
      }));

      const payload = {
        name,
        subtitle, 
        items: mappedItems,
        id: currentId 
      };
      
      const hostname = window.location.hostname || 'localhost';
      const apiUrl = `http://${hostname}:5000/api/catalogues`;
      
      console.log("🚀 Saving Catalogue:", payload);
      const res = await axios.post(apiUrl, payload);
      
      const savedId = res.data?._id || res.data?.id || currentId;
      const finalName = res.data?.name || name;
      const finalSubtitle = res.data?.subtitle || subtitle;
      
      // Update local storage with the current state items
      syncLocalStorage(savedId, finalName, items);
      
      setClientName(finalName);
      setSubtitle(finalSubtitle);
      
      window.dispatchEvent(new CustomEvent('catalogueSaved', { 
        detail: { id: savedId, name: finalName, timestamp: Date.now() } 
      }));
      
      alert("Catalogue saved successfully!");
      
    } catch (err) {
      console.error("❌ Save Error:", err);
      const errorMsg = err.response?.data?.message || err.message;
      alert(`Save Error: ${errorMsg}`);
    }
  };

  const addManualProduct = () => {
    if (!customProduct.name || !customProduct.price) return alert("Enter name and price");
    const newItem = { id: Date.now() + Math.random(), ...customProduct };
    setItems([...items, newItem]);
    setCustomProduct({ name: '', desc: '', price: '', image: null });
  };

  const handlePrint = () => window.print();

  const renderCataloguePages = () => {
    const pages = [];
    
    // COVER PAGE
    pages.push(
      <div key="cover" className="a4-page shadow-2xl">
        <div className="border-wrapper">
          <div className="content-inner flex flex-col items-center justify-center h-full text-center">
            <div className="text-[#C5A059] tracking-[0.4em] uppercase text-[10px] font-bold mb-12">By Marqland</div>
            <h1 className="font-serif text-6xl mb-8 leading-tight text-gray-900">{clientName || "Client Name"}</h1>
            <div className="w-16 h-[2px] bg-[#C5A059] mb-8"></div>
            <h2 className="font-serif text-3xl text-gray-400 italic font-light">{subtitle || "Project Catalogue"}</h2>
            <div className="absolute bottom-10 left-0 right-0 text-center text-[10px] text-gray-400 font-bold tracking-[0.4em] uppercase">Celebrate Teams. Delight Clients.</div>
          </div>
        </div>
      </div>
    );

    // PRODUCT PAGES (4 items per page)
    for (let i = 0; i < items.length; i += 4) {
      const pageItems = items.slice(i, i + 4);
      pages.push(
        <div key={`page-${i}`} className="a4-page shadow-2xl">
          <div className="border-wrapper">
            <div className="content-inner h-full flex flex-col !pt-[10mm] !pb-[10mm]">
              <div className="flex justify-between border-b border-[#C5A059] pb-2 mb-4">
                <span className="text-[#C5A059] tracking-[0.3em] uppercase text-[10px] font-bold">Marqland</span>
                <span className="font-serif italic text-gray-400 font-bold text-xs">Page {Math.floor(i/4) + 1}</span>
              </div>
              <div className="grid grid-cols-2 grid-rows-2 gap-x-8 gap-y-8 flex-1">
                {pageItems.map(item => (
                  <div key={item.id} className="flex flex-col items-center text-center">
                    <div className="h-[180px] w-full flex items-center justify-center mb-3 overflow-hidden bg-gray-50/50 rounded-lg">
                      <img src={item.image} className="max-h-full max-w-full object-contain mix-blend-multiply" alt="" />
                    </div>
                    <h4 className="font-serif text-lg font-bold text-gray-900 leading-tight mb-1">{item.name}</h4>
                    <p className="text-gray-500 text-[11px] italic line-clamp-4 px-2 mb-1 leading-relaxed">{item.desc}</p>
                    <p className="text-[#C5A059] font-sans font-bold text-[12px] tracking-widest">₹{item.price}</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-auto pb-1 border-t border-gray-100 pt-3">
                <span className="text-[9px] text-gray-300 font-bold uppercase tracking-[0.3em]">© Marqland Design Studio</span>
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
          <div className="content-inner flex flex-col items-center justify-center h-full text-center px-12">
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
          </div>
        </div>
      </div>
    );
    return pages;
  };

  return (
    <div className="w-full bg-gray-100 min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,400&family=Montserrat:wght@400;700&display=swap');
        .a4-page { width: 210mm; height: 297mm; background: white; margin: 0 auto 30px; position: relative; box-sizing: border-box; overflow: hidden; }
        .border-wrapper { position: absolute; top: 15mm; left: 15mm; right: 15mm; bottom: 15mm; border: 1px solid #C5A059; pointer-events: none; }
        .content-inner { padding: 20mm 15mm; height: 100%; width: 100%; box-sizing: border-box; }
        
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden; }
          #print-root, #print-root * { visibility: visible; }
          #print-root { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
          .a4-page { margin: 0 !important; page-break-after: always !important; box-shadow: none !important; }
        }
        #print-root { display: none; }
      `}</style>

      <div id="screen-ui" className="flex h-screen overflow-hidden">
        {/* SIDEBAR PANEL */}
        <div className="w-[420px] bg-white border-r p-6 overflow-y-auto flex flex-col shadow-2xl z-20">
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => window.history.back()} className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tighter hover:text-[#C5A059] transition-colors">
              <ChevronLeft size={14}/> BACK
            </button>
            <button 
              onClick={saveCatalogueToDb}
              className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all shadow-sm"
            >
              <Save size={14}/> Save Progress
            </button>
          </div>
          
          <h1 className="font-serif text-2xl text-[#C5A059] text-center mb-8 uppercase tracking-widest">Catalogue Studio</h1>
          
          <div className="space-y-8 flex-1">
             <div className="space-y-3">
                <label className="text-[9px] font-bold uppercase text-gray-400 tracking-[0.2em]">1. Branding</label>
                <input className="w-full border p-3 rounded text-sm outline-none focus:border-[#C5A059]" placeholder="Client Name" value={clientName} onChange={e => setClientName(e.target.value)} />
                <input className="w-full border p-3 rounded text-sm outline-none focus:border-[#C5A059]" placeholder="Subtitle" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
             </div>

             <div className="space-y-4 border-t pt-6">
                <label className="text-[10px] font-bold uppercase text-[#C5A059] tracking-[0.1em]">2. Add Custom Product</label>
                <input type="file" id="manual-upload" className="hidden" onChange={handleImageUpload} />
                <label htmlFor="manual-upload" className="cursor-pointer block w-full h-32 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center gap-2 overflow-hidden">
                    {customProduct.image ? <img src={customProduct.image} className="h-full w-full object-contain p-2" alt="" /> : <Upload size={20} className="text-[#C5A059]" />}
                </label>
                <input className="w-full border p-3 rounded text-sm outline-none" placeholder="Product Name" value={customProduct.name} onChange={e => setCustomProduct({...customProduct, name: e.target.value})} />
                <textarea className="w-full border p-3 rounded text-sm outline-none resize-none h-20" placeholder="Product Description" value={customProduct.desc} onChange={e => setCustomProduct({...customProduct, desc: e.target.value})} />
                <input className="w-full border p-3 rounded text-sm outline-none" placeholder="Price" value={customProduct.price} onChange={e => setCustomProduct({...customProduct, price: e.target.value})} />
                <button onClick={addManualProduct} className="w-full bg-[#1A1A1A] text-white py-3 rounded font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-colors">Add Product</button>
             </div>

             <div className="space-y-3 border-t pt-6 pb-24">
                <label className="text-[9px] font-bold uppercase text-gray-400 tracking-[0.2em]">3. Manage Items ({items.length})</label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div 
                      key={item.id} 
                      draggable 
                      onDragStart={() => onDragStart(index)} 
                      onDragOver={(e) => onDragOver(e, index)} 
                      onDragEnd={onDragEnd} 
                      className={`bg-gray-50 p-3 rounded border flex items-center gap-3 cursor-move transition-all ${draggedItemIndex === index ? 'opacity-30 scale-95 shadow-inner' : 'opacity-100 shadow-sm'}`}
                    >
                      <GripVertical size={16} className="text-gray-300" />
                      <img src={item.image} className="w-10 h-10 object-cover rounded bg-white border" alt="" />
                      <div className="flex-1 overflow-hidden">
                         <p className="text-[10px] font-bold truncate text-gray-700">{item.name}</p>
                         <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#C5A059] font-bold">₹</span>
                            <input 
                              className="w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#C5A059] text-[10px] text-[#C5A059] font-bold outline-none" 
                              value={item.price} 
                              onChange={(e) => handlePriceChange(item.id, e.target.value)} 
                            />
                         </div>
                      </div>
                      <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          <button onClick={handlePrint} className="sticky bottom-0 bg-[#C5A059] text-white py-4 rounded font-serif text-xl flex items-center justify-center gap-3 hover:bg-[#b08d4a] transition-all shadow-xl mt-4 z-30">
            <Printer size={22}/> Generate PDF
          </button>
        </div>

        {/* PREVIEW VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-12 bg-gray-300">
            <div className="max-w-[210mm] mx-auto scale-90 origin-top">
              {renderCataloguePages()}
            </div>
        </div>
      </div>

      {/* PRINT VERSION ROOT */}
      <div id="print-root">
        {renderCataloguePages()}
      </div>
    </div>
  );
};

export default CatalogueBuilder;