/**
 * hooks/usePortalItems.js
 *
 * Shared hook used by ProductList (type='product') and PropertyList (type='offsite').
 *
 * MODAL FEATURES:
 *  - Search bar filters the orders list in real time
 *  - Each order row is expandable — shows items already in that portal
 *  - Each existing item can be deleted (removed from portal immediately)
 *  - "Add N" button on each row appends the pending selection to that portal
 *
 * addToPortal(items) — call with the array of selected products OR properties.
 * PortalModal        — render this somewhere in the page JSX (fixed overlay).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import api from '../api';
import {
  X, Check, Loader2, Link2, Search, ChevronDown,
  Plus, Trash2, Package, AlertCircle, ImagePlus, ChevronUp,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Mappers  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
const mapPropertyToOffsiteItem = (p) => ({
  propertyId:     p._id?.toString() || '',
  name:           p.propertyName   || p.name || '',
  location:       [p.place, p.state].filter(Boolean).join(', '),
  imageUrl:       p.imageUrl       || '',
  website:        p.website        || '',
  youtubeUrl:     p.youtubeUrl     || '',
  details:        p.details        || '',
  type:           p.type           || 'Night Stay',
  singlePrice:    Number(p.singlePrice)  || 0,
  doublePrice:    Number(p.doublePrice)  || 0,
  triplePrice:    Number(p.triplePrice)  || 0,
  quadPrice:      Number(p.quadPrice)    || 0,
  packagePrice:   Number(p.packagePrice) || 0,
  djCost:         Number(p.djCost)         || 0,
  licenseFeeDJ:   Number(p.licenseFeeDJ)   || 0,
  cocktailSnacks: Number(p.cocktailSnacks) || 0,
  banquetHall:    Number(p.banquetHall)    || 0,
  adhocAddons: (p.adhocAddons || [])
    .filter(a => a.name && a.sellingPrice > 0)
    .map(a => ({ name: a.name, sellingPrice: Number(a.sellingPrice) || 0 })),
  dayPackages: (p.dayPackages || []).map(pkg => ({
    name:         pkg.name         || '',
    activities:   pkg.activities   || '',
    sellingPrice: Number(pkg.sellingPrice) || 0,
  })),
  attachments: (p.attachments || []).map(att => ({
    name:     att.name     || '',
    url:      att.url      || '',
    mimeType: att.mimeType || 'application/octet-stream',
    size:     att.size     || 0,
  })),
  note:  p.note  || '',
  order: p.order || 0,
});

const calcSell = (purchase, markup) => {
  const p = parseFloat(purchase || 0);
  const m = parseFloat(markup   || 0);
  return Math.round(p + p * m / 100);
};

const mapProductToItem = (p) => ({
  productId:        p._id?.toString() || '',
  name:             p.name            || '',
  description:      p.description     || '',
  imageUrl:         p.imageUrl        || '',
  additionalImages: Array.isArray(p.additionalImages) ? p.additionalImages : [],
  videoUrl:         p.videoUrl        || '',
  price:            p.price != null
    ? Number(p.price)
    : calcSell(p.purchasePrice, p.markupPercent),
  category:         p.category    || '',
  subCategory:      p.subCategory || '',
  note:             p.note        || '',
  order:            p.order       || 0,
});

// ─────────────────────────────────────────────────────────────────────────────
// PortalItemChip — thumbnail + name + delete button inside an expanded row
// ─────────────────────────────────────────────────────────────────────────────
const PortalItemChip = ({ item, onDelete, deleting }) => (
  <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-2 py-1.5 group shadow-sm">
    {item.imageUrl ? (
      <img
        src={item.imageUrl}
        alt={item.name}
        className="w-7 h-7 rounded-lg object-cover flex-shrink-0 bg-gray-100"
      />
    ) : (
      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Package size={11} className="text-gray-300" />
      </div>
    )}
    <span className="text-[10px] font-bold text-gray-600 truncate flex-1 max-w-[120px]">
      {item.name || '—'}
    </span>
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      disabled={deleting}
      title="Remove from portal"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-500 text-gray-300 flex-shrink-0 disabled:cursor-not-allowed"
    >
      {deleting
        ? <Loader2 size={11} className="animate-spin text-gray-400" />
        : <Trash2 size={11} />}
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
const usePortalItems = (type) => {
  const [open, setOpen]               = useState(false);
  const [portals, setPortals]         = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [fetchError, setFetchError]   = useState(null);
  const [pendingItems, setPendingItems] = useState([]);

  // Search
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  // Expanded rows  { [portalId]: bool }
  const [expanded, setExpanded] = useState({});

  // Per-portal "adding" spinner  { [portalId]: bool }
  const [adding, setAdding] = useState({});

  // Per-portal "just added" flash { [portalId]: bool }
  const [addedFlash, setAddedFlash] = useState({});

  // Per-item "deleting" spinner  { [`${portalId}__${itemKey}`]: bool }
  const [deletingItem, setDeletingItem] = useState({});

  // ── Custom item form (product portal only) ────────────────────────────────
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ name:'', description:'', price:'' });
  const [customImage, setCustomImage] = useState(null);   // File object
  const [customImagePreview, setCustomImagePreview] = useState(null);
  const [customTarget, setCustomTarget] = useState(null); // portal to add into
  const [savingCustom, setSavingCustom] = useState(false);
  const customImageRef = React.useRef(null);

  const resetCustomForm = () => {
    setCustomForm({ name:'', description:'', price:'' });
    setCustomImage(null);
    setCustomImagePreview(null);
    setCustomTarget(null);
    setShowCustomForm(false);
  };

  const handleCustomImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCustomImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Upload the custom image to /uploads then add item to portal
  const handleSaveCustomItem = async () => {
    if (!customForm.name.trim()) return;
    if (!customTarget) return;
    setSavingCustom(true);
    try {
      let imageUrl = '';
      if (customImage) {
        const fd = new FormData();
        fd.append('image', customImage);
        // Use the product upload endpoint — returns { imageUrl }
        const upRes = await api.post('/products/upload-temp-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrl = upRes.data?.imageUrl || '';
      }

      const newItem = {
        productId:   '',   // no DB product — discussion-only
        name:        customForm.name.trim(),
        description: customForm.description.trim(),
        imageUrl,
        price:       customForm.price !== '' ? Number(customForm.price) : 0,
        category:    'Custom',
        subCategory: '',
        note:        '',
        order:       0,
      };

      const existing = customTarget.productItems || [];
      const updated  = { productItems: [...existing, newItem] };
      await api.put(`/portal/${customTarget.slug}/items`, updated);

      // Flash "Added!" and refresh portals list
      setAddedFlash(p => ({ ...p, [customTarget._id]: true }));
      setTimeout(() => setAddedFlash(p => ({ ...p, [customTarget._id]: false })), 2000);
      await fetchPortals();
      resetCustomForm();
    } catch (err) {
      alert('Failed to add custom item: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingCustom(false);
    }
  };

  // ── key helpers ───────────────────────────────────────────────────────────
  const itemsKey = () => type === 'offsite' ? 'offsiteItems' : 'productItems';
  const itemId   = (item) => type === 'offsite' ? item.propertyId : item.productId;

  // ── open modal ────────────────────────────────────────────────────────────
  const addToPortal = useCallback(async (items) => {
    if (!items || items.length === 0) return;
    setPendingItems(items);
    setSearch('');
    setExpanded({});
    setAdding({});
    setAddedFlash({});
    setDeletingItem({});
    setFetchError(null);
    setOpen(true);
  }, []);

  // ── fetch portals when modal opens ───────────────────────────────────────
  const fetchPortals = useCallback(async () => {
    setLoadingList(true);
    setFetchError(null);
    try {
      const res  = await api.get(`/portal?type=${type}&status=active`);
      const list = (res.data || []).filter(
        p => !p.orderStatus || ['inquiry', 'ongoing', 'unknown'].includes(p.orderStatus)
      );
      setPortals(list);
    } catch (err) {
      setFetchError(err.response?.data?.message || err.message || 'Failed to load portals');
      setPortals([]);
    } finally {
      setLoadingList(false);
    }
  }, [type]);

  useEffect(() => {
    if (open) {
      fetchPortals();
      setTimeout(() => searchRef.current?.focus(), 120);
    }
  }, [open, fetchPortals]);

  // ── filtered list ─────────────────────────────────────────────────────────
  const filteredPortals = portals.filter(portal => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (portal.title         || '').toLowerCase().includes(q) ||
      (portal.orderRef      || '').toLowerCase().includes(q) ||
      (portal.clientName    || '').toLowerCase().includes(q) ||
      (portal.orderPlacedBy || '').toLowerCase().includes(q)
    );
  });

  // ── toggle expand ─────────────────────────────────────────────────────────
  const toggleExpand = (portalId) =>
    setExpanded(prev => ({ ...prev, [portalId]: !prev[portalId] }));

  // ── add pending items to a portal ─────────────────────────────────────────
  const handleAdd = async (portal) => {
    if (adding[portal._id]) return;
    setAdding(prev => ({ ...prev, [portal._id]: true }));
    try {
      const key         = itemsKey();
      const existing    = portal[key] || [];
      const existingIds = new Set(existing.map(itemId));
      const newItems    = pendingItems
        .filter(p => !existingIds.has(p._id?.toString()))
        .map(type === 'offsite' ? mapPropertyToOffsiteItem : mapProductToItem);

      const merged  = [...existing, ...newItems];
      const payload = { [key]: merged };
      await api.put(`/portal/${portal.slug}/items`, payload);

      if (type === 'product') {
        try { await api.post(`/portal/${portal.slug}/sync-products`); } catch {}
      }

      // Optimistically update local portal state
      setPortals(prev => prev.map(p =>
        p._id === portal._id ? { ...p, [key]: merged } : p
      ));

      // Flash success + auto-expand so user sees the new items
      setAddedFlash(prev => ({ ...prev, [portal._id]: true }));
      setExpanded(prev => ({ ...prev, [portal._id]: true }));
      setTimeout(() =>
        setAddedFlash(prev => ({ ...prev, [portal._id]: false })), 2200
      );
    } catch (err) {
      alert('Failed to add to portal: ' + (err.response?.data?.message || err.message));
    } finally {
      setAdding(prev => ({ ...prev, [portal._id]: false }));
    }
  };

  // ── delete a single existing item from a portal ───────────────────────────
  const handleDeleteItem = async (portal, item) => {
    const chipKey = `${portal._id}__${itemId(item)}`;
    if (deletingItem[chipKey]) return;
    setDeletingItem(prev => ({ ...prev, [chipKey]: true }));
    try {
      const key     = itemsKey();
      const updated = (portal[key] || []).filter(i => itemId(i) !== itemId(item));
      await api.put(`/portal/${portal.slug}/items`, { [key]: updated });

      setPortals(prev => prev.map(p =>
        p._id === portal._id ? { ...p, [key]: updated } : p
      ));
    } catch (err) {
      alert('Failed to remove item: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeletingItem(prev => ({ ...prev, [chipKey]: false }));
    }
  };

  // ── Modal ─────────────────────────────────────────────────────────────────
  const PortalModal = () => {
    if (!open) return null;

    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        onClick={() => setOpen(false)}
      >
        <div
          className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '88vh', animation: 'portalModalUp 0.28s cubic-bezier(0.16,1,0.3,1) forwards' }}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="px-6 py-5 border-b flex items-start justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                <Link2 size={16} className="text-orange-500" /> Add to Portal
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} selected
                {' · '}
                {type === 'offsite' ? 'Offsite' : 'Product'} portals
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors mt-0.5 flex-shrink-0"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* ── Search bar ─────────────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by order / client name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 bg-gray-50 placeholder:font-normal placeholder:text-gray-300 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* ── Order rows ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 min-h-0">

            {/* Loading */}
            {loadingList && (
              <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-bold">Loading portals…</span>
              </div>
            )}

            {/* Error */}
            {!loadingList && fetchError && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 mt-1">
                <AlertCircle size={15} className="flex-shrink-0" />
                <p className="text-xs font-bold">{fetchError}</p>
              </div>
            )}

            {/* Empty */}
            {!loadingList && !fetchError && filteredPortals.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-gray-400 font-bold">
                  {search ? 'No orders match your search.' : `No active ${type} portals found.`}
                </p>
                {!search && (
                  <p className="text-xs text-gray-300 mt-1">Create a portal from the Orders page first.</p>
                )}
              </div>
            )}

            {/* Portal rows */}
            {!loadingList && !fetchError && filteredPortals.map(portal => {
              const key        = itemsKey();
              const items      = portal[key] || [];
              const isExpanded = !!expanded[portal._id];
              const isAdding   = !!adding[portal._id];
              const didAdd     = !!addedFlash[portal._id];

              // Count how many pending items aren't already in this portal
              const existingIds = new Set(items.map(itemId));
              const newCount    = pendingItems.filter(
                p => !existingIds.has(p._id?.toString())
              ).length;
              const allAlready  = newCount === 0;

              return (
                <div
                  key={portal._id}
                  className="border border-gray-100 rounded-2xl overflow-hidden bg-white transition-shadow hover:shadow-sm"
                >
                  {/* ── Row header ── */}
                  <div className="flex items-center gap-3 px-4 py-3">

                    {/* Expand chevron */}
                    <button
                      onClick={() => toggleExpand(portal._id)}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors rounded-lg hover:bg-gray-50"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Order info — clicking also expands */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggleExpand(portal._id)}
                    >
                      <div className="font-black text-gray-800 text-xs uppercase truncate leading-tight">
                        {portal.title || portal.orderRef || '—'}
                      </div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5 flex items-center gap-1 flex-wrap">
                        {portal.orderRef && (
                          <span className="text-indigo-400">{portal.orderRef}</span>
                        )}
                        {portal.orderRef && portal.clientName && (
                          <span className="text-gray-200">·</span>
                        )}
                        {portal.clientName && <span>{portal.clientName}</span>}
                        {portal.orderPlacedBy && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-gray-400">by {portal.orderPlacedBy}</span>
                          </>
                        )}
                        <span className="text-gray-200">·</span>
                        <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => handleAdd(portal)}
                      disabled={isAdding || allAlready}
                      title={allAlready ? 'All selected items already in this portal' : `Add ${newCount} item${newCount !== 1 ? 's' : ''}`}
                      className={[
                        'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all',
                        didAdd
                          ? 'bg-green-500 text-white'
                          : allAlready
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow-md',
                      ].join(' ')}
                    >
                      {isAdding ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : didAdd ? (
                        <Check size={10} />
                      ) : (
                        <Plus size={10} />
                      )}
                      <span>
                        {isAdding ? 'Adding…' : didAdd ? 'Added!' : `Add ${newCount}`}
                      </span>
                    </button>
                  </div>

                  {/* ── Expanded: items already in this portal ── */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-2 border-t border-gray-50 bg-gray-50/50">
                      {items.length === 0 ? (
                        <p className="text-[10px] text-gray-300 italic text-center py-3">
                          No items in this portal yet.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((item, idx) => {
                            const chipKey = `${portal._id}__${itemId(item)}`;
                            return (
                              <PortalItemChip
                                key={itemId(item) || idx}
                                item={item}
                                onDelete={() => handleDeleteItem(portal, item)}
                                deleting={!!deletingItem[chipKey]}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-3 border-t bg-gray-50 flex-shrink-0">
            <button
              onClick={() => setOpen(false)}
              className="w-full py-3 text-xs font-black uppercase text-gray-400 tracking-widest hover:text-gray-600 transition-colors rounded-xl hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>

        <style>{`
          @keyframes portalModalUp {
            from { transform: translateY(16px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>
      </div>
    );
  };

  return { addToPortal, PortalModal };
};

export default usePortalItems;