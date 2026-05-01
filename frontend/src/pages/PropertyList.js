import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  Plus, Trash2, Pencil, X, Search, RotateCcw,
  MapPin, Globe, Check, Square, CheckSquare,
  Moon, Sun, Link2, FileText, Upload, Paperclip, Youtube,
} from 'lucide-react';
import usePortalItems from '../hooks/usePortalItems';
import { INDIA_STATES, CITIES_BY_STATE, SearchableSelect } from '../utils/indiaLocations';

// Simple ₹ input — no spinners, no up/down arrows
const MoneyInput = ({ label, value, onChange, hint, accent = 'indigo' }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</label>
    {hint && <div className="text-[9px] text-slate-300 mb-1">{hint}</div>}
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); onChange(v); }}
        className={`w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm font-bold outline-none focus:border-${accent}-300 transition-colors`}
      />
    </div>
  </div>
);

// Cost + Margin → Auto-calculated sell price row
const OccupancyPricing = ({ label, costKey, marginKey, sellKey, formData, setFormData, accent = 'indigo' }) => {
  const cost   = formData[costKey]   || '';
  const margin = formData[marginKey] ?? 15;
  const sell   = formData[sellKey]   || '';

  const updateCost = (v) => {
    const newSell = calcSell(v, margin);
    setFormData({ ...formData, [costKey]: v, [sellKey]: newSell });
  };
  const updateMargin = (v) => {
    const newSell = calcSell(cost, v);
    setFormData({ ...formData, [marginKey]: v, [sellKey]: newSell });
  };

  return (
    <div className={`bg-white border border-${accent}-100 rounded-xl p-3 space-y-2`}>
      <div className={`text-[10px] font-black text-${accent}-600 uppercase tracking-widest`}>{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {/* Cost */}
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cost price</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={cost}
              onChange={e => updateCost(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-300 transition-colors" />
          </div>
        </div>
        {/* Margin % */}
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Margin %</label>
          <div className="relative">
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={margin}
              onChange={e => updateMargin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 pr-6 py-1.5 text-sm font-bold outline-none focus:border-indigo-300 transition-colors text-center" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
          </div>
        </div>
        {/* Sell price — auto-calculated, editable override */}
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sell price</label>
          <div className={`relative bg-${accent}-50 border border-${accent}-200 rounded-lg px-2 pl-5 py-1.5 flex items-center`}>
            <span className={`absolute left-2 text-${accent}-400 text-xs font-bold`}>₹</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={sell}
              onChange={e => setFormData({ ...formData, [sellKey]: e.target.value.replace(/[^0-9]/g, '') })}
              className={`w-full bg-transparent text-sm font-black text-${accent}-700 outline-none`} />
          </div>
          <div className="text-[8px] text-slate-300 mt-0.5">Auto-calc · editable</div>
        </div>
      </div>
    </div>
  );
};

const Price = ({ value }) => (
  <span className="font-black text-slate-800 text-xs">
    {value > 0 ? `₹${Number(value).toLocaleString('en-IN')}` : '—'}
  </span>
);

const EMPTY_FORM = {
  propertyName: '', state: '', place: '', website: '', imageUrl: '',
  youtubeUrl: '',
  type: 'Night Stay', details: '',
  // Night Stay
  purchasePriceSingle: '', marginSingle: 15, singlePrice: '',
  purchasePriceDouble: '', marginDouble: 15, doublePrice: '',
  purchasePriceTriple: '', marginTriple: 15, triplePrice: '',
  purchasePriceQuad:   '', marginQuad:   15, quadPrice:   '',
  // Configurable room categories (e.g. "Premium", "Luxury")
  roomCategories: [],
  // Shared add-on margin (applies to all 4 standard add-ons + adhoc)
  addonMargin:            15,
  purchaseDJ:             '', djCost:         '', djCostPerPerson:         false,
  purchaseLicenseFeeDJ:   '', licenseFeeDJ:   '', licenseFeeDJPerPerson:   false,
  purchaseCocktailSnacks: '', cocktailSnacks: '', cocktailSnacksPerPerson: true,
  purchaseBanquetHall:    '', banquetHall:    '', banquetHallPerPerson:    false,
  // Adhoc add-ons — unlimited extras
  adhocAddons: [],
  // Day Outing — multi-package
  dayPackages: [{ name: '', activities: '', purchasePrice: '', margin: 15, sellingPrice: '' }],
  // Attachments (populated after upload)
  attachments: [],
};

// Auto-calculate sell price from cost + margin
const calcSell = (cost, margin) => {
  const c = parseFloat(cost);
  const m = parseFloat(margin);
  if (!c || c <= 0) return '';
  return Math.ceil(c * (1 + m / 100)).toString();
};

const PropertyList = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [isEditing, setIsEditing]   = useState(false);
  const [currentId, setCurrentId]   = useState(null);
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [selected, setSelected]       = useState([]);

  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = React.useRef(null);

  const handleAttachmentUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/properties/upload-attachment', fd);
        uploaded.push({
          name:     file.name,
          url:      res.data.url,
          mimeType: file.type || 'application/octet-stream',
          size:     file.size,
        });
      }
      setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...uploaded] }));
    } catch (err) {
      alert('Attachment upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const { addToPortal, PortalModal } = usePortalItems('offsite');
  const navigate = useNavigate();

  // ── Send selected properties to OffsiteBuilder for PDF catalogue ─────────
  const openInOffsiteBuilder = () => {
    localStorage.setItem('offsite_selection', JSON.stringify(selected));
    navigate('/offsite-builder');
  };

  useEffect(() => { fetchProperties(); }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await api.get('/properties');
      setProperties(res.data || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.propertyName.trim()) return alert('Property name is required.');
    try {
      const payload = {
        ...formData,
        purchasePriceSingle:  Number(formData.purchasePriceSingle)  || 0,
        marginSingle:         Number(formData.marginSingle)         || 15,
        singlePrice:          Number(formData.singlePrice)          || 0,
        purchasePriceDouble:  Number(formData.purchasePriceDouble)  || 0,
        marginDouble:         Number(formData.marginDouble)         || 15,
        doublePrice:          Number(formData.doublePrice)          || 0,
        purchasePriceTriple:  Number(formData.purchasePriceTriple)  || 0,
        marginTriple:         Number(formData.marginTriple)         || 15,
        triplePrice:          Number(formData.triplePrice)          || 0,
        purchasePriceQuad:    Number(formData.purchasePriceQuad)    || 0,
        marginQuad:           Number(formData.marginQuad)           || 15,
        quadPrice:            Number(formData.quadPrice)            || 0,
        addonMargin:          Number(formData.addonMargin)          || 15,
        purchaseDJ:             Number(formData.purchaseDJ)             || 0,
        djCost:                 Number(formData.djCost)                 || 0,
        djCostPerPerson:        !!formData.djCostPerPerson,
        purchaseLicenseFeeDJ:   Number(formData.purchaseLicenseFeeDJ)   || 0,
        licenseFeeDJ:           Number(formData.licenseFeeDJ)           || 0,
        licenseFeeDJPerPerson:  !!formData.licenseFeeDJPerPerson,
        purchaseCocktailSnacks: Number(formData.purchaseCocktailSnacks) || 0,
        cocktailSnacks:         Number(formData.cocktailSnacks)         || 0,
        cocktailSnacksPerPerson:!!formData.cocktailSnacksPerPerson,
        purchaseBanquetHall:    Number(formData.purchaseBanquetHall)    || 0,
        banquetHall:            Number(formData.banquetHall)            || 0,
        banquetHallPerPerson:   !!formData.banquetHallPerPerson,
        adhocAddons: (formData.adhocAddons || [])
          .filter(a => a.name.trim())
          .map(a => ({
            name:          a.name.trim(),
            purchasePrice: Number(a.purchasePrice) || 0,
            sellingPrice:  Number(a.sellingPrice)  || 0,
            perPerson:     !!a.perPerson,
          })),
        roomCategories: (formData.roomCategories || [])
          .filter(rc => rc.name.trim())
          .map(rc => ({
            name:                rc.name.trim(),
            purchasePriceSingle: Number(rc.purchasePriceSingle) || 0,
            marginSingle:        Number(rc.marginSingle)        || 15,
            singlePrice:         Number(rc.singlePrice)         || 0,
            purchasePriceDouble: Number(rc.purchasePriceDouble) || 0,
            marginDouble:        Number(rc.marginDouble)        || 15,
            doublePrice:         Number(rc.doublePrice)         || 0,
            purchasePriceTriple: Number(rc.purchasePriceTriple) || 0,
            marginTriple:        Number(rc.marginTriple)        || 15,
            triplePrice:         Number(rc.triplePrice)         || 0,
          })),
        dayPackages: (formData.dayPackages || [])
          .filter(pkg => pkg.name || pkg.purchasePrice)
          .map(pkg => ({
            name:          pkg.name        || '',
            activities:    pkg.activities  || '',
            purchasePrice: Number(pkg.purchasePrice) || 0,
            margin:        Number(pkg.margin)        || 15,
            sellingPrice:  Number(pkg.sellingPrice)  || 0,
          })),
        youtubeUrl:  formData.youtubeUrl  || '',
        attachments: formData.attachments || [],
      };
      if (isEditing) {
        await api.put(`/properties/${currentId}`, payload);
      } else {
        await api.post('/properties', payload);
      }
      setShowModal(false);
      resetForm();
      fetchProperties();
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this property?')) return;
    try {
      await api.delete(`/properties/${id}`);
      fetchProperties();
      setSelected(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleEdit = (p) => {
    setIsEditing(true);
    setCurrentId(p._id);
    setFormData({
      propertyName:         p.propertyName         || '',
      state:                p.state                || '',
      place:                p.place                || '',
      website:              p.website              || '',
      imageUrl:             p.imageUrl             || '',
      type:                 p.type                 || 'Night Stay',
      details:              p.details              || '',
      purchasePriceSingle:  p.purchasePriceSingle  || '',
      marginSingle:         p.marginSingle         ?? 15,
      singlePrice:          p.singlePrice          || '',
      purchasePriceDouble:  p.purchasePriceDouble  || '',
      marginDouble:         p.marginDouble         ?? 15,
      doublePrice:          p.doublePrice          || '',
      purchasePriceTriple:  p.purchasePriceTriple  || '',
      marginTriple:         p.marginTriple         ?? 15,
      triplePrice:          p.triplePrice          || '',
      purchasePriceQuad:    p.purchasePriceQuad    || '',
      marginQuad:           p.marginQuad           ?? 15,
      quadPrice:            p.quadPrice            || '',
      addonMargin:          p.addonMargin          ?? 15,
      purchaseDJ:             p.purchaseDJ             || '',
      djCost:                 p.djCost                 || '',
      djCostPerPerson:        p.djCostPerPerson        ?? false,
      purchaseLicenseFeeDJ:   p.purchaseLicenseFeeDJ   || '',
      licenseFeeDJ:           p.licenseFeeDJ           || '',
      licenseFeeDJPerPerson:  p.licenseFeeDJPerPerson  ?? false,
      purchaseCocktailSnacks: p.purchaseCocktailSnacks || '',
      cocktailSnacks:         p.cocktailSnacks         || '',
      cocktailSnacksPerPerson:p.cocktailSnacksPerPerson ?? true,
      purchaseBanquetHall:    p.purchaseBanquetHall    || '',
      banquetHall:            p.banquetHall            || '',
      banquetHallPerPerson:   p.banquetHallPerPerson   ?? false,
      adhocAddons: (p.adhocAddons || []).map(a => ({
        name:          a.name          || '',
        purchasePrice: String(a.purchasePrice || ''),
        sellingPrice:  String(a.sellingPrice  || ''),
        perPerson:     !!a.perPerson,
      })),
      roomCategories: (p.roomCategories || []).map(rc => ({
        name:                rc.name                || '',
        purchasePriceSingle: String(rc.purchasePriceSingle || ''),
        marginSingle:        rc.marginSingle         ?? 15,
        singlePrice:         String(rc.singlePrice   || ''),
        purchasePriceDouble: String(rc.purchasePriceDouble || ''),
        marginDouble:        rc.marginDouble         ?? 15,
        doublePrice:         String(rc.doublePrice   || ''),
        purchasePriceTriple: String(rc.purchasePriceTriple || ''),
        marginTriple:        rc.marginTriple         ?? 15,
        triplePrice:         String(rc.triplePrice   || ''),
      })),
      dayPackages: (p.dayPackages && p.dayPackages.length > 0)
        ? p.dayPackages.map(pkg => ({
            name:          pkg.name          || '',
            activities:    pkg.activities    || '',
            purchasePrice: String(pkg.purchasePrice || ''),
            margin:        pkg.margin        ?? 15,
            sellingPrice:  String(pkg.sellingPrice  || ''),
          }))
        : [{ name: '', activities: '', purchasePrice: '', margin: 15, sellingPrice: '' }],
      youtubeUrl:  p.youtubeUrl  || '',
      attachments: p.attachments || [],
    });
    setShowModal(true);
  };

  const resetForm = () => { setFormData(EMPTY_FORM); setIsEditing(false); setCurrentId(null); };

  const isSelected = (p) => selected.some(s => s._id === p._id);
  const toggleSelect = (p) => setSelected(
    isSelected(p) ? selected.filter(s => s._id !== p._id) : [...selected, p]
  );

  const states = INDIA_STATES;
  const filtered = properties.filter(p => {
    const s = searchTerm.toLowerCase();
    return (
      (!s || p.propertyName?.toLowerCase().includes(s) || p.place?.toLowerCase().includes(s) || p.state?.toLowerCase().includes(s)) &&
      (!stateFilter || p.state === stateFilter) &&
      (!typeFilter  || p.type  === typeFilter)
    );
  });

  const allSelected = filtered.length > 0 && filtered.every(p => isSelected(p));
  const toggleAll = () => {
    if (allSelected) {
      const ids = new Set(filtered.map(p => p._id));
      setSelected(selected.filter(p => !ids.has(p._id)));
    } else {
      const ids = new Set(selected.map(p => p._id));
      setSelected([...selected, ...filtered.filter(p => !ids.has(p._id))]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 pb-28 min-h-screen bg-gray-50/50">

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-gray-50/50 pb-2">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 border-r pr-3 border-gray-100">
            <h1 className="text-xs font-black text-orange-500 uppercase tracking-tighter">Properties</h1>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="bg-orange-500 hover:bg-orange-600 text-white w-8 h-8 rounded-lg flex items-center justify-center transition">
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <input type="text" placeholder="Search..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-8 py-2 rounded-lg border border-gray-100 focus:border-orange-300 outline-none text-xs bg-gray-50 w-44" />
            <Search size={12} className="absolute left-2.5 top-2.5 text-gray-300" />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2.5 text-gray-300 hover:text-orange-500"><X size={12} /></button>
            )}
          </div>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            className="border border-gray-100 p-2 rounded-lg text-[10px] font-bold bg-white outline-none">
            <option value="">All States</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-100 p-2 rounded-lg text-[10px] font-bold bg-white outline-none">
            <option value="">All Types</option>
            <option value="Night Stay">Night Stay</option>
            <option value="Day Outing">Day Outing</option>
          </select>
          <button onClick={() => { setSearchTerm(''); setStateFilter(''); setTypeFilter(''); }}
            className="p-2 text-gray-300 hover:text-orange-500 transition-colors" title="Reset filters">
            <RotateCcw size={14} />
          </button>
          <button onClick={toggleAll}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all ${allSelected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500'}`}>
            {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">Loading...</div>}

      {/* Grid */}
      {!loading && (
        filtered.length === 0
          ? <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-xs">No properties found</div>
          : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
              {filtered.map(p => {
                const sel = isSelected(p);
                const isNight = p.type === 'Night Stay';
                return (
                  <div key={p._id} className={`bg-white rounded-xl overflow-hidden border shadow-sm flex flex-col transition-all duration-200 ${sel ? 'ring-2 ring-orange-400 border-orange-200' : 'border-gray-100'}`}>
                    {/* Image */}
                    <div className="relative h-40 bg-slate-100 overflow-hidden">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.propertyName} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-200"><MapPin size={32} /></div>
                      }
                      <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase ${isNight ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}`}>
                        {isNight ? <Moon size={9} /> : <Sun size={9} />} {p.type}
                      </div>
                      <div onClick={() => toggleSelect(p)}
                        className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${sel ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/80 border-gray-300 text-transparent'}`}>
                        <Check size={13} strokeWidth={3} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 flex-1 flex flex-col">
                      <div className="font-black text-sm text-slate-800 leading-tight mb-1">{p.propertyName}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-2">
                        <MapPin size={10} className="text-orange-400" />
                        {[p.place, p.state].filter(Boolean).join(', ') || 'Location TBD'}
                      </div>
                      {p.details && <p className="text-[10px] text-slate-400 line-clamp-2 mb-2">{p.details}</p>}
                      <div className="mt-auto">
                        {isNight ? (
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            {p.singlePrice > 0 && (
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center">
                                <div className="text-[8px] font-black text-slate-400 uppercase">Single</div>
                                <Price value={p.singlePrice} />
                              </div>
                            )}
                            {p.doublePrice > 0 && (
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center">
                                <div className="text-[8px] font-black text-slate-400 uppercase">Double</div>
                                <Price value={p.doublePrice} />
                              </div>
                            )}
                            {p.triplePrice > 0 && (
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center">
                                <div className="text-[8px] font-black text-slate-400 uppercase">Triple</div>
                                <Price value={p.triplePrice} />
                              </div>
                            )}
                            {p.quadPrice > 0 && (
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center">
                                <div className="text-[8px] font-black text-slate-400 uppercase">Quad</div>
                                <Price value={p.quadPrice} />
                              </div>
                            )}
                          </div>
                        ) : (
                          (p.dayPackages && p.dayPackages.length > 0)
                          ? <div className="flex flex-col gap-1 mb-2">
                              {p.dayPackages.slice(0, 3).map((pkg, i) => (
                                <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg p-1.5 flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-bold text-amber-700 truncate flex-1">{pkg.name || `Package ${i + 1}`}</span>
                                  <span className="text-[10px] font-black text-slate-800 shrink-0">
                                    {pkg.sellingPrice > 0 ? `₹${Number(pkg.sellingPrice).toLocaleString('en-IN')}` : '—'}
                                  </span>
                                </div>
                              ))}
                              {p.dayPackages.length > 3 && (
                                <div className="text-[9px] text-slate-400 text-center font-bold">+{p.dayPackages.length - 3} more packages</div>
                              )}
                            </div>
                          : p.packagePrice > 0 && (
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center mb-2">
                                <div className="text-[8px] font-black text-slate-400 uppercase">Day Package</div>
                                <Price value={p.packagePrice} />
                              </div>
                            )
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                        {p.website && (
                          <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                            target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">
                            <Globe size={11} /> Website
                          </a>
                        )}
                        <div className="flex gap-1 ml-auto">
                          <button onClick={() => handleEdit(p)} className="p-1.5 hover:bg-indigo-50 text-indigo-400 rounded transition"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(p._id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded transition"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
      )}

      {/* Selection bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-gray-700">
          <div className="flex flex-col border-r border-gray-700 pr-6">
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Selection</span>
            <span className="text-lg font-bold leading-none">{selected.length} {selected.length === 1 ? 'Property' : 'Properties'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected([])}
              className="text-[10px] font-black text-gray-400 hover:text-red-400 uppercase tracking-wider">
              Deselect All
            </button>
            <button onClick={() => addToPortal(selected)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg transition">
              <Link2 size={14} />
              Add to Portal
            </button>
            <button onClick={openInOffsiteBuilder}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg transition">
              <FileText size={14} />
              Build PDF
            </button>
          </div>
        </div>
      )}

      {/* Portal modal */}
      <PortalModal />

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-black text-slate-800 uppercase">{isEditing ? 'Edit Property' : 'Add Property'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }}><X size={22} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {['Night Stay', 'Day Outing'].map(t => (
                  <button type="button" key={t} onClick={() => setFormData({ ...formData, type: t })}
                    className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${formData.type === t ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                    {t === 'Night Stay' ? <Moon size={14} /> : <Sun size={14} />} {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Property Name *</label>
                  <input value={formData.propertyName} onChange={e => setFormData({ ...formData, propertyName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-300" />
                </div>
                <div>
                  <SearchableSelect
                    label="State"
                    value={formData.state}
                    onChange={s => setFormData({ ...formData, state: s, place: '' })}
                    options={INDIA_STATES}
                    placeholder="Select State"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Place / City</label>
                  {formData.state && (CITIES_BY_STATE[formData.state] || []).length > 0 && (
                    <SearchableSelect
                      value={(CITIES_BY_STATE[formData.state] || []).includes(formData.place) ? formData.place : ''}
                      onChange={c => setFormData({ ...formData, place: c })}
                      options={CITIES_BY_STATE[formData.state] || []}
                      placeholder="Select city from list…"
                    />
                  )}
                  <input
                    value={formData.place}
                    onChange={e => setFormData({ ...formData, place: e.target.value })}
                    placeholder={formData.state && (CITIES_BY_STATE[formData.state] || []).length > 0 ? 'Or type a custom city…' : 'Enter city…'}
                    className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-300 transition-colors placeholder-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Website</label>
                  <input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-300" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Image URL</label>
                <input value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-300" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                  <Youtube size={11} className="text-red-500" /> YouTube Video URL
                </label>
                <input value={formData.youtubeUrl} onChange={e => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  placeholder="https://youtube.com/watch?v=... or youtu.be/..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-red-300 transition-colors" />
                <div className="text-[9px] text-slate-300 mt-1">Embedded as a play button in the client portal</div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Details / Description</label>
                <textarea value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })}
                  rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-300 resize-none" />
              </div>
              {formData.type === 'Night Stay' && (
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Night Stay Pricing</div>
                  <OccupancyPricing label="Single Occupancy"
                    costKey="purchasePriceSingle" marginKey="marginSingle" sellKey="singlePrice"
                    formData={formData} setFormData={setFormData} />
                  <OccupancyPricing label="Double Occupancy"
                    costKey="purchasePriceDouble" marginKey="marginDouble" sellKey="doublePrice"
                    formData={formData} setFormData={setFormData} />
                  <OccupancyPricing label="Triple Occupancy"
                    costKey="purchasePriceTriple" marginKey="marginTriple" sellKey="triplePrice"
                    formData={formData} setFormData={setFormData} />
                  <OccupancyPricing label="Quad Occupancy"
                    costKey="purchasePriceQuad" marginKey="marginQuad" sellKey="quadPrice"
                    formData={formData} setFormData={setFormData} />

                  {/* ── Room Categories (e.g. Premium, Luxury) ── */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Room Categories</div>
                        <div className="text-[9px] text-indigo-400 mt-0.5">e.g. Premium, Luxury — each with Single / Double / Triple pricing</div>
                      </div>
                      <button type="button"
                        onClick={() => setFormData({
                          ...formData,
                          roomCategories: [...(formData.roomCategories || []), {
                            name: '', 
                            purchasePriceSingle: '', marginSingle: 15, singlePrice: '',
                            purchasePriceDouble: '', marginDouble: 15, doublePrice: '',
                            purchasePriceTriple: '', marginTriple: 15, triplePrice: '',
                          }],
                        })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                        <Plus size={11} /> Add Category
                      </button>
                    </div>
                    {(formData.roomCategories || []).length === 0 && (
                      <div className="text-[10px] text-slate-300 italic text-center py-2 bg-white border border-dashed border-indigo-100 rounded-xl">No extra categories — Base pricing above is always shown</div>
                    )}
                    {(formData.roomCategories || []).map((rc, rci) => {
                      const setRc = (field, val) => {
                        const next = (formData.roomCategories || []).map((c, i) => {
                          if (i !== rci) return c;
                          const updated = { ...c, [field]: val };
                          // Auto-recalc sell prices when cost or margin changes
                          if (field === 'purchasePriceSingle' || field === 'marginSingle')
                            updated.singlePrice = calcSell(field === 'purchasePriceSingle' ? val : c.purchasePriceSingle, field === 'marginSingle' ? val : c.marginSingle);
                          if (field === 'purchasePriceDouble' || field === 'marginDouble')
                            updated.doublePrice = calcSell(field === 'purchasePriceDouble' ? val : c.purchasePriceDouble, field === 'marginDouble' ? val : c.marginDouble);
                          if (field === 'purchasePriceTriple' || field === 'marginTriple')
                            updated.triplePrice = calcSell(field === 'purchasePriceTriple' ? val : c.purchasePriceTriple, field === 'marginTriple' ? val : c.marginTriple);
                          return updated;
                        });
                        setFormData({ ...formData, roomCategories: next });
                      };
                      return (
                        <div key={rci} className="bg-white border border-indigo-200 rounded-xl p-3 space-y-3 mb-3">
                          {/* Category header row */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Category Name</label>
                              <input value={rc.name} onChange={e => setRc('name', e.target.value)}
                                placeholder="e.g. Premium, Luxury, Deluxe…"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-indigo-300 transition-colors" />
                            </div>
                            <button type="button"
                              onClick={() => setFormData({ ...formData, roomCategories: (formData.roomCategories || []).filter((_, i) => i !== rci) })}
                              className="mt-4 p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {/* 3 occupancy rows */}
                          {[
                            { label: 'Single', costKey: 'purchasePriceSingle', marginKey: 'marginSingle', sellKey: 'singlePrice' },
                            { label: 'Double', costKey: 'purchasePriceDouble', marginKey: 'marginDouble', sellKey: 'doublePrice' },
                            { label: 'Triple', costKey: 'purchasePriceTriple', marginKey: 'marginTriple', sellKey: 'triplePrice' },
                          ].map(({ label, costKey, marginKey, sellKey }) => (
                            <div key={sellKey} className="bg-slate-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                              <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{label} Occupancy</div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cost price</label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={rc[costKey]}
                                      onChange={e => setRc(costKey, e.target.value.replace(/[^0-9]/g, ''))}
                                      className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-300 transition-colors" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Margin %</label>
                                  <div className="relative">
                                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={rc[marginKey]}
                                      onChange={e => setRc(marginKey, e.target.value.replace(/[^0-9]/g, ''))}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-2 pr-6 py-1.5 text-sm font-bold outline-none focus:border-indigo-300 transition-colors text-center" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sell price</label>
                                  <div className="relative bg-indigo-50 border border-indigo-200 rounded-lg px-2 pl-5 py-1.5 flex items-center">
                                    <span className="absolute left-2 text-indigo-400 text-xs font-bold">₹</span>
                                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={rc[sellKey]}
                                      onChange={e => setRc(sellKey, e.target.value.replace(/[^0-9]/g, ''))}
                                      className="w-full bg-transparent text-sm font-black text-indigo-700 outline-none" />
                                  </div>
                                  <div className="text-[8px] text-slate-300 mt-0.5">Auto-calc · editable</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Shared Add-on Margin ── */}
                  <div className="bg-indigo-100 border border-indigo-200 rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">Add-on Margin %</div>
                      <div className="text-[9px] text-indigo-500">Applied to all standard & custom add-ons below</div>
                    </div>
                    <div className="relative w-24">
                      <input type="text" inputMode="numeric" value={formData.addonMargin}
                        onChange={e => {
                          const m = e.target.value.replace(/[^0-9]/g, '');
                          // Recalculate all standard addon sell prices
                          const recalc = (purchase) => purchase ? Math.ceil(Number(purchase) * (1 + Number(m) / 100)).toString() : '';
                          const updatedAdhoc = (formData.adhocAddons || []).map(a => ({
                            ...a, sellingPrice: recalc(a.purchasePrice),
                          }));
                          setFormData({
                            ...formData,
                            addonMargin:    m,
                            djCost:         recalc(formData.purchaseDJ),
                            licenseFeeDJ:   recalc(formData.purchaseLicenseFeeDJ),
                            cocktailSnacks: recalc(formData.purchaseCocktailSnacks),
                            banquetHall:    recalc(formData.purchaseBanquetHall),
                            adhocAddons:    updatedAdhoc,
                          });
                        }}
                        className="w-full bg-white border border-indigo-300 rounded-lg px-2 pr-6 py-1.5 text-sm font-black text-indigo-700 outline-none text-center focus:border-indigo-500 transition-colors" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold">%</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest pt-1">Standard Add-ons</div>
                  <div className="space-y-3">
                    {[
                      { label:'DJ',               costKey:'purchaseDJ',             sellKey:'djCost',         ppKey:'djCostPerPerson',         defaultPP: false },
                      { label:'DJ License Fee',   costKey:'purchaseLicenseFeeDJ',   sellKey:'licenseFeeDJ',   ppKey:'licenseFeeDJPerPerson',   defaultPP: false },
                      { label:'Cocktails & Snacks',costKey:'purchaseCocktailSnacks',sellKey:'cocktailSnacks', ppKey:'cocktailSnacksPerPerson', defaultPP: true  },
                      { label:'Banquet Hall',      costKey:'purchaseBanquetHall',   sellKey:'banquetHall',    ppKey:'banquetHallPerPerson',    defaultPP: false },
                    ].map(({ label, costKey, sellKey, ppKey, defaultPP }) => (
                      <div key={ppKey} className="bg-white border border-indigo-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{label}</span>
                          {/* Per-person toggle — only visible when a sell price is set */}
                          {Number(formData[sellKey]) > 0 && (
                            <button type="button"
                              onClick={() => setFormData({ ...formData, [ppKey]: !formData[ppKey] })}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                                formData[ppKey]
                                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>
                              {formData[ppKey] ? '👤 Per person' : '🏠 Flat rate'}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cost price</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                              <input type="text" inputMode="numeric" pattern="[0-9]*"
                                value={formData[costKey]}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  setFormData({ ...formData, [costKey]: v, [sellKey]: calcSell(v, formData.addonMargin) });
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-300 transition-colors" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Margin %</label>
                            <div className="relative">
                              <input type="text" readOnly value={formData.addonMargin}
                                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 pr-6 py-1.5 text-sm font-bold text-slate-400 text-center cursor-not-allowed" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sell price</label>
                            <div className="relative bg-indigo-50 border border-indigo-200 rounded-lg px-2 pl-5 py-1.5 flex items-center">
                              <span className="absolute left-2 text-indigo-400 text-xs font-bold">₹</span>
                              <input type="text" inputMode="numeric" pattern="[0-9]*"
                                value={formData[sellKey]}
                                onChange={e => setFormData({ ...formData, [sellKey]: e.target.value.replace(/[^0-9]/g, '') })}
                                className="w-full bg-transparent text-sm font-black text-indigo-700 outline-none" />
                            </div>
                            <div className="text-[8px] text-slate-300 mt-0.5">Auto-calc · editable</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Adhoc Add-ons ── */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Custom Add-ons</div>
                    <button type="button"
                      onClick={() => setFormData({
                        ...formData,
                        adhocAddons: [...(formData.adhocAddons || []), { name: '', purchasePrice: '', sellingPrice: '' }],
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {(formData.adhocAddons || []).length === 0 && (
                    <div className="text-[10px] text-slate-300 italic text-center py-2">No custom add-ons yet — click Add to create one</div>
                  )}
                  {(formData.adhocAddons || []).map((addon, ai) => {
                    const setAddon = (field, val) => {
                      const next = formData.adhocAddons.map((a, i) => {
                        if (i !== ai) return a;
                        const updated = { ...a, [field]: val };
                        if (field === 'purchasePrice') {
                          updated.sellingPrice = calcSell(val, formData.addonMargin);
                        }
                        return updated;
                      });
                      setFormData({ ...formData, adhocAddons: next });
                    };
                    return (
                      <div key={ai} className="bg-white border border-indigo-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Add-on {ai + 1}</span>
                          <div className="flex items-center gap-2">
                            {/* Per-person toggle — only visible when a sell price is set */}
                            {Number(addon.sellingPrice) > 0 && (
                              <button type="button"
                                onClick={() => setAddon('perPerson', !addon.perPerson)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                                  addon.perPerson
                                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                {addon.perPerson ? '👤 Per person' : '🏠 Flat rate'}
                              </button>
                            )}
                            <button type="button" onClick={() => setFormData({ ...formData, adhocAddons: formData.adhocAddons.filter((_, i) => i !== ai) })}
                              className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Add-on Name</label>
                          <input value={addon.name} onChange={e => setAddon('name', e.target.value)}
                            placeholder="e.g. Barbeque, Bonfire, Bonfire + DJ..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-300 transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cost Price</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                              <input type="text" inputMode="numeric" value={addon.purchasePrice}
                                onChange={e => setAddon('purchasePrice', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-300 transition-colors" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sell Price</label>
                            <div className="relative bg-indigo-50 border border-indigo-200 rounded-lg pl-5 pr-2 py-1.5 flex items-center">
                              <span className="absolute left-2 text-indigo-400 text-xs font-bold">₹</span>
                              <input type="text" inputMode="numeric" value={addon.sellingPrice}
                                onChange={e => setAddon('sellingPrice', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-transparent text-sm font-black text-indigo-700 outline-none" />
                            </div>
                            <div className="text-[8px] text-slate-300 mt-0.5">Auto-calc · editable</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {formData.type === 'Day Outing' && (
                <div className="bg-amber-50 rounded-xl p-4 space-y-4">
                  {/* Header + Add button */}
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                      Day Packages ({(formData.dayPackages || []).length})
                    </div>
                    <button type="button"
                      onClick={() => setFormData({
                        ...formData,
                        dayPackages: [...(formData.dayPackages || []),
                          { name: '', activities: '', purchasePrice: '', margin: 15, sellingPrice: '' }]
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                      <Plus size={11} /> Add Package
                    </button>
                  </div>

                  {/* Package rows */}
                  {(formData.dayPackages || []).map((pkg, idx) => {
                    const setPkg = (field, val) => {
                      const next = formData.dayPackages.map((p, i) => {
                        if (i !== idx) return p;
                        const updated = { ...p, [field]: val };
                        if (field === 'purchasePrice' || field === 'margin') {
                          const cost = field === 'purchasePrice' ? val : p.purchasePrice;
                          const mrg  = field === 'margin'        ? val : p.margin;
                          updated.sellingPrice = calcSell(cost, mrg);
                        }
                        return updated;
                      });
                      setFormData({ ...formData, dayPackages: next });
                    };
                    return (
                      <div key={idx} className="bg-white border border-amber-200 rounded-xl p-3 space-y-3">
                        {/* Package header */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Package {idx + 1}</span>
                          {(formData.dayPackages || []).length > 1 && (
                            <button type="button"
                              onClick={() => setFormData({ ...formData, dayPackages: formData.dayPackages.filter((_, i) => i !== idx) })}
                              className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        {/* Package name */}
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Package name</label>
                          <input value={pkg.name} onChange={e => setPkg('name', e.target.value)}
                            placeholder="e.g. Basic, Premium, Corporate..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-amber-300 transition-colors" />
                        </div>
                        {/* Activities */}
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Activities included</label>
                          <textarea value={pkg.activities} onChange={e => setPkg('activities', e.target.value)}
                            placeholder="e.g. Breakfast, Pool access, Bonfire, Nature walk, Buffet lunch..."
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-amber-300 transition-colors resize-none" />
                        </div>
                        {/* Pricing — cost / margin / sell */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cost price</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                              <input type="text" inputMode="numeric" value={pkg.purchasePrice}
                                onChange={e => setPkg('purchasePrice', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold outline-none focus:border-amber-300 transition-colors" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Margin %</label>
                            <div className="relative">
                              <input type="text" inputMode="numeric" value={pkg.margin}
                                onChange={e => setPkg('margin', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 pr-6 py-1.5 text-sm font-bold outline-none focus:border-amber-300 text-center transition-colors" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sell price</label>
                            <div className="relative bg-amber-50 border border-amber-200 rounded-lg pl-5 pr-2 py-1.5 flex items-center">
                              <span className="absolute left-2 text-amber-400 text-xs font-bold">₹</span>
                              <input type="text" inputMode="numeric" value={pkg.sellingPrice}
                                onChange={e => setPkg('sellingPrice', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-transparent text-sm font-black text-amber-700 outline-none" />
                            </div>
                            <div className="text-[8px] text-slate-300 mt-0.5">Auto-calc · editable</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* ── Shared Add-on Margin ── */}
                  <div className="bg-amber-100 border border-amber-200 rounded-xl p-3 flex items-center gap-3 mt-1">
                    <div className="flex-1">
                      <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Add-on Margin %</div>
                      <div className="text-[9px] text-amber-500">Applied to all standard & custom add-ons below</div>
                    </div>
                    <div className="relative w-24">
                      <input type="text" inputMode="numeric" value={formData.addonMargin}
                        onChange={e => {
                          const m = e.target.value.replace(/[^0-9]/g, '');
                          const recalc = (purchase) => purchase ? Math.ceil(Number(purchase) * (1 + Number(m) / 100)).toString() : '';
                          const updatedAdhoc = (formData.adhocAddons || []).map(a => ({
                            ...a, sellingPrice: recalc(a.purchasePrice),
                          }));
                          setFormData({
                            ...formData,
                            addonMargin:    m,
                            djCost:         recalc(formData.purchaseDJ),
                            licenseFeeDJ:   recalc(formData.purchaseLicenseFeeDJ),
                            cocktailSnacks: recalc(formData.purchaseCocktailSnacks),
                            banquetHall:    recalc(formData.purchaseBanquetHall),
                            adhocAddons:    updatedAdhoc,
                          });
                        }}
                        className="w-full bg-white border border-amber-300 rounded-lg px-2 pr-6 py-1.5 text-sm font-black text-amber-700 outline-none text-center focus:border-amber-500 transition-colors" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400 text-xs font-bold">%</span>
                    </div>
                  </div>

                  {/* Standard Add-ons */}
                  <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest pt-1">Standard Add-ons</div>
                  <div className="space-y-3">
                    {[
                      { label:'DJ',               costKey:'purchaseDJ',             sellKey:'djCost',         ppKey:'djCostPerPerson',         defaultPP: false },
                      { label:'DJ License Fee',   costKey:'purchaseLicenseFeeDJ',   sellKey:'licenseFeeDJ',   ppKey:'licenseFeeDJPerPerson',   defaultPP: false },
                      { label:'Cocktails & Snacks',costKey:'purchaseCocktailSnacks',sellKey:'cocktailSnacks', ppKey:'cocktailSnacksPerPerson', defaultPP: true  },
                      { label:'Banquet Hall',      costKey:'purchaseBanquetHall',   sellKey:'banquetHall',    ppKey:'banquetHallPerPerson',    defaultPP: false },
                    ].map(({ label, costKey, sellKey, ppKey }) => (
                      <div key={ppKey} className="bg-white border border-amber-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{label}</span>
                          {Number(formData[sellKey]) > 0 && (
                            <button type="button"
                              onClick={() => setFormData({ ...formData, [ppKey]: !formData[ppKey] })}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                                formData[ppKey]
                                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>
                              {formData[ppKey] ? '👤 Per person' : '🏠 Flat rate'}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cost price</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                              <input type="text" inputMode="numeric" pattern="[0-9]*"
                                value={formData[costKey]}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  setFormData({ ...formData, [costKey]: v, [sellKey]: calcSell(v, formData.addonMargin) });
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold outline-none focus:border-amber-300 transition-colors" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Margin %</label>
                            <div className="relative">
                              <input type="text" readOnly value={formData.addonMargin}
                                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 pr-6 py-1.5 text-sm font-bold text-slate-400 text-center cursor-not-allowed" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sell price</label>
                            <div className="relative bg-amber-50 border border-amber-200 rounded-lg px-2 pl-5 py-1.5 flex items-center">
                              <span className="absolute left-2 text-amber-400 text-xs font-bold">₹</span>
                              <input type="text" inputMode="numeric" pattern="[0-9]*"
                                value={formData[sellKey]}
                                onChange={e => setFormData({ ...formData, [sellKey]: e.target.value.replace(/[^0-9]/g, '') })}
                                className="w-full bg-transparent text-sm font-black text-amber-700 outline-none" />
                            </div>
                            <div className="text-[8px] text-slate-300 mt-0.5">Auto-calc · editable</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Adhoc Add-ons ── */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Custom Add-ons</div>
                    <button type="button"
                      onClick={() => setFormData({
                        ...formData,
                        adhocAddons: [...(formData.adhocAddons || []), { name: '', purchasePrice: '', sellingPrice: '' }],
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {(formData.adhocAddons || []).length === 0 && (
                    <div className="text-[10px] text-slate-300 italic text-center py-2">No custom add-ons yet — click Add to create one</div>
                  )}
                  {(formData.adhocAddons || []).map((addon, ai) => {
                    const setAddon = (field, val) => {
                      const next = formData.adhocAddons.map((a, i) => {
                        if (i !== ai) return a;
                        const updated = { ...a, [field]: val };
                        if (field === 'purchasePrice') updated.sellingPrice = calcSell(val, formData.addonMargin);
                        return updated;
                      });
                      setFormData({ ...formData, adhocAddons: next });
                    };
                    return (
                      <div key={ai} className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Add-on {ai + 1}</span>
                          <div className="flex items-center gap-2">
                            {Number(addon.sellingPrice) > 0 && (
                              <button type="button"
                                onClick={() => setAddon('perPerson', !addon.perPerson)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                                  addon.perPerson
                                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                {addon.perPerson ? '👤 Per person' : '🏠 Flat rate'}
                              </button>
                            )}
                            <button type="button" onClick={() => setFormData({ ...formData, adhocAddons: formData.adhocAddons.filter((_, i) => i !== ai) })}
                              className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Add-on Name</label>
                          <input value={addon.name} onChange={e => setAddon('name', e.target.value)}
                            placeholder="e.g. Barbeque, Bonfire, Guided trek..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-amber-300 transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cost Price</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                              <input type="text" inputMode="numeric" value={addon.purchasePrice}
                                onChange={e => setAddon('purchasePrice', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold outline-none focus:border-amber-300 transition-colors" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sell Price</label>
                            <div className="relative bg-amber-50 border border-amber-200 rounded-lg pl-5 pr-2 py-1.5 flex items-center">
                              <span className="absolute left-2 text-amber-400 text-xs font-bold">₹</span>
                              <input type="text" inputMode="numeric" value={addon.sellingPrice}
                                onChange={e => setAddon('sellingPrice', e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full bg-transparent text-sm font-black text-amber-700 outline-none" />
                            </div>
                            <div className="text-[8px] text-slate-300 mt-0.5">Auto-calc · editable</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Attachments ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Paperclip size={11} /> Attachments
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">PDFs, brochures, menus — visible to client in the portal</div>
                  </div>
                  <button type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={uploadingAttachment}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase transition-colors">
                    {uploadingAttachment
                      ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Uploading…</>
                      : <><Upload size={11} /> Upload</>
                    }
                  </button>
                  <input ref={attachmentInputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.ppt,.pptx"
                    style={{ position: 'fixed', top: -200, left: -200, width: 1, height: 1, opacity: 0 }}
                    onChange={e => { handleAttachmentUpload(e.target.files); e.target.value = ''; }} />
                </div>
                {(formData.attachments || []).length === 0 && (
                  <div className="text-[10px] text-slate-300 italic text-center py-2">No attachments yet</div>
                )}
                <div className="space-y-2">
                  {(formData.attachments || []).map((att, ai) => (
                    <div key={ai} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2">
                      <FileText size={13} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700 truncate">{att.name}</div>
                        {att.size > 0 && <div className="text-[9px] text-slate-400">{att.size > 1048576 ? `${(att.size / 1048576).toFixed(1)} MB` : `${Math.round(att.size / 1024)} KB`}</div>}
                      </div>
                      <a href={att.url} target="_blank" rel="noreferrer"
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex-shrink-0 px-2">View</a>
                      <button type="button" onClick={() => setFormData({ ...formData, attachments: formData.attachments.filter((_, i) => i !== ai) })}
                        className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => { setShowModal(false); resetForm(); }} className="px-6 py-2 text-slate-400 font-bold uppercase text-xs">Cancel</button>
              <button onClick={handleSave} className="px-10 py-3 bg-orange-500 text-white rounded-xl font-black uppercase text-xs hover:bg-orange-600 shadow-lg">
                {isEditing ? 'Update Property' : 'Save Property'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyList;