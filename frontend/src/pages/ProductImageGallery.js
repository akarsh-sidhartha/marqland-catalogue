/**
 * components/ProductImageGallery.jsx
 *
 * Self-contained modal for:
 *   1. Running a Serper reverse image search for a product
 *   2. Previewing candidate images in a grid
 *   3. Selecting images and saving (downloading) them to the server
 *   4. Managing the saved gallery (reorder primary, delete)
 *   5. Saving a product video URL (YouTube or brand link)
 *
 * Usage:
 *   <ProductImageGallery product={product} onClose={() => …} onSaved={() => refetch()} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
  X, Search, Download, Trash2, Star, Video, Link2, Loader2,
  CheckSquare, Square, RefreshCw, ExternalLink, Play, Image, ChevronLeft, ChevronRight, Upload, Plus
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
};

const isYouTube = (url) => Boolean(getYouTubeId(url));

// ── Sub-components ────────────────────────────────────────────────────────────

/** Thumbnail card in the search results grid */
const SearchResultCard = ({ img, selected, onToggle }) => (
  <div
    onClick={onToggle}
    className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all group
      ${selected ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-transparent hover:border-indigo-200'}`}
    style={{ aspectRatio: '1/1' }}
  >
    <img
      src={img.thumbnail}
      alt={img.title}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text y="55" x="50" text-anchor="middle" font-size="28" fill="%23d1d5db">?</text></svg>'; }}
    />

    {/* Selection overlay */}
    <div className={`absolute inset-0 transition-all
      ${selected ? 'bg-indigo-600/20' : 'bg-transparent group-hover:bg-black/10'}`} />

    {/* Checkbox */}
    <div className={`absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center transition-all
      ${selected ? 'bg-indigo-600 text-white' : 'bg-white/80 text-gray-400 group-hover:bg-white'}`}>
      {selected ? <CheckSquare size={13} /> : <Square size={13} />}
    </div>

    {/* Source badge */}
    {img.source && (
      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-all">
        <p className="text-[9px] text-white/80 truncate font-medium">{img.source}</p>
      </div>
    )}
  </div>
);

/** Saved gallery image card */
const GalleryCard = ({ url, index, isPrimary, onSetPrimary, onDelete, baseUrl }) => {
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-100 group" style={{ aspectRatio: '1/1' }}>
      <img src={fullUrl} alt="" className="w-full h-full object-cover" />

      {isPrimary && (
        <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
          <Star size={9} fill="currentColor" /> Primary
        </div>
      )}

      {/* Action bar */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all">
        {!isPrimary && (
          <button
            onClick={onSetPrimary}
            title="Set as primary image"
            className="text-amber-300 hover:text-amber-200 flex items-center gap-1 text-[10px] font-bold"
          >
            <Star size={12} /> Primary
          </button>
        )}
        <button
          onClick={onDelete}
          title="Remove"
          className="ml-auto text-red-300 hover:text-red-200"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const ProductImageGallery = ({ product, onClose, onSaved }) => {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin.replace(':3000', ':5000') // dev: adjust for your backend port
    : '';

  // ── Tab state ──
  const [tab, setTab] = useState('gallery'); // 'gallery' | 'search' | 'video'

  // ── Gallery state ──
  const [gallery, setGallery] = useState(product.additionalImages || []);
  const [primaryUrl, setPrimaryUrl] = useState(product.imageUrl || '');

  // ── Search state ──
  const [query, setQuery]           = useState(`${product.brand || ''} ${product.name || ''}`.trim());
  const [searching, setSearching]   = useState(false);
  const [searchResults, setResults] = useState([]);
  const [selected, setSelected]     = useState(new Set());
  const [saving, setSaving]         = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { saved, failed }
  const [searchError, setSearchError] = useState(null);

  // ── Video state ──
  const [videoUrl, setVideoUrl]     = useState(product.videoUrl || '');
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoSaved, setVideoSaved] = useState(false);

  // ── Direct upload ──
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // ── Lightbox ──
  const [lightbox, setLightbox]     = useState(null); // url string

  // Reload gallery from server
  const refreshProduct = useCallback(async () => {
    try {
      const res = await api.get(`/products/${product._id}`);
      setGallery(res.data.additionalImages || []);
      setPrimaryUrl(res.data.imageUrl || '');
      setVideoUrl(res.data.videoUrl || '');
    } catch {}
  }, [product._id]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    setSaveResult(null);
    setSearchError(null);
    try {
      const res = await api.post(`/products/${product._id}/image-search`, { query: query.trim() });
      setResults(res.data.results || []);
    } catch (err) {
      setSearchError(err.response?.data?.message || err.message);
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (idx) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  const selectAll = () => {
    setSelected(new Set(searchResults.map((_, i) => i)));
  };

  // ── Save selected images ──────────────────────────────────────────────────
  const handleSaveSelected = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const urls = [...selected].map(i => searchResults[i].url);
      const res = await api.post(`/products/${product._id}/save-images`, { urls });
      setSaveResult(res.data);
      setSelected(new Set());
      await refreshProduct();
      onSaved?.();
    } catch (err) {
      setSaveResult({ error: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Gallery management ────────────────────────────────────────────────────
  const handleSetPrimary = async (index) => {
    try {
      const res = await api.put(`/products/${product._id}/primary-image/${index}`);
      setGallery(res.data.additionalImages || []);
      setPrimaryUrl(res.data.imageUrl || '');
      onSaved?.();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteGalleryImage = async (index) => {
    if (!window.confirm('Remove this image?')) return;
    try {
      const res = await api.delete(`/products/${product._id}/images/${index}`);
      setGallery(res.data.additionalImages || []);
      onSaved?.();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // ── Video ─────────────────────────────────────────────────────────────────
  const handleSaveVideo = async () => {
    setSavingVideo(true);
    setVideoSaved(false);
    try {
      await api.put(`/products/${product._id}/video`, { videoUrl: videoUrl.trim() });
      setVideoSaved(true);
      onSaved?.();
      setTimeout(() => setVideoSaved(false), 2000);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingVideo(false);
    }
  };

  // ── Direct upload ────────────────────────────────────────────────────────────
  const handleDirectUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('images', f));
      const res = await api.post(`/products/${product._id}/upload-images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshProduct();
      onSaved?.();
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') { lightbox ? setLightbox(null) : onClose(); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lightbox, onClose]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-6"
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/60 hover:text-white bg-black/40 rounded-full p-2"
          >
            <X size={20} />
          </button>
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Modal */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-3xl rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

          {/* ── Header ───────────────────────────────────────────────────────── */}
          <div className="p-5 border-b flex justify-between items-start flex-shrink-0">
            <div>
              <h2 className="text-base font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                <Image size={16} className="text-indigo-500" />
                Image Gallery & Video
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 truncate max-w-xs">
                {product.name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* ── Tab bar ──────────────────────────────────────────────────────── */}
          <div className="flex border-b flex-shrink-0">
            {[
              { id: 'gallery', label: `Gallery (${gallery.length})`, icon: <Image size={12} /> },
              { id: 'search',  label: 'Find Images',                  icon: <Search size={12} /> },
              { id: 'video',   label: 'Video',                        icon: <Play size={12} /> },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all
                  ${tab === t.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── Body ─────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ════ GALLERY TAB ════ */}
            {tab === 'gallery' && (
              <div className="p-5 space-y-5">

                {/* Primary image */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    Primary Image
                  </p>
                  {primaryUrl ? (
                    <div className="flex gap-4 items-start">
                      <div
                        className="relative rounded-xl overflow-hidden border-2 border-amber-300 cursor-pointer flex-shrink-0"
                        style={{ width: 120, height: 120 }}
                        onClick={() => setLightbox(primaryUrl.startsWith('http') ? primaryUrl : `${baseUrl}${primaryUrl}`)}
                      >
                        <img
                          src={primaryUrl.startsWith('http') ? primaryUrl : `${baseUrl}${primaryUrl}`}
                          alt="Primary"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 left-1 bg-amber-400 text-amber-900 text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star size={8} fill="currentColor" /> Main
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        This is the main image shown everywhere. Click any gallery image below to promote it to primary.
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300 italic">No primary image set.</div>
                  )}
                </div>

                {/* Additional images */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Additional Angles ({gallery.length})
                    </p>
                    {/* Quick upload button */}
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all
                      ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                      {uploading
                        ? <><Loader2 size={11} className="animate-spin" /> Uploading…</>
                        : <><Upload size={11} /> Upload Images</>}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploading}
                        onChange={e => handleDirectUpload(e.target.files)}
                      />
                    </label>
                  </div>

                  {/* Upload error */}
                  {uploadError && (
                    <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-600 font-bold">
                      {uploadError}
                    </div>
                  )}

                  {/* Drop zone — visible when gallery is empty */}
                  {gallery.length === 0 && !uploading ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl py-10 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group">
                      <Upload size={28} className="text-indigo-300 group-hover:text-indigo-400 mb-2 transition-colors" />
                      <p className="text-sm font-bold text-gray-400 group-hover:text-indigo-500 transition-colors">Drop images here or click to upload</p>
                      <p className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP — multiple files supported</p>
                      <p className="text-xs text-gray-300 mt-1">or use the <span className="text-indigo-400 font-bold">Find Images</span> tab to search online</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => handleDirectUpload(e.target.files)}
                      />
                    </label>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {gallery.map((url, idx) => (
                        <GalleryCard
                          key={idx}
                          url={url}
                          index={idx}
                          isPrimary={false}
                          baseUrl={baseUrl}
                          onSetPrimary={() => handleSetPrimary(idx)}
                          onDelete={() => handleDeleteGalleryImage(idx)}
                        />
                      ))}
                      {/* Add more — always-visible upload tile */}
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group" style={{ aspectRatio: '1/1' }}>
                        <Plus size={20} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                        <span className="text-[9px] text-gray-300 group-hover:text-indigo-400 font-bold mt-1 uppercase">Add</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => handleDirectUpload(e.target.files)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ SEARCH TAB ════ */}
            {tab === 'search' && (
              <div className="p-5 space-y-4">

                {/* Search bar */}
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. Fantech MK855 mechanical keyboard"
                    className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-indigo-300"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !query.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-40 flex-shrink-0"
                  >
                    {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    Search
                  </button>
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Searches Google Images via Serper for "{product.brand} {product.name}". Select the best angles and click <strong>Save Selected</strong> to download them to your server.
                </p>

                {/* Error */}
                {searchError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-bold">
                    {searchError}
                  </div>
                )}

                {/* Save result banner */}
                {saveResult && !saveResult.error && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                    <Download size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-green-700 font-bold">
                      {saveResult.saved?.length || 0} images saved to server.
                      {saveResult.failed?.length > 0 && (
                        <span className="text-orange-500 ml-2">{saveResult.failed.length} failed.</span>
                      )}
                    </div>
                  </div>
                )}
                {saveResult?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-bold">
                    Save failed: {saveResult.error}
                  </div>
                )}

                {/* Results grid */}
                {searching && (
                  <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-sm font-bold">Searching Google Images…</span>
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <>
                    {/* Select all / count */}
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500 font-bold">
                        {searchResults.length} results · {selected.size} selected
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAll}
                          className="text-xs text-indigo-500 font-black uppercase hover:text-indigo-700"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelected(new Set())}
                          className="text-xs text-gray-400 font-black uppercase hover:text-gray-600"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2.5">
                      {searchResults.map((img, idx) => (
                        <SearchResultCard
                          key={idx}
                          img={img}
                          selected={selected.has(idx)}
                          onToggle={() => toggleSelect(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {!searching && searchResults.length === 0 && !searchError && (
                  <div className="text-center py-16 text-gray-300">
                    <Search size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold text-gray-400">Search for product images above</p>
                  </div>
                )}
              </div>
            )}

            {/* ════ VIDEO TAB ════ */}
            {tab === 'video' && (
              <div className="p-5 space-y-5">

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Video URL
                  </label>
                  <input
                    value={videoUrl}
                    onChange={e => { setVideoUrl(e.target.value); setVideoSaved(false); }}
                    placeholder="https://youtube.com/watch?v=… or brand video URL"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ring-indigo-300"
                  />
                  <p className="text-[10px] text-gray-400">
                    Accepts YouTube links, YouTube Shorts, or any direct video URL. The video will be embedded in the client portal card.
                  </p>
                </div>

                {/* Preview */}
                {videoUrl && isYouTube(videoUrl) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Preview</p>
                    <div className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${getYouTubeId(videoUrl)}?rel=0`}
                        title="Product video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    </div>
                  </div>
                )}

                {videoUrl && !isYouTube(videoUrl) && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2">
                    <Link2 size={13} className="text-indigo-400 flex-shrink-0" />
                    <span className="text-xs text-indigo-600 font-bold truncate">{videoUrl}</span>
                    <a href={videoUrl} target="_blank" rel="noreferrer" className="ml-auto flex-shrink-0">
                      <ExternalLink size={12} className="text-indigo-400 hover:text-indigo-600" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────────── */}
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center flex-shrink-0">
            <button
              onClick={onClose}
              className="text-xs font-black uppercase text-gray-400 tracking-widest hover:text-gray-600"
            >
              Close
            </button>

            {tab === 'search' && selected.size > 0 && (
              <button
                onClick={handleSaveSelected}
                disabled={saving}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-40 shadow-md"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                Save {selected.size} Image{selected.size !== 1 ? 's' : ''}
              </button>
            )}

            {tab === 'video' && (
              <button
                onClick={handleSaveVideo}
                disabled={savingVideo}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-md
                  ${videoSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:opacity-40`}
              >
                {savingVideo
                  ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                  : videoSaved
                    ? <><span>✓</span> Saved!</>
                    : <><Video size={12} /> Save Video URL</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductImageGallery;