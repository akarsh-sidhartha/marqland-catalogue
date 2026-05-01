import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import {
  Plus, Check, FolderPlus, X, ChevronDown, Search, Trash2, Pencil,
  RotateCcw, Info, CheckSquare, Square, Sparkles, FileText, Download,
  ImageIcon, AlertCircle, CheckCircle2, Loader2, Star, Images,
} from 'lucide-react';
import usePortalItems from '../hooks/usePortalItems';
import ProductImageGallery from './ProductImageGallery'; // ← NEW: multi-image gallery + video
import { usePopup } from '../components/AppPopups';

// ─────────────────────────────────────────────────────────────────────────────
// Custom Creatable Select
// ─────────────────────────────────────────────────────────────────────────────
const CustomCreatableSelect = ({ options, value, onChange, placeholder, isDisabled, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => { onChange({ value: val, label: val }); setIsOpen(false); setInputValue(''); };
  const handleCreate = () => { if (inputValue.trim()) { onChange({ value: inputValue, label: inputValue }); setIsOpen(false); setInputValue(''); } };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">{label}</label>
      <div
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        className={`w-full border rounded-lg p-2 flex items-center justify-between cursor-pointer bg-white ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-indigo-300'}`}
      >
        <span className="text-sm truncate">{value ? value.label : (placeholder || 'Select...')}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute z-[150] w-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto">
          <div className="p-2 border-b sticky top-0 bg-white">
            <input
              autoFocus
              className="w-full p-2 text-xs border rounded-md outline-none focus:ring-1 ring-indigo-500"
              placeholder="Search or type new..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>
          {options.filter(o => o.label.toLowerCase().includes(inputValue.toLowerCase())).map((opt, idx) => (
            <div key={idx} onClick={() => handleSelect(opt.value)} className="p-2 text-xs hover:bg-indigo-50 cursor-pointer">{opt.label}</div>
          ))}
          {inputValue && !options.some(o => o.label.toLowerCase() === inputValue.toLowerCase()) && (
            <div onClick={handleCreate} className="p-2 text-xs text-indigo-600 font-bold hover:bg-indigo-50 cursor-pointer border-t">
              Create "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Selector (used inside Add Product modal)
// ─────────────────────────────────────────────────────────────────────────────
const PromptSelector = ({ prompts, category, selectedId, onSelect, customText, onCustom, onOpenManager }) => {
  const filtered = prompts.filter(p => !category || p.category === category || p.category === 'All');
  return (
    <div className="space-y-2">
      {filtered.length > 0 && (
        <div>
          <label className="block text-[9px] font-black text-purple-500 uppercase mb-1">Studio Prompt</label>
          <select
            value={selectedId}
            onChange={e => { onSelect(e.target.value); onCustom(''); }}
            className="w-full border border-purple-200 rounded-lg p-1.5 text-[10px] bg-white"
          >
            <option value="">— use category default —</option>
            {filtered.map(p => (
              <option key={p._id} value={p._id}>{p.name}{p.isDefault ? ' ★' : ''}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-[9px] font-black text-purple-500 uppercase mb-1">Custom Prompt Override</label>
        <textarea
          rows={2}
          value={customText}
          onChange={e => { onCustom(e.target.value); onSelect(''); }}
          placeholder="Optional — leave blank to use saved prompt above…"
          className="w-full border border-purple-200 rounded-lg p-2 text-[10px] bg-white resize-none placeholder:text-purple-200"
        />
      </div>
      {onOpenManager && (
        <button
          type="button"
          onClick={onOpenManager}
          className="text-[9px] font-black text-purple-500 uppercase tracking-widest hover:text-purple-700 flex items-center gap-1"
        >
          <Sparkles size={9} /> Manage Studio Prompts
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Product card image with skeleton loader
// ─────────────────────────────────────────────────────────────────────────────
const ProductImage = ({ p, getAssetUrl, onPreview }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="h-32 bg-gray-100 flex items-center justify-center relative overflow-hidden cursor-zoom-in group/img"
      onClick={onPreview}
    >
      {/* Shimmer skeleton shown until image loads */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
      )}
      {p.imageUrl ? (
        <img
          src={getAssetUrl(p.imageUrl)}
          alt={p.name}
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-300 group-hover/img:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-gray-300">
          <ImageIcon size={24} />
          <span className="text-[9px] font-bold uppercase">No Image</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
        <Info size={20} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification — now sourced from AppPopups.jsx
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ProductList = () => {
  const [products, setProducts]           = useState([]);
  const [meta, setMeta]                   = useState({ brands: [], categories: [], subCategories: {} });
  const [availableSubCats, setAvailableSubCats] = useState([]);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [previewProduct, setPreviewProduct]   = useState(null);
  const [showCatalogueModal, setShowCatalogueModal] = useState(false);
  const [savedCatalogues, setSavedCatalogues] = useState([]);
  const [isUpdatingCatalogue, setIsUpdatingCatalogue] = useState(false);
  const { addToPortal, PortalModal } = usePortalItems('product');
  const [filters, setFilters] = useState({ brand: '', category: '', subCategory: '', minPrice: '', maxPrice: '', searchTerm: '' });

  // ── Add / Edit Product modal ──
  const [showModal, setShowModal]     = useState(false);
  const [isEditing, setIsEditing]     = useState(false);
  const [currentId, setCurrentId]     = useState(null);
  const [formData, setFormData] = useState({
    brand: '', category: '', subCategory: '', name: '',
    description: '', purchasePrice: '', markupPercent: 30
  });
  const [imageFile, setImageFile]         = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // original image local preview
  const [processImage, setProcessImage]   = useState(true);
  const [selectedPromptId, setPromptId]   = useState('');
  const [customPromptText, setCustomPrompt] = useState('');
  const [savedPrompts, setSavedPrompts]   = useState([]);

  // ── AI processing result within Add Product flow ──
  const [aiProcessing, setAiProcessing]   = useState(false);  // loading spinner
  const [aiError, setAiError]             = useState(null);   // error message
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null); // base64 data URL from server
  const [useGeneratedImage, setUseGeneratedImage] = useState(false); // toggle: keep AI or original
  const [showCompareModal, setShowCompareModal] = useState(false); // fullscreen compare lightbox

  // ── Separate Prompt Manager modal ──
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [promptForm, setPromptForm]   = useState({ name: '', category: '', prompt: '', isDefault: false });
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [promptSaving, setPromptSaving] = useState(false);

  // ── PDF Import modal ──
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFile, setPdfFile]           = useState(null);
  const [pdfCategory, setPdfCategory]   = useState('');
  const [pdfBrand, setPdfBrand]         = useState('');
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [pdfResult, setPdfResult]       = useState(null);
  const [pdfPromptId, setPdfPromptId]   = useState('');
  const [pdfCustomPrompt, setPdfCustomPrompt] = useState('');
  const [pdfProgress, setPdfProgress]   = useState(null); // e.g. "3 / 8 saved"

  // ── PDF Extract (raw, no AI) ──
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractFile, setExtractFile]   = useState(null);
  const [extractLoading, setExtractLoading] = useState(false);

  // ── Image Gallery & Video modal ──────────────────────────────────────────────
  const [galleryProduct, setGalleryProduct] = useState(null); // product object or null

  // ── Popups: toast + confirm dialog (themed, from AppPopups) ─────────────────
  const { showToast, confirm, Toast, ConfirmDialog } = usePopup();

  // ── Save loading state ───────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  const getAssetUrl = (p) => p;

  // ─── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([api.get('/products'), api.get('/products/meta')]);
      setProducts(pRes.data || []);
      const metaData = mRes.data || { brands: [], categories: [], subCategories: {} };
      if (metaData.subCategoryMap && !metaData.subCategories) metaData.subCategories = metaData.subCategoryMap;
      setMeta(metaData);
    } catch (err) { console.error('Error fetching data:', err); }
  }, []);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await api.get('/image-processing/prompts');
      setSavedPrompts(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchPrompts(); }, [fetchData, fetchPrompts]);

  // ─── Reset helpers ──────────────────────────────────────────────────────────
  const resetFilters = () => setFilters({ brand: '', category: '', subCategory: '', minPrice: '', maxPrice: '', searchTerm: '' });

  const resetForm = () => {
    setFormData({ brand: '', category: '', subCategory: '', name: '', description: '', purchasePrice: '', markupPercent: 30 });
    setImageFile(null);
    setImagePreviewUrl(null);
    setIsEditing(false);
    setCurrentId(null);
    setAvailableSubCats([]);
    setProcessImage(true);
    setPromptId('');
    setCustomPrompt('');
    setGeneratedImageUrl(null);
    setUseGeneratedImage(false);
    setAiProcessing(false);
    setAiError(null);
  };

  const resetPromptManager = () => {
    setEditingPromptId(null);
    setPromptForm({ name: '', category: '', prompt: '', isDefault: false });
  };

  // ─── Image file selection ───────────────────────────────────────────────────
  const handleImageFileChange = (file) => {
    setImageFile(file);
    setGeneratedImageUrl(null);
    setUseGeneratedImage(false);
    setAiError(null);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  };

  // ─── AI: Generate studio image (called manually from within Add Product) ────
  const handleGenerateStudio = async () => {
    if (!imageFile) return;
    setAiProcessing(true);
    setAiError(null);
    setGeneratedImageUrl(null);
    setUseGeneratedImage(false);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      if (selectedPromptId) fd.append('promptId', selectedPromptId);
      if (customPromptText) fd.append('promptText', customPromptText);
      if (formData.category) fd.append('category', formData.category);
      // Call a dedicated preview endpoint that returns the processed image as base64
      const res = await api.post('/image-processing/preview', fd);
      // Expect: { imageDataUrl: 'data:image/webp;base64,...' }
      setGeneratedImageUrl(res.data.imageDataUrl);
      setUseGeneratedImage(true); // default to keeping the generated image
    } catch (err) {
      setAiError(err.response?.data?.message || err.message || 'AI processing failed');
    } finally {
      setAiProcessing(false);
    }
  };

  // ─── Save product ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = new FormData();
      data.append('brand', formData.brand);
      data.append('category', formData.category);
      data.append('subCategory', formData.subCategory || '');
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('purchasePrice', formData.purchasePrice);
      data.append('markupPercent', formData.markupPercent);

      if (imageFile) {
        if (useGeneratedImage && generatedImageUrl) {
          // Convert base64 data URL → Blob → File and send it
          const res   = await fetch(generatedImageUrl);
          const blob  = await res.blob();
          const genFile = new File([blob], 'studio-processed.webp', { type: 'image/webp' });
          data.append('image', genFile);
          data.append('processImage', 'false'); // already processed; skip backend re-processing
        } else {
          data.append('image', imageFile);
          // If AI processing was toggled but user chose original, still respect processImage flag
          data.append('processImage', (processImage && !generatedImageUrl) ? 'true' : 'false');
          if (selectedPromptId) data.append('promptId', selectedPromptId);
          if (customPromptText) data.append('promptText', customPromptText);
        }
      }

      if (isEditing) {
        await api.put(`/products/${currentId}`, data);
        showToast('success', `"${formData.name}" updated successfully`);
      } else {
        await api.post('/products', data);
        showToast('success', `"${formData.name}" added to catalogue`);
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Save error:', err);
      showToast('error', err.response?.data?.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Prompt management ──────────────────────────────────────────────────────
  const savePrompt = async () => {
    if (!promptForm.name || !promptForm.category || !promptForm.prompt)
      return alert('Name, category and prompt are all required');
    setPromptSaving(true);
    try {
      if (editingPromptId) {
        await api.put(`/image-processing/prompts/${editingPromptId}`, promptForm);
      } else {
        await api.post('/image-processing/prompts', promptForm);
      }
      await fetchPrompts();
      resetPromptManager();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setPromptSaving(false);
    }
  };

  const deletePrompt = async (id) => {
    if (!window.confirm('Delete this prompt?')) return;
    try {
      await api.delete(`/image-processing/prompts/${id}`);
      await fetchPrompts();
    } catch (err) { alert('Delete failed: ' + err.message); }
  };

  const setDefaultPrompt = async (id) => {
    try {
      await api.patch(`/image-processing/prompts/${id}/default`);
      await fetchPrompts();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  // ─── PDF same-category import ───────────────────────────────────────────────
  const handlePdfImport = async () => {
    if (!pdfFile) return alert('Please select a PDF file');
    if (!pdfCategory || !pdfBrand) return alert('Category and brand are required');
    setPdfLoading(true);
    setPdfResult(null);
    setPdfProgress(null);
    try {
      const fd = new FormData();
      fd.append('pdf', pdfFile);
      fd.append('category', pdfCategory);
      fd.append('brand', pdfBrand);
      if (pdfPromptId) fd.append('promptId', pdfPromptId);
      if (pdfCustomPrompt) fd.append('promptText', pdfCustomPrompt);
      const res = await api.post('/image-processing/pdf/same-category', fd);
      setPdfResult({ count: res.data.productIds?.length || 0 });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      alert('PDF import failed: ' + msg);
    } finally {
      setPdfLoading(false);
      setPdfProgress(null);
    }
  };

  // ─── PDF extract raw images (no AI) ─────────────────────────────────────────
  const handleExtractImages = async () => {
    if (!extractFile) return alert('Please select a PDF file');
    setExtractLoading(true);
    try {
      const fd = new FormData();
      fd.append('pdf', extractFile);
      const res = await api.post('/image-processing/pdf/extract', fd, { responseType: 'arraybuffer' });

      // Decode error responses that come back as arraybuffer (axios won't throw for 2xx)
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('application/zip')) {
        let msg = 'Extraction failed — server did not return a ZIP file';
        try { msg = JSON.parse(new TextDecoder().decode(res.data)).message || msg; } catch {}
        throw new Error(msg);
      }

      const blob = new Blob([res.data], { type: 'application/zip' });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `pdf-images-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoke after a delay so the browser has time to start the download
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);

      setShowExtractModal(false);
      setExtractFile(null);
    } catch (err) {
      // err.response.data is an ArrayBuffer when responseType is arraybuffer
      let msg = err.message;
      if (err.response?.data instanceof ArrayBuffer) {
        try { msg = JSON.parse(new TextDecoder().decode(err.response.data)).message || msg; } catch {}
      }
      alert('Extraction failed: ' + msg);
    } finally {
      setExtractLoading(false);
    }
  };

  // ─── Other handlers ─────────────────────────────────────────────────────────
  const handleCategoryChange = (v) => {
    const selectedCat = v ? v.value : '';
    setFormData({ ...formData, category: selectedCat, subCategory: '' });
    const subCats = (meta.subCategories && meta.subCategories[selectedCat]) || [];
    setAvailableSubCats(subCats.map(s => ({ label: s, value: s })));
  };

  const calculateSellingPrice = (buy, mark) => {
    const price = parseFloat(buy || 0);
    const markup = parseFloat(mark || 0);
    return (price + (price * markup / 100)).toFixed(0);
  };

  const toggleCategory = (cat) => setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const toggleProductSelection = (product) => {
    const isSelected = selectedProducts.find(p => p._id === product._id);
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => p._id !== product._id));
    } else {
      setSelectedProducts([...selectedProducts, {
        _id: product._id, name: product.name, imageUrl: product.imageUrl,
        description: product.description, category: product.category || '',
        subCategory: product.subCategory || '',
        price: calculateSellingPrice(product.purchasePrice, product.markupPercent)
      }]);
    }
  };

  const selectAllInCategory = (categoryProducts) => {
    const allSelected = categoryProducts.every(p => selectedProducts.some(sp => sp._id === p._id));
    if (allSelected) {
      const ids = categoryProducts.map(p => p._id);
      setSelectedProducts(selectedProducts.filter(sp => !ids.includes(sp._id)));
    } else {
      const newSel = [...selectedProducts];
      categoryProducts.forEach(p => {
        if (!newSel.some(sp => sp._id === p._id)) {
          newSel.push({
            _id: p._id, name: p.name, imageUrl: p.imageUrl,
            description: p.description, category: p.category || '',
            subCategory: p.subCategory || '',
            price: calculateSellingPrice(p.purchasePrice, p.markupPercent)
          });
        }
      });
      setSelectedProducts(newSel);
    }
  };

  const handleOpenBuilder = () => {
    const data = selectedProducts.map(p => ({ _id: p._id, name: p.name, imageUrl: p.imageUrl, description: p.description, price: p.price }));
    localStorage.setItem('catalogue_selection', JSON.stringify(data));
    window.open('/builder', '_blank');
  };

  const openAddToExistingModal = async () => {
    setShowCatalogueModal(true);
    try {
      const res = await api.get('/catalogues');
      setSavedCatalogues(Array.isArray(res.data) ? res.data : []);
    } catch { setSavedCatalogues([]); }
  };

  const appendToCatalogue = async (targetCat) => {
    if (!targetCat || isUpdatingCatalogue) return;
    setIsUpdatingCatalogue(true);
    try {
      const newItems = selectedProducts.map(p => ({ name: p.name || 'Unnamed', description: p.description || '', price: p.price || 0, imageUrl: p.imageUrl || '' }));
      await api.post('/catalogues', { id: targetCat._id, name: targetCat.name, subtitle: targetCat.subtitle, items: [...(targetCat.items || []), ...newItems] });
      setSelectedProducts([]);
      setShowCatalogueModal(false);
    } catch (err) { console.error('Error updating catalogue:', err); }
    finally { setIsUpdatingCatalogue(false); }
  };

  const handleDelete = async (id, productName) => {
    const ok = await confirm({
      title        : 'Delete Product',
      message      : `"${productName}" will be permanently removed from your catalogue. This cannot be undone.`,
      confirmLabel : 'Delete',
      cancelLabel  : 'Cancel',
      variant      : 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/products/${id}`);
      fetchData();
      setSelectedProducts(prev => prev.filter(p => p._id !== id));
      showToast('success', `"${productName}" deleted`);
    }
    catch (err) {
      console.error('Delete error:', err);
      showToast('error', err.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleEditClick = (p) => {
    setIsEditing(true);
    setCurrentId(p._id);
    setFormData({ brand: p.brand || '', category: p.category || '', subCategory: p.subCategory || '', name: p.name || '', description: p.description || '', purchasePrice: p.purchasePrice || '', markupPercent: p.markupPercent || 30 });
    const subCats = (meta.subCategories && p.category && meta.subCategories[p.category]) || [];
    setAvailableSubCats(subCats.map(s => ({ label: s, value: s })));
    setShowModal(true);
  };

  const filteredProducts = products.filter(p => {
    const sPrice = parseFloat(calculateSellingPrice(p.purchasePrice, p.markupPercent));
    const min = filters.minPrice === '' ? 0 : parseFloat(filters.minPrice);
    const max = filters.maxPrice === '' ? Infinity : parseFloat(filters.maxPrice);
    const s = filters.searchTerm.toLowerCase();
    return (
      (p.name?.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s)) &&
      (filters.brand === '' || p.brand === filters.brand) &&
      (filters.category === '' || p.category === filters.category) &&
      (filters.subCategory === '' || p.subCategory === filters.subCategory) &&
      sPrice >= min && sPrice <= max
    );
  });

  const groupedProducts = filteredProducts.reduce((acc, p) => {
    const cat = p.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto p-4 pb-28 min-h-screen bg-gray-50/50">
      <Toast />
      <ConfirmDialog />

      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-40 bg-gray-50/50 pb-2">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center gap-3 overflow-x-auto no-scrollbar">

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-r pr-3 border-gray-100 flex-shrink-0">
            <h1 className="text-xs font-black text-indigo-600 uppercase tracking-tighter">Catalogue</h1>

            {/* Add Product */}
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              title="Add Product"
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-8 h-8 rounded-lg shadow-sm flex items-center justify-center transition flex-shrink-0"
            >
              <Plus size={18} />
            </button>

            {/* Extract PDF Images (raw download, no AI) */}
            <button
              onClick={() => { setExtractFile(null); setShowExtractModal(true); }}
              title="Extract Images from PDF"
              className="bg-amber-500 hover:bg-amber-600 text-white w-8 h-8 rounded-lg shadow-sm flex items-center justify-center transition flex-shrink-0"
            >
              <Download size={15} />
            </button>

            {/* Import from PDF (AI process + save) */}
            <button
              onClick={() => { setPdfFile(null); setPdfResult(null); setPdfProgress(null); setShowPdfModal(true); }}
              title="Import from PDF (AI Studio)"
              className="bg-purple-600 hover:bg-purple-700 text-white w-8 h-8 rounded-lg shadow-sm flex items-center justify-center transition flex-shrink-0"
            >
              <FileText size={15} />
            </button>

            {/* Studio Prompts Manager */}
            <button
              onClick={() => { resetPromptManager(); setShowPromptManager(true); }}
              title="Manage Studio Prompts"
              className="bg-violet-500 hover:bg-violet-600 text-white w-8 h-8 rounded-lg shadow-sm flex items-center justify-center transition flex-shrink-0"
            >
              <Sparkles size={15} />
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-shrink-0 w-32 md:w-40 lg:w-48">
            <input
              type="text" placeholder="Search..."
              className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-100 focus:border-indigo-300 outline-none text-xs bg-gray-50/50"
              value={filters.searchTerm}
              onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
            />
            <Search size={12} className="absolute left-2.5 top-2.5 text-gray-300" />
            {filters.searchTerm && (
              <button onClick={() => setFilters({ ...filters, searchTerm: '' })} className="absolute right-2 top-2.5 text-gray-300 hover:text-indigo-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-grow min-w-max">
            <select className="border border-gray-100 p-2 rounded-lg text-[10px] font-bold bg-white outline-none min-w-[90px]"
              value={filters.brand} onChange={e => setFilters({ ...filters, brand: e.target.value })}>
              <option value="">All Brands</option>
              {meta.brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="border border-gray-100 p-2 rounded-lg text-[10px] font-bold bg-white outline-none min-w-[100px]"
              value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value, subCategory: '' })}>
              <option value="">All Categories</option>
              {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select disabled={!filters.category}
              className={`border border-gray-100 p-2 rounded-lg text-[10px] font-bold outline-none min-w-[100px] transition-opacity ${!filters.category ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'bg-white'}`}
              value={filters.subCategory} onChange={e => setFilters({ ...filters, subCategory: e.target.value })}>
              <option value="">All Sub Cats</option>
              {filters.category && (meta.subCategories?.[filters.category])?.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button onClick={resetFilters} className="p-2 text-gray-300 hover:text-indigo-600 transition-colors flex-shrink-0" title="Reset Filters">
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Price range */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 flex-shrink-0 ml-auto">
            <span className="text-[9px] font-black text-gray-400 uppercase">₹</span>
            <input type="number" placeholder="Min" className="w-10 bg-transparent text-[10px] font-bold outline-none"
              value={filters.minPrice} onChange={e => setFilters({ ...filters, minPrice: e.target.value })} />
            <span className="text-gray-300">-</span>
            <input type="number" placeholder="Max" className="w-10 bg-transparent text-[10px] font-bold outline-none"
              value={filters.maxPrice} onChange={e => setFilters({ ...filters, maxPrice: e.target.value })} />
          </div>
        </div>
      </div>

      {/* ── Selection bar ── */}
      {selectedProducts.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-gray-700">
          <div className="flex flex-col border-r border-gray-700 pr-6">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Selection</span>
            <span className="text-lg font-bold leading-none">{selectedProducts.length} Items</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedProducts([])} className="text-[10px] font-black text-gray-400 hover:text-red-400 uppercase tracking-wider transition-colors">Deselect All</button>
            <button onClick={openAddToExistingModal} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider border border-gray-600 transition flex items-center gap-2">
              <FolderPlus size={14} className="text-indigo-400" /> Add to Existing
            </button>
            <button onClick={handleOpenBuilder} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg transition flex items-center gap-2">
              Build New <Plus size={14} />
            </button>
            <button onClick={() => addToPortal(selectedProducts)}>Add to Portal</button>
          </div>
        </div>
      )}

      {/* ── Product grid ── */}
      {Object.keys(groupedProducts).length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest">No Products Found</div>
      ) : (
        Object.keys(groupedProducts).sort().map(category => {
          const isCollapsed = collapsedCategories[category];
          const catProducts = groupedProducts[category];
          const allSelected = catProducts.every(p => selectedProducts.some(sp => sp._id === p._id));
          return (
            <div key={category} className="mb-10">
              <div className="flex items-center gap-4 mb-4 group">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleCategory(category)}>
                  <span className={`text-gray-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
                  <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest whitespace-nowrap group-hover:text-indigo-600 transition-colors">
                    {category} ({catProducts.length})
                  </h2>
                </div>
                <button
                  onClick={() => selectAllInCategory(catProducts)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter transition-all ${allSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'}`}
                >
                  {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                  {allSelected ? 'All Selected' : 'Select All'}
                </button>
                <div className="h-[1px] w-full bg-gray-100 flex-grow" />
              </div>
              {!isCollapsed && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {catProducts.map(p => {
                    const isSelected = selectedProducts.some(sp => sp._id === p._id);
                    return (
                      <div key={p._id} className={`bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col relative transition-all duration-200 ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}>
                        <div className={`absolute top-2 right-2 z-20 cursor-pointer w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/80 border-gray-300 text-transparent'}`}
                          onClick={() => toggleProductSelection(p)}>
                          <Check size={14} strokeWidth={4} />
                        </div>
                        <ProductImage p={p} getAssetUrl={getAssetUrl} onPreview={() => setPreviewProduct(p)} />
                        <div className="p-3 flex-grow flex flex-col justify-between">
                          <div>
                            <h3 className="font-bold text-xs text-gray-800 leading-tight line-clamp-2 mb-2">
                              <span className="text-indigo-500 uppercase inline-block mr-1.5 font-black">{p.brand}</span>{p.name}
                            </h3>
                            <div className="flex items-center justify-between text-[10px] bg-gray-50 p-1.5 rounded-lg mb-2">
                              <div><span className="text-gray-400 block font-bold uppercase text-[7px]">Cost</span><span className="text-gray-600 font-bold">₹{p.purchasePrice}</span></div>
                              <div className="text-right"><span className="text-gray-400 block font-bold uppercase text-[7px]">Markup</span><span className="text-indigo-600 font-black">+{p.markupPercent}%</span></div>
                            </div>
                          </div>
                          <div className="flex justify-between items-end mt-1">
                            <div><span className="text-gray-400 block font-bold uppercase text-[7px]">Sale Price</span><span className="text-sm font-black text-green-600">₹{calculateSellingPrice(p.purchasePrice, p.markupPercent)}</span></div>
                            <div className="flex gap-1">
                              <button onClick={() => setGalleryProduct(p)} className="p-1.5 hover:bg-violet-50 text-violet-400 rounded transition" title="Image Gallery & Video"><Images size={13} /></button>
                              <button onClick={() => handleEditClick(p)} className="p-1.5 hover:bg-indigo-50 text-indigo-400 rounded transition" title="Edit"><Pencil size={13} /></button>
                              <button onClick={() => handleDelete(p._id, p.name)} className="p-1.5 hover:bg-red-50 text-red-400 rounded transition" title="Delete"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Catalogue Modal ── */}
      {showCatalogueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-modal-up">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Select Catalogue</h2>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Appending {selectedProducts.length} items</p>
              </div>
              <button onClick={() => setShowCatalogueModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
              {!savedCatalogues.length ? (
                <div className="text-center py-10"><p className="text-gray-400 text-sm italic">No saved catalogues found.</p></div>
              ) : savedCatalogues.map(cat => (
                <button key={cat._id} disabled={isUpdatingCatalogue} onClick={() => appendToCatalogue(cat)}
                  className="w-full text-left p-5 rounded-3xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all flex justify-between items-center group disabled:opacity-50">
                  <div>
                    <h4 className="font-black text-gray-800 uppercase group-hover:text-indigo-600 transition-colors">{cat.name}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{(cat.items || []).length} current items</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all"><Plus size={18} /></div>
                </button>
              ))}
            </div>
            <div className="p-4 bg-gray-50">
              <button onClick={() => setShowCatalogueModal(false)} className="w-full py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[250] flex items-center justify-center p-4" onClick={() => setPreviewProduct(null)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-modal-up flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            {/* Full image — object-contain so nothing is cropped */}
            <div className="relative bg-gray-50 flex items-center justify-center" style={{minHeight: '55vh', maxHeight: '65vh'}}>
              {previewProduct.imageUrl
                ? <img
                    src={getAssetUrl(previewProduct.imageUrl)}
                    alt={previewProduct.name}
                    className="w-full h-full object-contain"
                    style={{maxHeight: '65vh'}}
                    onError={e => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/600x600?text=No+Image'; }}
                  />
                : <div className="flex items-center justify-center h-full text-gray-300"><ImageIcon size={64} /></div>
              }
              <button onClick={() => setPreviewProduct(null)} className="absolute top-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-full text-gray-700 shadow hover:bg-white transition"><X size={18} /></button>
            </div>
            {/* Details */}
            <div className="p-6 border-t">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-0.5">{previewProduct.brand}</span>
                  <h2 className="text-xl font-black text-gray-900 leading-tight uppercase tracking-tighter truncate">{previewProduct.name}</h2>
                  {previewProduct.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{previewProduct.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-gray-400 block font-bold uppercase text-[9px]">Selling Price</span>
                  <span className="text-2xl font-black text-green-600">₹{calculateSellingPrice(previewProduct.purchasePrice, previewProduct.markupPercent)}</span>
                </div>
              </div>
              <div className="mt-4">
                <button onClick={() => { toggleProductSelection(previewProduct); setPreviewProduct(null); }}
                  className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${selectedProducts.some(p => p._id === previewProduct._id) ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700'}`}>
                  {selectedProducts.some(p => p._id === previewProduct._id) ? 'Remove from Selection' : 'Select Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          FULLSCREEN AI COMPARE LIGHTBOX
      ════════════════════════════════════════════════════════════════════════ */}
      {showCompareModal && generatedImageUrl && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex flex-col" onClick={() => setShowCompareModal(false)}>
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-white font-black uppercase tracking-widest text-sm">Compare — Click an image to select it</p>
            <button onClick={() => setShowCompareModal(false)} className="text-white/60 hover:text-white transition"><X size={24} /></button>
          </div>
          <div className="flex flex-1 gap-3 px-6 pb-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div
              onClick={() => { setUseGeneratedImage(false); setShowCompareModal(false); }}
              className={[
                'flex-1 flex flex-col rounded-2xl overflow-hidden border-4 cursor-pointer transition-all',
                !useGeneratedImage
                  ? 'border-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.5)]'
                  : 'border-white/10 hover:border-white/30'
              ].join(' ')}
            >
              <div className="flex-1 bg-gray-900 flex items-center justify-center overflow-hidden">
                <img src={imagePreviewUrl} alt="Original" className="max-w-full max-h-full object-contain" style={{maxHeight: 'calc(90vh - 140px)'}} />
              </div>
              <div className={[
                'flex items-center justify-center gap-2 py-3 text-sm font-black uppercase tracking-widest flex-shrink-0',
                !useGeneratedImage ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/50'
              ].join(' ')}>
                {!useGeneratedImage && <CheckCircle2 size={16} />}
                Original
                {!useGeneratedImage && <span className="text-[10px] font-bold normal-case tracking-normal opacity-80">— will be saved</span>}
              </div>
            </div>
            <div
              onClick={() => { setUseGeneratedImage(true); setShowCompareModal(false); }}
              className={[
                'flex-1 flex flex-col rounded-2xl overflow-hidden border-4 cursor-pointer transition-all',
                useGeneratedImage
                  ? 'border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.5)]'
                  : 'border-white/10 hover:border-white/30'
              ].join(' ')}
            >
              <div className="flex-1 bg-gray-900 flex items-center justify-center overflow-hidden">
                <img src={generatedImageUrl} alt="AI Studio" className="max-w-full max-h-full object-contain" style={{maxHeight: 'calc(90vh - 140px)'}} />
              </div>
              <div className={[
                'flex items-center justify-center gap-2 py-3 text-sm font-black uppercase tracking-widest flex-shrink-0',
                useGeneratedImage ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50'
              ].join(' ')}>
                {useGeneratedImage && <CheckCircle2 size={16} />}
                <Sparkles size={14} /> AI Studio
                {useGeneratedImage && <span className="text-[10px] font-bold normal-case tracking-normal opacity-80">— will be saved</span>}
              </div>
            </div>
          </div>
          <p className="text-center text-white/30 text-xs pb-4 flex-shrink-0">Click either image to select it and close</p>
        </div>
      )}

            {/* ════════════════════════════════════════════════════════════════════════
          ADD / EDIT PRODUCT MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800 uppercase">{isEditing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 transition"><X size={22} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Brand / Category */}
              <div className="grid grid-cols-2 gap-4">
                <CustomCreatableSelect label="Brand" isDisabled={isEditing}
                  options={meta.brands.map(b => ({ label: b, value: b }))}
                  value={formData.brand ? { label: formData.brand, value: formData.brand } : null}
                  onChange={v => setFormData({ ...formData, brand: v?.value })} />
                <CustomCreatableSelect label="Category" isDisabled={isEditing}
                  options={meta.categories.map(c => ({ label: c, value: c }))}
                  value={formData.category ? { label: formData.category, value: formData.category } : null}
                  onChange={handleCategoryChange} />
              </div>

              {/* Sub Category / Name */}
              <div className="grid grid-cols-2 gap-4">
                <CustomCreatableSelect label="Sub Category" isDisabled={isEditing || !formData.category}
                  value={formData.subCategory ? { label: formData.subCategory, value: formData.subCategory } : null}
                  options={availableSubCats}
                  onChange={v => setFormData({ ...formData, subCategory: v?.value })} />
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Name</label>
                  <input className="w-full border rounded-lg p-2 text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Description</label>
                <textarea className="w-full border rounded-lg p-2 h-20 text-sm" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              {/* Cost Price / Image upload */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cost Price (₹)</label>
                  <input type="number" className="w-full border rounded-lg p-2 text-sm" value={formData.purchasePrice} onChange={e => setFormData({ ...formData, purchasePrice: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Image</label>
                  <input type="file" accept="image/*" onChange={e => handleImageFileChange(e.target.files[0])} className="text-[10px] mt-1 w-full" />
                  {isEditing && <p className="text-[8px] text-indigo-500 mt-1 italic">Leave empty to keep current image</p>}
                </div>
              </div>

              {/* ── Studio AI Processing section ── */}
              {imageFile && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
                  {/* Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={processImage} onChange={e => { setProcessImage(e.target.checked); if (!e.target.checked) { setGeneratedImageUrl(null); setUseGeneratedImage(false); setAiError(null); }}} className="accent-purple-600 w-4 h-4" />
                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={11} /> Studio AI Processing (Gemini)
                    </span>
                  </label>

                  {processImage && (
                    <div className="space-y-3">
                      {/* Prompt selector */}
                      <PromptSelector
                        prompts={savedPrompts}
                        category={formData.category}
                        selectedId={selectedPromptId}
                        onSelect={setPromptId}
                        customText={customPromptText}
                        onCustom={setCustomPrompt}
                        onOpenManager={() => { setShowModal(false); resetPromptManager(); setShowPromptManager(true); }}
                      />

                      {/* Generate button */}
                      <button
                        type="button"
                        onClick={handleGenerateStudio}
                        disabled={aiProcessing}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition"
                      >
                        {aiProcessing
                          ? <><Loader2 size={13} className="animate-spin" /> Generating with Gemini…</>
                          : <><Sparkles size={13} /> Generate Studio Image</>}
                      </button>

                      {/* Error */}
                      {aiError && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-red-600 font-bold">{aiError}</p>
                        </div>
                      )}

                      {/* Before / After comparison — thumbnails + fullscreen compare */}
                      {generatedImageUrl && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div
                              onClick={() => setUseGeneratedImage(false)}
                              className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${!useGeneratedImage ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 opacity-60 hover:opacity-90'}`}
                            >
                              <img src={imagePreviewUrl} alt="Original" className="w-full h-24 object-cover" />
                              <div className={`flex items-center justify-center gap-1 py-1 text-[8px] font-black uppercase ${!useGeneratedImage ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {!useGeneratedImage && <CheckCircle2 size={9} />} Original
                              </div>
                            </div>
                            <div
                              onClick={() => setUseGeneratedImage(true)}
                              className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${useGeneratedImage ? 'border-purple-500 ring-2 ring-purple-100' : 'border-gray-200 opacity-60 hover:opacity-90'}`}
                            >
                              <img src={generatedImageUrl} alt="AI Studio" className="w-full h-24 object-cover" />
                              <div className={`flex items-center justify-center gap-1 py-1 text-[8px] font-black uppercase ${useGeneratedImage ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {useGeneratedImage && <CheckCircle2 size={9} />} AI Studio
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCompareModal(true)}
                            className="w-full py-2 border border-purple-300 text-purple-600 rounded-lg font-black uppercase text-[9px] tracking-widest hover:bg-purple-50 transition flex items-center justify-center gap-1"
                          >
                            <ImageIcon size={11} /> Compare Full Size
                          </button>
                          <p className="text-[8px] text-purple-400 text-center">
                            {useGeneratedImage ? '✨ AI Studio image will be saved' : '📷 Original image will be saved'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Margin / Selling price */}
              <div className="bg-indigo-50 p-6 rounded-xl">
                <div className="grid grid-cols-2 items-center gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-indigo-900 uppercase mb-1">Margin (%)</label>
                    <select className="w-full border rounded-lg p-2 bg-white font-black" value={formData.markupPercent}
                      onChange={e => setFormData({ ...formData, markupPercent: parseInt(e.target.value) })}>
                      {[10, 15, 20, 25, 30, 35, 40, 45, 50].map(m => <option key={m} value={m}>{m}%</option>)}
                    </select>
                  </div>
                  <div className="text-right">
                    <label className="block text-[11px] font-black text-indigo-900 uppercase">Final Selling Price</label>
                    <div className="text-3xl font-black text-green-600">₹{calculateSellingPrice(formData.purchasePrice, formData.markupPercent)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowModal(false); resetForm(); }} className="px-6 py-2 text-gray-400 font-bold uppercase text-xs">Cancel</button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs hover:bg-indigo-700 shadow-lg disabled:opacity-60 flex items-center gap-2"
              >
                {isSaving
                  ? <><Loader2 size={13} className="animate-spin" />{isEditing ? 'Updating…' : 'Saving…'}</>
                  : (isEditing ? 'Update Product' : 'Save Product')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          STUDIO PROMPTS MANAGER MODAL (standalone)
      ════════════════════════════════════════════════════════════════════════ */}
      {showPromptManager && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-black text-gray-800 uppercase flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600" /> Studio Prompts
              </h2>
              <button onClick={() => { setShowPromptManager(false); resetPromptManager(); }} className="text-gray-400 hover:text-gray-600 transition"><X size={22} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Add / Edit form */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 space-y-3">
                <h3 className="text-[10px] font-black text-purple-700 uppercase tracking-widest">
                  {editingPromptId ? '✏️ Edit Prompt' : '＋ New Prompt'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Name</label>
                    <input
                      value={promptForm.name}
                      onChange={e => setPromptForm({ ...promptForm, name: e.target.value })}
                      placeholder="e.g. Dark Studio"
                      className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Category</label>
                    <select
                      value={promptForm.category}
                      onChange={e => setPromptForm({ ...promptForm, category: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-1 focus:ring-purple-400 outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="All">All Categories</option>
                      {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Prompt</label>
                  <textarea
                    rows={5}
                    value={promptForm.prompt}
                    onChange={e => setPromptForm({ ...promptForm, prompt: e.target.value })}
                    placeholder="Act as a high-end commercial photographer. Place this product on a clean white studio background with professional lighting…"
                    className="w-full border rounded-lg p-2 text-sm resize-none focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={promptForm.isDefault}
                      onChange={e => setPromptForm({ ...promptForm, isDefault: e.target.checked })}
                      className="accent-purple-600 w-4 h-4" />
                    <span className="text-[10px] font-black text-purple-600 uppercase">Set as default for category</span>
                  </label>
                  <div className="flex gap-2">
                    {editingPromptId && (
                      <button onClick={resetPromptManager} className="px-4 py-2 text-gray-400 font-bold text-xs uppercase">Cancel</button>
                    )}
                    <button
                      onClick={savePrompt}
                      disabled={promptSaving}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg font-black text-xs uppercase hover:bg-purple-700 disabled:opacity-60 flex items-center gap-1"
                    >
                      {promptSaving ? <><Loader2 size={11} className="animate-spin" /> Saving…</> : (editingPromptId ? 'Update' : 'Save Prompt')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Prompts list */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Saved Prompts ({savedPrompts.length})
                </h3>
                {savedPrompts.length === 0 && <p className="text-sm text-gray-400 italic">No prompts saved yet.</p>}
                {savedPrompts.map(p => (
                  <div key={p._id} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-3 hover:border-purple-200 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-black text-gray-800">{p.name}</span>
                        <span className="text-[9px] font-black text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full uppercase">{p.category}</span>
                        {p.isDefault && <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase">★ Default</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2">{p.prompt}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {!p.isDefault && (
                        <button onClick={() => setDefaultPrompt(p._id)} title="Set as default"
                          className="p-1.5 text-amber-400 hover:bg-amber-50 rounded-lg transition text-[10px] font-black">
                          <Star size={13} />
                        </button>
                      )}
                      <button onClick={() => { setEditingPromptId(p._id); setPromptForm({ name: p.name, category: p.category, prompt: p.prompt, isDefault: p.isDefault }); }}
                        className="p-1.5 text-indigo-400 hover:bg-indigo-50 rounded-lg transition">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deletePrompt(p._id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PDF IMPORT MODAL (same-category only → AI process → save to DB)
      ════════════════════════════════════════════════════════════════════════ */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-800 uppercase flex items-center gap-2">
                <FileText size={18} className="text-purple-600" /> Import from PDF
              </h2>
              <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-[10px] text-gray-500 leading-relaxed bg-purple-50 border border-purple-100 rounded-lg p-3">
                Upload a PDF containing product images of the <strong>same category</strong>. Each image will be processed by Gemini AI into a studio-quality shot and saved as a draft product.
              </p>

              {/* Category / Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Category</label>
                  <select value={pdfCategory} onChange={e => setPdfCategory(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                    <option value="">Select...</option>
                    {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Brand</label>
                  <select value={pdfBrand} onChange={e => setPdfBrand(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                    <option value="">Select...</option>
                    {meta.brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Prompt selector */}
              <PromptSelector
                prompts={savedPrompts}
                category={pdfCategory}
                selectedId={pdfPromptId}
                onSelect={setPdfPromptId}
                customText={pdfCustomPrompt}
                onCustom={setPdfCustomPrompt}
                onOpenManager={() => { setShowPdfModal(false); resetPromptManager(); setShowPromptManager(true); }}
              />

              {/* PDF file */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">PDF File</label>
                <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files[0])} className="text-sm w-full" />
                {pdfFile && <p className="text-[9px] text-purple-500 mt-1">{pdfFile.name}</p>}
              </div>

              {/* Progress */}
              {pdfLoading && pdfProgress && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <Loader2 size={13} className="text-blue-500 animate-spin" />
                  <p className="text-[10px] font-bold text-blue-600">{pdfProgress}</p>
                </div>
              )}

              {/* Result */}
              {pdfResult && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-green-700">
                    {pdfResult.count} draft products created — find them in the product list with "Import" in the name
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPdfModal(false)} className="px-6 py-2 text-gray-400 font-bold uppercase text-xs">Close</button>
              <button
                onClick={handlePdfImport}
                disabled={pdfLoading || !pdfFile}
                className="px-8 py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-xs hover:bg-purple-700 disabled:opacity-50 shadow-lg flex items-center gap-2"
              >
                {pdfLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Processing…</>
                  : <><Sparkles size={13} /> Process &amp; Save Products</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          EXTRACT PDF IMAGES MODAL (raw download, no AI processing)
      ════════════════════════════════════════════════════════════════════════ */}
      {showExtractModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-800 uppercase flex items-center gap-2">
                <Download size={18} className="text-amber-500" /> Extract PDF Images
              </h2>
              <button onClick={() => { if (!extractLoading) { setShowExtractModal(false); setExtractFile(null); } }} className="text-gray-400 hover:text-gray-600 disabled:opacity-30" disabled={extractLoading}><X size={22} /></button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-[10px] text-gray-500 leading-relaxed bg-amber-50 border border-amber-100 rounded-lg p-3">
                Extract all embedded images from a PDF as a <strong>ZIP file</strong> — no AI processing. Use this to download raw product images, then upload them individually via <em>Add Product</em>.
              </p>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">PDF File</label>
                <input type="file" accept="application/pdf" onChange={e => setExtractFile(e.target.files[0])} className="text-sm w-full" disabled={extractLoading} />
                {extractFile && <p className="text-[9px] text-amber-600 mt-1">{extractFile.name}</p>}
              </div>
              {extractLoading && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <Loader2 size={13} className="text-amber-500 animate-spin flex-shrink-0" />
                  <p className="text-[10px] font-bold text-amber-600">Extracting images — this may take a moment for large PDFs…</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { if (!extractLoading) { setShowExtractModal(false); setExtractFile(null); } }} disabled={extractLoading} className="px-6 py-2 text-gray-400 font-bold uppercase text-xs disabled:opacity-30">Cancel</button>
              <button
                onClick={handleExtractImages}
                disabled={extractLoading || !extractFile}
                className="px-8 py-3 bg-amber-500 text-white rounded-xl font-black uppercase text-xs hover:bg-amber-600 disabled:opacity-50 shadow-lg flex items-center gap-2"
              >
                {extractLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Extracting…</>
                  : <><Download size={13} /> Download ZIP</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* modal-up used by add/edit modal animation */
        @keyframes modal-up {
          0%   { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
        .animate-modal-up { animation: modal-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        /* Scrollbar utilities — also defined in AppPopupStyles but safe to repeat */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {/* ════════════════════════════════════════════════════════════════════════
          IMAGE GALLERY & VIDEO MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {galleryProduct && (
        <ProductImageGallery
          product={galleryProduct}
          onClose={() => setGalleryProduct(null)}
          onSaved={() => { fetchData(); }}
        />
      )}

      <PortalModal />
    </div>
  );
};

export default ProductList;