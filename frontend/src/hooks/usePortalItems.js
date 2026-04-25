/**
 * hooks/usePortalItems.js
 *
 * Shared hook used by ProductList (type='product') and PropertyList (type='offsite').
 * Renders a modal for picking an active portal, then PUTs the selected items into it.
 *
 * addToPortal(items) — call with the array of selected products OR properties.
 * PortalModal        — render this somewhere in the page JSX (it's a portal/fixed overlay).
 */

import React, { useState, useCallback } from 'react';
import api from '../api';
import { X, Check, Loader2, Link2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Map a raw Property document → offsiteItem snapshot stored in ClientPortal
// Only selling prices are stored — no purchase/cost data goes to the client.
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

  // Night Stay room pricing (selling prices only)
  singlePrice:    Number(p.singlePrice)  || 0,
  doublePrice:    Number(p.doublePrice)  || 0,
  triplePrice:    Number(p.triplePrice)  || 0,
  quadPrice:      Number(p.quadPrice)    || 0,

  // Day Outing flat price
  packagePrice:   Number(p.packagePrice) || 0,

  // Standard add-ons (selling prices only)
  djCost:         Number(p.djCost)         || 0,
  licenseFeeDJ:   Number(p.licenseFeeDJ)   || 0,
  cocktailSnacks: Number(p.cocktailSnacks) || 0,
  banquetHall:    Number(p.banquetHall)    || 0,

  // Adhoc add-ons — only name + sellingPrice exposed to client
  adhocAddons: (p.adhocAddons || [])
    .filter(a => a.name && a.sellingPrice > 0)
    .map(a => ({ name: a.name, sellingPrice: Number(a.sellingPrice) || 0 })),

  // Day packages — only name + activities + sellingPrice exposed
  dayPackages: (p.dayPackages || []).map(pkg => ({
    name:         pkg.name         || '',
    activities:   pkg.activities   || '',
    sellingPrice: Number(pkg.sellingPrice) || 0,
  })),

  // Property attachments shown to client
  attachments: (p.attachments || []).map(att => ({
    name:     att.name     || '',
    url:      att.url      || '',
    mimeType: att.mimeType || 'application/octet-stream',
    size:     att.size     || 0,
  })),

  note:  p.note  || '',
  order: p.order || 0,
});

// ─────────────────────────────────────────────────────────────────────────────
// Map a raw Product document → productItem snapshot
// ─────────────────────────────────────────────────────────────────────────────
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
  // Additional gallery angles — shown as a carousel in the client portal
  additionalImages: Array.isArray(p.additionalImages) ? p.additionalImages : [],
  // Video URL (YouTube / brand link) — embedded player in client portal
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
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
const usePortalItems = (type) => {
  const [open, setOpen]       = useState(false);
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [pendingItems, setPendingItems] = useState([]);

  // Open the modal and load active portals of the matching type
  const addToPortal = useCallback(async (items) => {
    if (!items || items.length === 0) return;
    setPendingItems(items);
    setOpen(true);
    setSaved(false);
    setLoading(true);
    try {
      const res = await api.get(`/portal?type=${type}&status=active`);
      // Only show portals whose linked order is inquiry/ongoing (not completed)
      const list = (res.data || []).filter(
        p => !p.orderStatus || ['inquiry', 'ongoing', 'unknown'].includes(p.orderStatus)
      );
      setPortals(list);
    } catch {
      setPortals([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  // User picks a portal — map items and PUT them in
  const handleSelect = async (portal) => {
    if (saving) return;
    setSaving(true);
    try {
      // Build the correctly-shaped items array
      let mapped;
      if (type === 'offsite') {
        // Merge incoming items with any existing items already in the portal
        const existing = portal.offsiteItems || [];
        const existingIds = new Set(existing.map(e => e.propertyId));
        const newItems = pendingItems
          .filter(p => !existingIds.has(p._id?.toString()))
          .map(mapPropertyToOffsiteItem);
        mapped = { offsiteItems: [...existing, ...newItems] };
      } else {
        const existing = portal.productItems || [];
        const existingIds = new Set(existing.map(e => e.productId));
        const newItems = pendingItems
          .filter(p => !existingIds.has(p._id?.toString()))
          .map(mapProductToItem);
        mapped = { productItems: [...existing, ...newItems] };
      }

      await api.put(`/portal/${portal.slug}/items`, mapped);

      // Auto-sync: pull latest additionalImages + videoUrl from Product docs
      // so the client portal immediately shows gallery images and video.
      if (type === 'product') {
        try { await api.post(`/portal/${portal.slug}/sync-products`); } catch {}
      }

      setSaved(true);
      setTimeout(() => { setOpen(false); setSaved(false); }, 1500);
    } catch (err) {
      alert('Failed to add to portal: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Modal JSX ──────────────────────────────────────────────────────────────
  const PortalModal = () => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="p-6 border-b flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                <Link2 size={16} className="text-orange-500" /> Add to Portal
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} · {type === 'offsite' ? 'Offsite' : 'Product'} portals
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto p-4 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-bold">Loading portals…</span>
              </div>
            )}

            {!loading && portals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400 font-bold">No active {type} portals found.</p>
                <p className="text-xs text-gray-300 mt-1">Create a portal from the Orders page first.</p>
              </div>
            )}

            {saved && (
              <div className="flex items-center justify-center gap-2 py-8 text-green-600">
                <Check size={22} className="text-green-500" />
                <span className="font-black text-sm uppercase tracking-widest">Added successfully!</span>
              </div>
            )}

            {!loading && !saved && portals.map(portal => (
              <button
                key={portal._id}
                disabled={saving}
                onClick={() => handleSelect(portal)}
                className="w-full text-left p-4 rounded-2xl hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-all flex justify-between items-center group disabled:opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-black text-gray-800 uppercase text-sm truncate group-hover:text-orange-600 transition-colors">
                    {portal.title || portal.orderRef}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                    {portal.clientName || portal.orderPlacedBy || '—'}
                    {' · '}
                    {type === 'offsite'
                      ? (portal.offsiteItems || []).length
                      : (portal.productItems || []).length} items
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-all flex-shrink-0 ml-3">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t">
            <button onClick={() => setOpen(false)} className="w-full py-3 text-xs font-black uppercase text-gray-400 tracking-widest hover:text-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { addToPortal, PortalModal };
};

export default usePortalItems;