import React, { useState, useEffect } from 'react';
import api from '../../api'; // uses the existing Axios instance (authenticated)

// All public-site API calls go through /api/public-site/
// This works from internalportal.marqland.com (admin) AND from www.marqland.com (public)
const psApi = {
  get:   (path, cfg)        => api.get(`/public-site${path}`, cfg),
  post:  (path, data, cfg)  => api.post(`/public-site${path}`, data, cfg),
  put:   (path, data, cfg)  => api.put(`/public-site${path}`, data, cfg),
  patch: (path, data, cfg)  => api.patch(`/public-site${path}`, data, cfg),
  delete:(path, cfg)        => api.delete(`/public-site${path}`, cfg),
};

// Image base: in dev the backend is on :5000, in production same origin
const IMAGE_BASE = process.env.REACT_APP_IMAGE_BASE || '';
import {
  Trash2, Upload, Plus, LayoutGrid,
  AlertTriangle, RefreshCw, ChevronRight,
  ArrowLeft, Edit3, X, Folder, Mail, User, Phone, GripVertical,
} from 'lucide-react';

/**
 * AdminView — frontend/src/pages/public-site/AdminView.js
 *
 * Manages the content of www.marqland.com from inside the internal portal.
 * Accessible to admin role only.
 *
 * Sections:
 *  - Categories / Subcategories (portfolio images)
 *  - Testimonials
 *  - Inquiries (contact form submissions from the public site)
 *
 * All API calls go through the existing `api` instance (Axios + JWT token)
 * to the /api/* endpoints — same backend, admin-gated.
 */

const AdminView = () => {
  const [data, setData]             = useState({ categories: [], inquiries: [], testimonials: [] });
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [view, setView]             = useState('categories'); // 'categories' | 'testimonials' | 'inquiries'
  const [modal, setModal]           = useState({ show: false, type: '', data: null });
  const [testimonialModal, setTestimonialModal] = useState({
    show: false, mode: 'add', data: { author: '', company: '', text: '' },
  });
  const [subModal, setSubModal] = useState({
    show: false, mode: 'add', data: { name: '' },
  });
  const [uploading, setUploading]       = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // ── Data loading ─────────────────────────────────────────────────────────────
  const refreshData = async () => {
    try {
      setError('');
      const res = await psApi.get('/store');
      setData(res.data);
      if (selectedCat) {
        const updated = res.data.categories.find(c => c.id === selectedCat.id);
        setSelectedCat(updated || null);
        if (selectedSub && updated) {
          const updatedSub = updated.subcategories?.find(s => s.id === selectedSub.id);
          setSelectedSub(updatedSub || null);
        }
      }
    } catch (err) {
      setError('Failed to load store data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, []);

  // ── Categories ────────────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    const name = prompt('Enter New Collection Name:');
    if (!name?.trim()) return;
    try {
      await psApi.post('/categories', { name });
      refreshData();
    } catch (err) { alert('Failed: ' + err.response?.data?.message); }
  };

  // ── Subcategories ─────────────────────────────────────────────────────────────
  const openSubModal  = (mode, sub = null) => setSubModal({ show: true, mode, data: sub ? { ...sub } : { name: '' } });

  const submitSubcategory = async () => {
    if (!subModal.data.name?.trim()) return;
    try {
      if (subModal.mode === 'add') {
        await psApi.post(`/categories/${selectedCat.id}/subcategories`, { name: subModal.data.name });
      } else {
        await psApi.put(`/categories/${selectedCat.id}/subcategories/${subModal.data.id}`, { name: subModal.data.name });
      }
      setSubModal({ show: false, mode: 'add', data: { name: '' } });
      refreshData();
    } catch (err) { console.error('Subcategory error', err); }
  };

  // ── Testimonials ──────────────────────────────────────────────────────────────
  const openTestimonialModal = (mode, t = null) => {
    const tData = t
      ? { ...t, text: t.text || t.feedback || t.content || '' }
      : { author: '', company: '', text: '' };
    setTestimonialModal({ show: true, mode, data: tData });
  };

  const submitTestimonial = async () => {
    const { author, company, text, id } = testimonialModal.data;
    if (!author || !text) return;
    try {
      if (testimonialModal.mode === 'add') {
        await psApi.post('/testimonials', { author, company, text });
      } else {
        await psApi.put(`/testimonials/${id}`, { author, company, text });
      }
      setTestimonialModal({ show: false, mode: 'add', data: { author: '', company: '', text: '' } });
      refreshData();
    } catch (err) { console.error('Testimonial error', err); }
  };

  // ── Delete confirmation ───────────────────────────────────────────────────────
  const attemptDelete = (type, targetData) => setModal({ show: true, type, data: targetData });

  const confirmDelete = async () => {
    const { type, data: m } = modal;
    try {
      if (type === 'CAT')         await psApi.delete(`/categories/${m.id}`);
      if (type === 'SUB')         await psApi.delete(`/categories/${selectedCat.id}/subcategories/${m.id}`);
      if (type === 'TESTIMONIAL') await psApi.delete(`/testimonials/${m.id}`);
      if (type === 'INQUIRY')     await psApi.delete(`/inquiries/${m.id}`);
      if (type === 'IMG') {
        const url = (selectedSub && selectedSub.id !== 'generic')
          ? `/images/${selectedCat.id}/sub/${selectedSub.id}/${m.id}`
          : `/images/${selectedCat.id}/${m.id}`;
        await psApi.delete(url);
      }
      setModal({ show: false, type: '', data: null });
      refreshData();
    } catch (err) { console.error('Delete error', err); }
  };

  // ── Image upload ──────────────────────────────────────────────────────────────
  const handleUpload = async (e, catId, subId = null) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const urlPart = (subId && subId !== 'generic')
        ? `upload/${catId}/sub/${subId}`
        : `upload/${catId}`;
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        await psApi.post(`/${urlPart}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      refreshData();
    } catch (err) { console.error('Upload error', err); }
    finally { setUploading(false); e.target.value = null; }
  };

  const setAsCover = async (imgId) => {
    await psApi.put(`/categories/${selectedCat.id}/cover/${imgId}`);
    refreshData();
  };

  // ── Drag and drop reorder ─────────────────────────────────────────────────────
  const isGenericView = !selectedSub || selectedSub.id === 'generic';
  const currentImages = selectedSub?.id === 'generic'
    ? (selectedCat?.images || [])
    : (selectedSub?.images || selectedCat?.images || []);

  const onDragStart = (e, index, img) => {
    if (img.isCover && isGenericView) { e.preventDefault(); return; }
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const target = currentImages[index];
    if (target?.isCover && isGenericView) return;
    const items = [...currentImages];
    const dragged = items[draggedItemIndex];
    items.splice(draggedItemIndex, 1);
    items.splice(index, 0, dragged);
    setDraggedItemIndex(index);
    if (selectedSub?.id === 'generic' || !selectedSub) {
      setSelectedCat(prev => ({ ...prev, images: items }));
    } else {
      setSelectedSub(prev => ({ ...prev, images: items }));
    }
  };

  const onDragEnd = async () => {
    if (draggedItemIndex === null) return;
    setDraggedItemIndex(null);
    const imgIds = currentImages.map(img => img.id);
    const url = (selectedSub && selectedSub.id !== 'generic')
      ? `/reorder/${selectedCat.id}/sub/${selectedSub.id}`
      : `/reorder/${selectedCat.id}`;
    try {
      await psApi.put(url, { imageIds: imgIds });
      refreshData();
    } catch (err) { console.error('Reorder failed', err); }
  };

  // ── Mark inquiry as read ──────────────────────────────────────────────────────
  const markRead = async (id) => {
    await psApi.patch(`/inquiries/${id}/read`);
    refreshData();
  };

  const hasSubcategories = selectedCat?.subcategories?.length > 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-slate-400" size={24} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">

      {/* Delete Confirmation Modal */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-serif mb-3">Delete Item?</h2>
            <p className="text-slate-500 mb-8 text-sm">This action is permanent.</p>
            <div className="flex gap-4">
              <button onClick={() => setModal({ show: false })} className="flex-1 py-4 rounded-2xl font-bold bg-slate-100 hover:bg-slate-200">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-4 rounded-2xl font-bold bg-red-500 text-white shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Subcategory Modal */}
      {subModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative">
            <button onClick={() => setSubModal({ ...subModal, show: false })} className="absolute top-8 right-8 text-slate-400 hover:text-black"><X size={24} /></button>
            <h2 className="text-3xl font-serif mb-2">{subModal.mode === 'add' ? 'New Sub-folder' : 'Rename Sub-folder'}</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Group your portfolio assets</p>
            <div className="space-y-6">
              <input autoFocus type="text" value={subModal.data.name}
                onChange={e => setSubModal({ ...subModal, data: { ...subModal.data, name: e.target.value } })}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-black outline-none"
                placeholder="e.g. Premium Electronics" />
              <button onClick={submitSubcategory} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">
                {subModal.mode === 'add' ? 'Create Folder' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Testimonial Modal */}
      {testimonialModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative">
            <button onClick={() => setTestimonialModal({ ...testimonialModal, show: false })} className="absolute top-8 right-8 text-slate-400"><X size={24} /></button>
            <h2 className="text-3xl font-serif mb-8">{testimonialModal.mode === 'add' ? 'Add Testimonial' : 'Edit Testimonial'}</h2>
            <div className="space-y-4">
              <input value={testimonialModal.data.author}
                onChange={e => setTestimonialModal({ ...testimonialModal, data: { ...testimonialModal.data, author: e.target.value } })}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4" placeholder="Client Name" />
              <input value={testimonialModal.data.company}
                onChange={e => setTestimonialModal({ ...testimonialModal, data: { ...testimonialModal.data, company: e.target.value } })}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4" placeholder="Company" />
              <textarea rows="4" value={testimonialModal.data.text}
                onChange={e => setTestimonialModal({ ...testimonialModal, data: { ...testimonialModal.data, text: e.target.value } })}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 resize-none" placeholder="Feedback..." />
              <button onClick={submitTestimonial} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">
                {testimonialModal.mode === 'add' ? 'Add Testimonial' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-white border-r border-slate-100 p-8 flex flex-col gap-2 min-h-screen">
        <div className="mb-8">
          <h1 className="text-2xl font-serif tracking-tight">Public Site</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">www.marqland.com</p>
        </div>
        {[
          { key: 'categories',  label: 'Portfolio',    icon: Folder },
          { key: 'testimonials',label: 'Testimonials', icon: Mail },
          { key: 'inquiries',   label: 'Inquiries',    icon: User },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setView(key); setSelectedCat(null); setSelectedSub(null); }}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${view === key ? 'bg-black text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Icon size={16} /> {label}
            {key === 'inquiries' && data.inquiries?.filter(i => !i.read).length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                {data.inquiries.filter(i => !i.read).length}
              </span>
            )}
          </button>
        ))}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl">{error}</div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-10 overflow-auto">

        {/* ── PORTFOLIO ── */}
        {view === 'categories' && (
          <>
            <header className="flex justify-between items-end mb-10">
              {selectedCat ? (
                <div className="flex items-center gap-4">
                  <button onClick={() => { setSelectedCat(null); setSelectedSub(null); }}
                    className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors">
                    <ArrowLeft size={14} className="mr-2" /> All Collections
                  </button>
                  <span className="text-slate-200">/</span>
                  <h2 className="text-2xl font-serif">{selectedCat.name}</h2>
                </div>
              ) : (
                <div>
                  <h2 className="text-4xl font-serif">Portfolio Collections</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Visible on www.marqland.com</p>
                </div>
              )}
              {!selectedCat && (
                <button onClick={handleAddCategory} className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl flex items-center">
                  <Plus size={16} className="mr-2" /> New Collection
                </button>
              )}
            </header>

            {!selectedCat ? (
              /* Category grid */
              <div className="grid grid-cols-3 gap-6">
                {data.categories.map(cat => {
                  const cover = cat.images?.find(i => i.isCover) || cat.images?.[0];
                  return (
                    <div key={cat.id} className="relative group bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer h-64"
                      onClick={() => setSelectedCat(cat)}>
                      {cover ? (
                        <img src={`${IMAGE_BASE}${cover.url}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={cat.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
                          <LayoutGrid size={40} strokeWidth={1} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-10">
                        <div>
                          <h3 className="text-xl font-serif text-white">{cat.name}</h3>
                          <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mt-1">
                            {cat.images?.length || 0} images
                            {cat.subcategories?.length > 0 && ` · ${cat.subcategories.length} folders`}
                          </p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); attemptDelete('CAT', cat); }}
                          className="opacity-0 group-hover:opacity-100 p-2 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-red-500 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Category detail: sidebar + image grid */
              <div className="grid grid-cols-12 gap-6">
                {/* Subcategory list */}
                <div className="col-span-3">
                  <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Folders</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setSelectedSub({ id: 'generic', name: 'Generic Assets' })}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${selectedSub?.id === 'generic' || !selectedSub ? 'bg-black text-white' : 'hover:bg-slate-50 text-slate-600'}`}>
                        <Folder size={14} /> {hasSubcategories ? 'Generic Assets' : 'All Media'}
                      </button>
                      {(selectedCat.subcategories || []).map(sub => (
                        <div key={sub.id} className="relative group/sub">
                          <button
                            onClick={() => setSelectedSub(sub)}
                            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${selectedSub?.id === sub.id ? 'bg-black text-white' : 'hover:bg-slate-50 text-slate-600'}`}>
                            <Folder size={14} /> {sub.name}
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-all">
                            <button onClick={() => openSubModal('edit', sub)} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-black hover:text-white transition-all"><Edit3 size={12} /></button>
                            <button onClick={() => attemptDelete('SUB', sub)} className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => openSubModal('add')} className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl flex items-center justify-center text-[10px] font-black uppercase hover:border-black hover:text-black transition-all">
                        <Plus size={14} className="mr-2" /> New Sub-folder
                      </button>
                    </div>
                  </div>
                </div>

                {/* Image grid */}
                <div className="col-span-9">
                  <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[600px]">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="text-xl font-serif">{selectedSub?.name || (hasSubcategories ? 'Generic Assets' : 'All Media')}</h3>
                      <label className={`cursor-pointer px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center transition-all ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-black text-white shadow-xl hover:-translate-y-0.5'}`}>
                        {uploading ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Upload size={14} className="mr-2" />}
                        {uploading ? 'Processing...' : 'Upload Media'}
                        <input type="file" multiple className="hidden" disabled={uploading}
                          onChange={e => handleUpload(e, selectedCat.id, selectedSub?.id)} />
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      {currentImages.map((img, idx) => {
                        const canDrag = !(img.isCover && isGenericView);
                        return (
                          <div key={img.id} draggable={canDrag}
                            onDragStart={e => onDragStart(e, idx, img)}
                            onDragOver={e => onDragOver(e, idx)}
                            onDragEnd={onDragEnd}
                            className={`relative group aspect-square rounded-[2rem] overflow-hidden border-4 transition-all ${img.isCover && isGenericView ? 'border-black shadow-lg z-10 cursor-default' : 'border-transparent cursor-move'}`}>
                            <img src={`${IMAGE_BASE}${img.url}`} className="w-full h-full object-cover" alt="asset" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center pointer-events-none">
                              {canDrag && <GripVertical className="text-white opacity-50" size={24} />}
                              {isGenericView && !img.isCover && (
                                <button onClick={e => { e.stopPropagation(); setAsCover(img.id); }}
                                  className="mt-4 pointer-events-auto px-4 py-2 bg-white text-black text-[10px] font-bold uppercase rounded-lg shadow-xl">
                                  Set As Cover
                                </button>
                              )}
                            </div>
                            {img.isCover && isGenericView && (
                              <div className="absolute top-4 left-4 bg-black text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg z-20">
                                Collection Cover
                              </div>
                            )}
                            <button onClick={e => { e.stopPropagation(); attemptDelete('IMG', img); }}
                              className="absolute bottom-4 right-4 p-2 bg-white/90 backdrop-blur-md text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm z-20">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                      {currentImages.length === 0 && (
                        <div className="col-span-3 h-48 border-4 border-dashed border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 font-serif italic">
                          No images yet — upload some above
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TESTIMONIALS ── */}
        {view === 'testimonials' && (
          <div className="max-w-5xl mx-auto">
            <header className="flex justify-between items-end mb-12">
              <div><h2 className="text-4xl font-serif">Testimonials</h2></div>
              <button onClick={() => openTestimonialModal('add')}
                className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl flex items-center">
                <Plus size={16} className="mr-2" /> Add New
              </button>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {data.testimonials.map(t => (
                <div key={t.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative group transition-all">
                  <p className="text-slate-600 italic mb-8 relative z-10 min-h-[80px]">"{t.feedback || t.text || t.content}"</p>
                  <div className="flex justify-between items-end border-t pt-6">
                    <div>
                      <p className="font-bold text-sm">{t.author}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{t.company}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => openTestimonialModal('edit', t)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-black hover:text-white transition-all"><Edit3 size={16} /></button>
                      <button onClick={() => attemptDelete('TESTIMONIAL', t)} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {data.testimonials.length === 0 && (
                <div className="col-span-2 h-48 border-4 border-dashed border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 font-serif italic">
                  No testimonials yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INQUIRIES ── */}
        {view === 'inquiries' && (
          <div className="max-w-6xl mx-auto">
            <header className="mb-12">
              <h2 className="text-4xl font-serif">Public Inquiries</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Contact form submissions from www.marqland.com</p>
            </header>
            <div className="grid grid-cols-1 gap-6">
              {data.inquiries?.length > 0 ? data.inquiries.map(inq => (
                <div key={inq.id}
                  className={`bg-white p-8 rounded-[2.5rem] shadow-sm border group relative transition-all ${!inq.read ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
                  {!inq.read && (
                    <span className="absolute top-6 right-20 bg-indigo-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider">New</span>
                  )}
                  <div className="grid grid-cols-12 gap-6 items-start">
                    <div className="col-span-4 space-y-3">
                      <div className="flex items-center text-sm font-bold"><User size={14} className="mr-3 text-slate-400" /> {inq.name}</div>
                      {inq.company && <div className="flex items-center text-sm text-slate-500 font-medium"><Mail size={14} className="mr-3 text-slate-400" /> {inq.company}</div>}
                      <div className="flex items-center text-sm text-slate-500"><Mail size={14} className="mr-3 text-slate-400" /> {inq.email}</div>
                      {inq.phone && <div className="flex items-center text-sm text-slate-500"><Phone size={14} className="mr-3 text-slate-400" /> {inq.phone}</div>}
                      {inq.hearAbout && (
                        <div className="flex items-start gap-3 text-sm text-slate-500">
                          <span className="mt-0.5 text-slate-400 text-xs">◎</span>
                          <span><span className="font-semibold text-slate-400 uppercase tracking-widest text-[9px]">Heard via </span>{inq.hearAbout}</span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-7">
                      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{inq.message}</p>
                    </div>
                    <div className="col-span-1 flex flex-col gap-2 justify-end">
                      {!inq.read && (
                        <button onClick={() => markRead(inq.id)}
                          className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-xl transition-all" title="Mark as read">
                          ✓
                        </button>
                      )}
                      <button onClick={() => attemptDelete('INQUIRY', inq)}
                        className="p-2 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Received: {new Date(inq.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              )) : (
                <div className="h-64 border-4 border-dashed border-slate-100 rounded-[3rem] flex items-center justify-center text-slate-300 font-serif italic">
                  No inquiries received yet.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminView;