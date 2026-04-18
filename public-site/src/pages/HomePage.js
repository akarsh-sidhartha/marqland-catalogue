import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon,
  Link2,
  Mail,
  Quote,
  X,
  ChevronLeft,
  ShoppingBag,
  Palette,
  CheckCircle,
  Truck,
  ArrowUpRight,
  Check
} from 'lucide-react';

// ── Config ─────────────────────────────────────────────────────────────────────
// In production both the public site and the API are served from the same origin,
// so empty string means "same host". Override with env var for local dev.
const API_BASE   = process.env.REACT_APP_API_BASE   || '';
const IMAGE_BASE = process.env.REACT_APP_IMAGE_BASE || '';

const COLORS = {
  NAVY:  '#1a2332',
  GOLD:  '#c5a357',
  CREAM: '#f4f1ea',
};

// ── Bento layout helpers ───────────────────────────────────────────────────────
const getBentoClasses = (index) => {
  const pattern = [
    'md:col-span-1 md:row-span-2',
    'md:col-span-2 md:row-span-1',
    'md:col-span-1 md:row-span-1',
    'md:col-span-1 md:row-span-1',
    'md:col-span-1 md:row-span-2',
    'md:col-span-2 md:row-span-2',
    'md:col-span-1 md:row-span-1',
  ];
  return pattern[index % pattern.length];
};

// ── Main component ─────────────────────────────────────────────────────────────
const HomePage = () => {
  const [data, setData]               = useState({ categories: [], testimonials: [] });
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '', company: '', email: '', phone: '', message: '',
  });
  const [lightbox, setLightbox] = useState({ isOpen: false, index: 0, images: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/public-site/store`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch portfolio data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const scrollToSection = (id) => {
    if (selectedCat) {
      setSelectedCat(null);
      setSelectedSub(null);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (selectedSub) { setSelectedSub(null); }
    else             { setSelectedCat(null); }
    window.scrollTo(0, 0);
  };

  const selectCategory = (cat) => {
    setSelectedCat(cat);
    const nonCoverImages = (cat.images || []).filter(img => !img.isCover);
    if (nonCoverImages.length === 0 && cat.subcategories?.length > 0) {
      setSelectedSub(cat.subcategories[0]);
    } else {
      setSelectedSub(null);
    }
    window.scrollTo(0, 0);
  };

  const getDisplayImages = () => {
    if (!selectedCat) return [];
    if (selectedSub && selectedSub.id !== 'generic') return selectedSub.images || [];
    return (selectedCat.images || []).filter(img => !img.isCover);
  };
  const currentImages = getDisplayImages();

  const openLightbox  = (index) => {
    setLightbox({ isOpen: true, index, images: currentImages });
    document.body.style.overflow = 'hidden';
  };
  const closeLightbox = () => {
    setLightbox({ isOpen: false, index: 0, images: [] });
    document.body.style.overflow = 'auto';
  };
  const nextImage = (e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index + 1) % p.images.length })); };
  const prevImage = (e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index - 1 + p.images.length) % p.images.length })); };

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/public-site/inquiry`, inquiryForm);
      setShowSuccess(true);
      setInquiryForm({ name: '', company: '', email: '', phone: '', message: '' });
    } catch (err) { console.error(err); }
  };

  const closeModals = () => { setShowInquiryModal(false); setShowSuccess(false); };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-48 bg-slate-100 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-slate-50 rounded-full"></div>
        </div>
      </div>
    );
  }

  const hasGenericImages = selectedCat?.images?.filter(img => !img.isCover).length > 0;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#c5a357] selection:text-white">

      {/* Lightbox */}
      {lightbox.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center" onClick={closeLightbox}>
          <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-2 z-[110]"><X size={32} /></button>
          <button onClick={prevImage} className="absolute left-4 md:left-8 text-white/30 hover:text-white transition-all p-4 z-[110]">
            <ChevronLeft size={48} strokeWidth={1} />
          </button>
          <div className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center">
            <img
              src={`${IMAGE_BASE}${lightbox.images[lightbox.index].url}`}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl select-none"
              onClick={e => e.stopPropagation()}
            />
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] mt-6">
              {lightbox.index + 1} / {lightbox.images.length}
            </p>
          </div>
          <button onClick={nextImage} className="absolute right-4 md:right-8 text-white/30 hover:text-white transition-all p-4 z-[110]">
            <ChevronRight size={48} strokeWidth={1} />
          </button>
        </div>
      )}

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] relative">
            <button onClick={closeModals} className="absolute top-8 right-8 p-2 text-slate-300 hover:text-black transition-colors"><X size={20} /></button>
            {!showSuccess ? (
              <>
                <h2 className="text-4xl font-serif mb-2 tracking-tight">Get in touch</h2>
                <p className="text-slate-400 text-sm mb-10 italic">Let's orchestrate something special together.</p>
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <input type="text" required placeholder="Name"
                    className="w-full px-8 py-5 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-[#c5a357] outline-none placeholder:text-slate-300"
                    value={inquiryForm.name} onChange={e => setInquiryForm({ ...inquiryForm, name: e.target.value })} />
                  <input type="text" required placeholder="Company Name"
                    className="w-full px-8 py-5 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-[#c5a357] outline-none placeholder:text-slate-300"
                    value={inquiryForm.company} onChange={e => setInquiryForm({ ...inquiryForm, company: e.target.value })} />
                  <input type="email" required placeholder="Email Address"
                    className="w-full px-8 py-5 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-[#c5a357] outline-none placeholder:text-slate-300"
                    value={inquiryForm.email} onChange={e => setInquiryForm({ ...inquiryForm, email: e.target.value })} />
                  <input type="tel" required placeholder="Phone Number"
                    className="w-full px-8 py-5 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-[#c5a357] outline-none placeholder:text-slate-300"
                    value={inquiryForm.phone} onChange={e => setInquiryForm({ ...inquiryForm, phone: e.target.value })} />
                  <button type="submit" className="w-full py-6 bg-black text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-slate-800 transition-all shadow-xl mt-6">
                    Send Inquiry
                  </button>
                </form>
              </>
            ) : (
              <div className="py-12 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-8"><Check size={40} /></div>
                <h2 className="text-3xl font-serif mb-4">Inquiry Received</h2>
                <p className="text-slate-500 text-sm italic mb-8 max-w-[280px]">Our team will reach out sooner than you expect.</p>
                <button onClick={closeModals} className="px-10 py-4 bg-black text-white rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-50 px-8 py-3 flex justify-between items-center">
        <div className="text-xl font-black tracking-tighter uppercase cursor-pointer"
          onClick={() => { setSelectedCat(null); setSelectedSub(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          Marqland Studios
        </div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest items-center">
          <button onClick={() => scrollToSection('catalogue')} className="hover:opacity-50 transition-opacity">Catalogue</button>
          <button onClick={() => scrollToSection('process')} className="hover:opacity-50 transition-opacity">How it Works</button>
          <button onClick={() => scrollToSection('testimonials')} className="hover:opacity-50 transition-opacity">Testimonials</button>
          <button onClick={() => setShowInquiryModal(true)} className="bg-[#1a2332] text-white px-5 py-2 rounded-full hover:bg-slate-800 transition-all">Get in Touch</button>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-8 max-w-[1600px] mx-auto">
        {!selectedCat ? (
          <>
            {/* Hero */}
            <section style={{ backgroundColor: COLORS.NAVY }} className="py-24 rounded-[4rem] mb-14 text-white overflow-hidden relative">
              <div className="container mx-auto px-12 relative z-10 text-center">
                <div className="inline-block mb-6 px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                  <span style={{ color: COLORS.GOLD }} className="text-[10px] font-black tracking-[0.5em] uppercase">Premium Corporate Gifting</span>
                </div>
                <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
                  <span style={{ color: COLORS.CREAM }} className="block md:inline">Gifts That </span>
                  <span style={{ color: COLORS.GOLD }} className="block md:inline">Speak Volumes</span>
                </h1>
                <p className="font-serif italic text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
                  From onboarding kits to grand celebrations — we craft bespoke gifting experiences that elevate your brand and delight every recipient.
                </p>
                <div className="mt-12 flex flex-col md:flex-row gap-4 justify-center items-center">
                  <button onClick={() => scrollToSection('catalogue')}
                    style={{ backgroundColor: COLORS.GOLD }}
                    className="px-8 py-4 text-[#1a2332] rounded-xl font-bold uppercase tracking-widest text-[10px] hover:opacity-90 transition-all shadow-xl">
                    Explore Catalogue
                  </button>
                  <button onClick={() => setShowInquiryModal(true)}
                    className="px-8 py-4 border border-white/20 bg-white/5 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">
                    Get in Touch
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.03] rounded-full blur-[100px] -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#c5a357]/[0.05] rounded-full blur-[100px] -ml-32 -mb-32"></div>
            </section>

            {/* Catalogue bento */}
            <section id="catalogue" className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[350px] mb-24 scroll-mt-32">
              {data.categories.map((cat, idx) => {
                const catCover = cat.images?.find(i => i.isCover) || cat.images?.[0];
                return (
                  <div key={cat.id} onClick={() => selectCategory(cat)}
                    className={`group cursor-pointer relative overflow-hidden rounded-[2.5rem] bg-slate-50 transition-all duration-700 hover:shadow-2xl hover:-translate-y-1 ${getBentoClasses(idx)}`}>
                    {catCover ? (
                      <div className="absolute inset-0">
                        <img src={`${IMAGE_BASE}${catCover.url}`} alt={cat.name}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200">
                        <ImageIcon size={40} strokeWidth={1} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                    <div className="absolute bottom-10 left-10 right-10 z-10">
                      <h3 className="text-2xl font-serif text-white mb-2">{cat.name}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em]">Browse Category</p>
                        <ChevronRight className="w-3 h-3 text-white/40 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* How it works */}
            <section id="process" style={{ backgroundColor: COLORS.NAVY }} className="py-24 rounded-[4rem] mb-24 text-white overflow-hidden relative scroll-mt-32">
              <div className="container mx-auto px-12 relative z-10">
                <div className="text-center mb-16">
                  <div className="inline-block mb-6 px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                    <span style={{ color: COLORS.GOLD }} className="text-[10px] font-black tracking-[0.5em] uppercase">How It Works</span>
                  </div>
                  <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                    <span style={{ color: COLORS.CREAM }}>Seamless from </span>
                    <span style={{ color: COLORS.GOLD }}>Start to Finish</span>
                  </h2>
                  <p className="font-serif italic text-white/40 max-w-xl mx-auto">A simple four-step process to bring your gifting vision to life.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    { icon: ShoppingBag, title: 'Select Product',  step: '01', desc: 'Choose from our curated collection.' },
                    { icon: Palette,     title: 'Request Mockup', step: '02', desc: 'We visualize your brand on the product.' },
                    { icon: CheckCircle, title: 'Approve',        step: '03', desc: 'Finalize design and specifications.' },
                    { icon: Truck,       title: 'Delivery',       step: '04', desc: 'Timely logistics across the nation.' },
                  ].map(s => (
                    <div key={s.step} className="relative group">
                      <div className="p-10 rounded-[2.5rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500 h-full flex flex-col">
                        <span className="font-serif text-5xl font-bold text-white/5 absolute top-8 right-8 select-none">{s.step}</span>
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors">
                          <s.icon className="w-6 h-6 text-white/60" />
                        </div>
                        <h3 className="font-serif text-xl font-semibold mb-3">{s.title}</h3>
                        <p className="font-sans text-[10px] font-bold text-white/30 leading-relaxed uppercase tracking-widest">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Testimonials */}
            {data.testimonials?.length > 0 && (
              <section id="testimonials" className="mb-24 py-12 px-12 bg-white scroll-mt-32">
                <div className="max-w-4xl mx-auto text-center mb-16 flex flex-col items-center">
                  <div className="flex items-center gap-6 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">Client Voices</span>
                    <div className="w-px h-6 bg-slate-100"></div>
                    <h2 className="text-4xl font-serif">Kind Words</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {data.testimonials.map((t, i) => (
                    <div key={i} className="bg-white p-12 rounded-[2.5rem] relative group border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col h-full">
                      <Quote className="absolute top-10 right-10 text-slate-50 w-16 h-16 -z-0" strokeWidth={1} />
                      <div className="relative z-10 flex-grow">
                        <p className="text-lg font-serif italic text-slate-700 mb-12 leading-relaxed">
                          "{t.feedback || t.content || 'The attention to detail in their packaging exceeded our expectations.'}"
                        </p>
                      </div>
                      <div className="flex items-center gap-5 mt-auto relative z-10">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400 text-xs shrink-0 uppercase">
                          {t.author ? t.author[0] : 'C'}
                        </div>
                        <div>
                          <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-900">{t.author || 'Client'}</h4>
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">{t.role || t.company}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
            <section style={{ backgroundColor: COLORS.NAVY }} className="py-32 rounded-[4rem] mb-24 text-white overflow-hidden relative">
              <div className="container mx-auto px-12 relative z-10 text-center">
                <div className="inline-block mb-6 px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                  <span style={{ color: COLORS.GOLD }} className="text-[10px] font-black tracking-[0.5em] uppercase">We'll live up to the hype</span>
                </div>
                <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                  <span style={{ color: COLORS.CREAM }}>The rumor mill was right — </span>
                  <span style={{ color: COLORS.GOLD }}>welcome</span>
                </h2>
                <p className="font-serif italic text-white/40 text-xl max-w-2xl mx-auto mb-14 leading-relaxed">Drop your digits. We'll do the rest.</p>
                <button onClick={() => setShowInquiryModal(true)}
                  style={{ backgroundColor: COLORS.GOLD }}
                  className="group flex items-center gap-4 text-[#1a2332] px-12 py-6 mx-auto rounded-xl font-bold uppercase tracking-[0.2em] text-xs transition-all duration-300 shadow-2xl">
                  Get in touch
                  <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </button>
              </div>
            </section>
          </>
        ) : (
          /* Category detail view */
          <div className="w-full">
            <div className="mb-12">
              <button onClick={handleBack} className="mb-6 flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors">
                <ArrowLeft size={16} className="mr-2" /> Back to Catalogue
              </button>
              <h2 className="text-6xl font-serif mb-4 leading-tight tracking-tight">
                {selectedSub?.name || selectedCat.name}
              </h2>
              {selectedCat.subcategories?.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-2">
                  {hasGenericImages && (
                    <button onClick={() => setSelectedSub(null)}
                      className={`px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${!selectedSub ? 'bg-black text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                      All
                    </button>
                  )}
                  {selectedCat.subcategories.map(sub => (
                    <button key={sub.id} onClick={() => setSelectedSub(sub)}
                      className={`px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${selectedSub?.id === sub.id ? 'bg-black text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 items-start">
              {currentImages.map((img, idx) => (
                <div key={img.id} onClick={() => openLightbox(idx)}
                  className="flex flex-col group cursor-zoom-in">
                  <div className="relative w-full max-h-[480px] overflow-hidden rounded-[2.5rem] bg-slate-50 border border-slate-100 transition-all duration-500 group-hover:shadow-2xl">
                    <img src={`${IMAGE_BASE}${img.url}`} alt="portfolio item"
                      className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                      loading="lazy" />
                  </div>
                  <div className="mt-4 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Expand Image</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-50 py-24 px-8 border-t border-slate-100">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-20">
          <div>
            <h2 className="text-4xl font-serif mb-6 leading-tight">Marqland Studios.</h2>
            <p className="text-slate-500 mb-8 max-w-sm leading-relaxed text-sm">
              Crafting premium brand experiences through curated gifting and bespoke event orchestration.
            </p>
            <div className="flex gap-4">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="p-4 bg-white rounded-full hover:bg-black hover:text-white transition-all shadow-sm border border-slate-100"><Link2 size={18} /></a>
              <a href="mailto:hello@marqland.com" className="p-4 bg-white rounded-full hover:bg-black hover:text-white transition-all shadow-sm border border-slate-100"><Mail size={18} /></a>
            </div>
          </div>
          <div className="flex flex-col justify-end text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
              © {new Date().getFullYear()} Marqland Studios — Bespoke Orchestration
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;