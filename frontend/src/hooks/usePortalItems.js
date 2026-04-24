/**
 * frontend/src/hooks/usePortalItems.js
 *
 * Used by ProductList ('product') and PropertyList ('offsite').
 * - Shows active portals matching the type
 * - Add selected items to a portal
 * - View and DELETE items already in a portal
 */

import React, { useState } from 'react';
import api from '../api';

const usePortalItems = (type) => {
  const [open, setOpen]         = useState(false);
  const [portals, setPortals]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(null);
  const [done, setDone]         = useState(null);
  const [pending, setPending]   = useState([]);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch]     = useState('');

  const S = { spin: { width: 16, height: 16, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', display: 'inline-block', animation: 'pm-spin 0.7s linear infinite', flexShrink: 0 } };

  const close = () => { setOpen(false); setExpanded(null); setDone(null); setError(''); setSearch(''); };

  const loadPortals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/portal?type=${type}&status=active`);
      // Only show portals whose linked order is still in inquiry or ongoing state
      const active = (res.data || []).filter(p =>
        p.orderStatus === 'inquiry' || p.orderStatus === 'ongoing'
      );
      setPortals(active);
    } catch {
      setError(`Could not load portals. Make sure the backend is running.`);
      setPortals([]);
    } finally {
      setLoading(false);
    }
  };

  // Called when user clicks "Add to Portal" with items selected
  const addToPortal = (items) => {
    if (!items || items.length === 0) return;
    setPending(items);
    setDone(null);
    setExpanded(null);
    setOpen(true);
    loadPortals();
  };

  // Map selected items to portal schema and push to API
  const confirmAdd = async (portal) => {
    if (saving) return;
    setSaving(portal.slug);
    setError('');
    try {
      const key = type === 'product' ? 'productItems' : 'offsiteItems';
      const existing = portal[key] || [];
      const existingIds = new Set(existing.map(i => i.productId || i.propertyId).filter(Boolean));

      const mapped = pending
        .filter(p => !existingIds.has(p._id))
        .map(p => type === 'product'
          ? { productId: p._id, name: p.name || '', description: p.description || '', imageUrl: p.imageUrl || '', price: Number(p.price || 0), category: p.category || '' }
          : { propertyId: p._id, name: p.propertyName || p.name || '', location: p.place ? `${p.place}, ${p.state}` : '', imageUrl: p.imageUrl || '', website: p.website || '', details: p.details || '', type: p.type || 'Night Stay', singlePrice: Number(p.singlePrice || 0), doublePrice: Number(p.doublePrice || 0), triplePrice: Number(p.triplePrice || 0), packagePrice: Number(p.packagePrice || 0), djCost: Number(p.djCost || 0), licenseFeeDJ: Number(p.licenseFeeDJ || 0), cocktailSnacks: Number(p.cocktailSnacks || 0), banquetHall: Number(p.banquetHall || 0), note: p.note || '',
            dayPackages: (p.dayPackages || []).filter(pkg => pkg.name || pkg.sellingPrice).map(pkg => ({
              name:         pkg.name         || '',
              activities:   pkg.activities   || '',
              sellingPrice: Number(pkg.sellingPrice || 0),
            })) }
        );

      if (mapped.length === 0) {
        setError('All selected items are already in this portal.');
        setSaving(null);
        return;
      }

      const res = await api.put(`/portal/${portal.slug}/items`, { [key]: [...existing, ...mapped] });
      setPortals(prev => prev.map(p => p.slug === portal.slug ? { ...p, [key]: res.data[key] } : p));
      setDone(portal.slug);
      setTimeout(() => close(), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add items.');
    } finally {
      setSaving(null);
    }
  };

  // Remove a single item from a portal
  const removeItem = async (portal, itemId) => {
    const saveKey = `${portal.slug}__${itemId}`;
    setSaving(saveKey);
    setError('');
    try {
      const key = type === 'product' ? 'productItems' : 'offsiteItems';
      const updated = (portal[key] || []).filter(i => i._id !== itemId);
      const res = await api.put(`/portal/${portal.slug}/items`, { [key]: updated });
      setPortals(prev => prev.map(p => p.slug === portal.slug ? { ...p, [key]: res.data[key] } : p));
    } catch {
      setError('Failed to remove item.');
    } finally {
      setSaving(null);
    }
  };

  const PortalModal = () => {
    if (!open) return null;
    return (
      <div onClick={e => { if (e.target === e.currentTarget) close(); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>

        <style>{`@keyframes pm-spin{to{transform:rotate(360deg)}} .pm-del:hover{color:#ef4444!important;background:#fef2f2!important}`}</style>

        <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden', fontFamily: 'system-ui,sans-serif' }}>

          {/* Header */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#eef2ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>
                  {pending.length > 0 ? 'Add to Client Portal' : 'Manage Portal Items'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                  {pending.length > 0 ? `${pending.length} ${type === 'product' ? 'product' : 'property'} selected` : `${type} portals`}
                </div>
              </div>
            </div>
            <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Search bar */}
          {!done && (
            <div style={{ padding: '10px 20px 0', flexShrink: 0, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search by client, title, ref or contact…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 30px 7px 30px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 12, outline: 'none', background: '#f8fafc', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>

            {done && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ width: 52, height: 52, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>Added successfully!</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Portal updated.</div>
              </div>
            )}

            {!done && loading && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8' }}>
                <div style={{ ...S.spin, width: 28, height: 28, margin: '0 auto 12px' }} />
                <div style={{ fontSize: 13 }}>Loading portals...</div>
              </div>
            )}

            {!done && !loading && error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>
            )}

            {!done && !loading && portals.length === 0 && !error && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#475569' }}>
                  No active {type === 'product' ? 'product gifting' : 'offsite'} portals found
                </div>
                <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.7 }}>
                  Create a <strong>{type === 'product' ? 'Product Gifting' : 'Offsite'}</strong> inquiry<br />
                  in Order Tracker — portal is created automatically.
                </div>
              </div>
            )}

            {!done && !loading && (() => {
              const term = search.toLowerCase().trim();
              const filtered = term
                ? portals.filter(p =>
                    [p.title, p.orderRef, p.clientName, p.orderPlacedBy]
                      .filter(Boolean).join(' ').toLowerCase().includes(term)
                  )
                : portals;

              if (portals.length > 0 && filtered.length === 0) return (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>No orders match "{search}"</div>
                </div>
              );

              return filtered.map(p => {
              const key = type === 'product' ? 'productItems' : 'offsiteItems';
              const items = p[key] || [];
              const isExp = expanded === p.slug;
              const addingThis = saving === p.slug;
              const wasDone = done === p.slug;

              return (
                <div key={p.slug} style={{ border: `1px solid ${wasDone ? '#86efac' : '#e2e8f0'}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden', background: wasDone ? '#f0fdf4' : '#fff' }}>

                  {/* Portal header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title || p.orderRef}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {p.clientName} · {p.orderRef}
                        {p.orderPlacedBy && <> · <span style={{ color: '#64748b', fontWeight: 600 }}>via {p.orderPlacedBy}</span></>}
                        {' · '}<span style={{ color: items.length > 0 ? '#6366f1' : '#94a3b8', fontWeight: 600 }}>{items.length} in portal</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {items.length > 0 && (
                        <button onClick={() => setExpanded(isExp ? null : p.slug)}
                          style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                          {isExp ? 'Hide' : `${items.length} items ▾`}
                        </button>
                      )}
                      {pending.length > 0 && (
                        <button onClick={() => confirmAdd(p)} disabled={!!saving}
                          style={{ background: wasDone ? '#dcfce7' : '#6366f1', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: wasDone ? '#16a34a' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: (saving && !addingThis) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {addingThis ? <span style={S.spin} /> : wasDone ? '✓' : '+ Add'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded item list with delete buttons */}
                  {isExp && (
                    <div style={{ borderTop: '1px solid #f1f5f9' }}>
                      {items.map(item => {
                        const delKey = `${p.slug}__${item._id}`;
                        const isDeleting = saving === delKey;
                        return (
                          <div key={item._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #f8fafc', background: '#fafafa' }}>
                            <div style={{ width: 34, height: 34, borderRadius: 7, background: '#e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                              {item.imageUrl
                                ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                                    {type === 'product' ? '📦' : '📍'}
                                  </div>
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                {type === 'product' ? `₹${Number(item.price || 0).toLocaleString('en-IN')}` : item.location || '—'}
                              </div>
                            </div>
                            <button className="pm-del" onClick={() => removeItem(p, item._id)} disabled={!!saving}
                              style={{ background: 'none', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: saving ? 'not-allowed' : 'pointer', color: '#fca5a5', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                              title="Remove from portal">
                              {isDeleting
                                ? <span style={{ ...S.spin, borderTopColor: '#ef4444' }} />
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              }
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
            })()}
          </div>
        </div>
      </div>
    );
  };

  return { addToPortal, PortalModal };
};

export default usePortalItems;