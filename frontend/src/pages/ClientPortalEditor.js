import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Link2, Trash2, Send, Check, X, Edit3,
  Package, MapPin, ChevronUp, ChevronDown, ChevronRight,
  ExternalLink, RefreshCw, Copy, Eye, Paperclip, Download,
  ImagePlus, Plus, Loader2, Truck, AlertTriangle, Search,
} from 'lucide-react';
import { requestNotifPermission, pushNotif, subscribeToPortalPush } from '../utils/portalNotifications';

/**
 * ClientPortalEditor
 * Rendered inside a `position: relative` wrapper in OrderTracker.
 * The file input MUST be a direct child of the root div — this ensures
 * position:absolute resolves correctly and .click() works in all browsers.
 */
const ClientPortalEditor = ({ order, onClose }) => {
  const { user }                    = useAuth();
  const [portal, setPortal]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [tab, setTab]               = useState('items');
  const [msg, setMsg]               = useState('');
  const [chatFiles, setChatFiles]   = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [editNote, setEditNote]     = useState(false);
  const [noteText, setNoteText]     = useState('');
  const [collapsed, setCollapsed]   = useState({}); // { [category]: true/false }
  const [shipments, setShipments]   = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [syncingOffsite, setSyncingOffsite] = useState(false);
  const chatEndRef         = useRef(null);
  const chatFileRef        = useRef(null);
  const pollTimer          = useRef(null);
  const prevClientMsgCount = useRef(0);

  // ── Custom item form state ──────────────────────────────────────────────────
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm]         = useState({ name:'', description:'', price:'' });
  const [customImage, setCustomImage]       = useState(null);
  const [customPreview, setCustomPreview]   = useState(null);
  const [savingCustom, setSavingCustom]     = useState(false);
  const customImageRef                      = useRef(null);

  const resetCustomForm = () => {
    setShowCustomForm(false);
    setCustomForm({ name:'', description:'', price:'' });
    setCustomImage(null);
    setCustomPreview(null);
  };

  const handleCustomImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomImage(file);
    const reader = new FileReader();
    reader.onload = ev => setCustomPreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddCustomItem = async () => {
    if (!customForm.name.trim() || !portal) return;
    setSavingCustom(true);
    try {
      let imageUrl = '';
      if (customImage) {
        const fd = new FormData();
        fd.append('image', customImage);
        const up = await api.post('/products/upload-temp-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrl = up.data?.imageUrl || '';
      }
      const newItem = {
        productId:   '',
        name:        customForm.name.trim(),
        description: customForm.description.trim(),
        imageUrl,
        price:       customForm.price !== '' ? Number(customForm.price) : 0,
        category:    'Custom',
        subCategory: '',
        note:        '',
        order:       0,
      };
      const existing = portal.productItems || [];
      await api.put(`/portal/${portal.slug}/items`, { productItems: [...existing, newItem] });
      await loadPortal(true);
      resetCustomForm();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingCustom(false);
    }
  };

  const fallbackSlug = order.refNumber?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const portalUrl = portal?.slug
    ? `${window.location.origin}/p/${portal.slug}`
    : `${window.location.origin}/p/${fallbackSlug}`;

  useEffect(() => {
    requestNotifPermission();
    loadPortal();
    // Poll every 12 seconds for new client messages while the editor is open
    pollTimer.current = setInterval(() => loadPortal(true), 12000);
    return () => clearInterval(pollTimer.current);
  }, [order._id]);
  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [portal?.messages, tab]);

  useEffect(() => {
    if (tab === 'shipments' && portal?.type === 'product' && order._id) {
      loadShipments();
    }
  }, [tab, order._id]);

  const loadShipments = async () => {
    setShipmentsLoading(true);
    try {
      const res = await api.get(`/shipments?orderId=${order._id}`);
      setShipments(Array.isArray(res.data) ? res.data : []);
    } catch { setShipments([]); }
    finally { setShipmentsLoading(false); }
  };

  const loadPortal = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/portal/order/${order._id}`);
      const data = res.data;

      // ── Detect new CLIENT messages and push a browser notification ──────────
      if (silent) {
        const clientMsgs = (data.messages || []).filter(m => m.sender === 'client');
        if (prevClientMsgCount.current > 0 && clientMsgs.length > prevClientMsgCount.current) {
          const newest = clientMsgs[clientMsgs.length - 1];
          const preview = newest.text
            ? newest.text.slice(0, 60) + (newest.text.length > 60 ? '…' : '')
            : newest.attachments?.length ? `📎 ${newest.attachments[0].name}` : 'New message';
          const senderLabel = newest.senderName || data.clientName || 'Client';
          pushNotif(`${senderLabel} sent a message`, preview, `portal-client-msg-${data.slug}`);
        }
        prevClientMsgCount.current = (data.messages || []).filter(m => m.sender === 'client').length;
      } else {
        prevClientMsgCount.current = (data.messages || []).filter(m => m.sender === 'client').length;
      }

      setPortal(data);
      setNoteText(data.teamNote || '');
    } catch (err) {
      if (err.response?.status === 404) await createPortal();
    } finally { if (!silent) setLoading(false); }
  };

  const createPortal = async () => {
    const res = await api.post('/portal', {
      orderId:     order._id,
      type:        order.orderType || 'product',
      orderRef:    order.refNumber || order._id.slice(-8),
      clientName:  order.clientName,
      clientEmail: order.clientEmail || '',
      title:       order.title,
    });
    setPortal(res.data);
    setNoteText('');
  };

  const removeItem = async (itemId) => {
    if (!portal) return;
    const key = portal.type === 'product' ? 'productItems' : 'offsiteItems';
    await saveItems(portal[key].filter(i => i._id !== itemId));
  };

  const moveItem = async (itemId, dir) => {
    if (!portal) return;
    const key = portal.type === 'product' ? 'productItems' : 'offsiteItems';
    const arr = [...portal[key]];
    const idx = arr.findIndex(i => i._id === itemId);
    if (dir === 'up'   && idx > 0)             [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
    if (dir === 'down' && idx < arr.length - 1)[arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
    await saveItems(arr);
  };

  const saveItems = async (items) => {
    setSaving(true);
    try {
      const key = portal.type === 'product' ? 'productItems' : 'offsiteItems';
      const res = await api.put(`/portal/${portal.slug}/items`, { [key]: items });
      setPortal(res.data);
    } finally { setSaving(false); }
  };

  const sendMessage = async () => {
    if ((!msg.trim() && chatFiles.length === 0) || sendingMsg) return;
    const perm = await requestNotifPermission();
    if (perm === 'granted') subscribeToPortalPush(fetch); // register for server-side push
    setSendingMsg(true);
    try {
      const fd = new FormData();
      fd.append('text', msg.trim());
      fd.append('senderName', user?.name || 'Marqland Team');
      chatFiles.forEach(f => fd.append('files', f));
      await api.post(`/portal/${portal.slug}/message/team`, fd);
      setMsg('');
      setChatFiles([]);
      await loadPortal();
    } finally { setSendingMsg(false); }
  };

  const syncOffsite = async () => {
    if (!portal || syncingOffsite) return;
    setSyncingOffsite(true);
    try {
      const res = await api.post(`/portal/${portal.slug}/sync-offsite`);
      setPortal(res.data.portal || res.data);
    } catch (err) {
      console.error('sync-offsite failed:', err);
    } finally {
      setSyncingOffsite(false);
    }
  };

  const saveMeta = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/portal/${portal.slug}/meta`, { teamNote: noteText });
      setPortal(res.data);
      setEditNote(false);
    } finally { setSaving(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtT = d => new Date(d).toLocaleString('en-IN', {
    day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true
  });

  const toggleCollapse = (cat) => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));


  if (loading) return (
    <div className="flex items-center justify-center flex-1 py-20">
      <RefreshCw className="animate-spin text-indigo-400" size={28} />
    </div>
  );
  if (!portal) return null;

  const items       = portal.type === 'product' ? portal.productItems : portal.offsiteItems;
  const isCompleted = portal.status === 'completed';

  return (
    // Root div — inherits position:relative from the wrapper in OrderTracker
    // The file input below MUST be a direct child here so absolute positioning works correctly
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Link2 size={16} className="text-white" />
          </div>
          <div>
            <div className="font-black text-sm text-slate-800 uppercase tracking-tight">Client Portal</div>
            <div className="text-[10px] text-slate-400 font-bold">
              {portal.type === 'product' ? 'Product' : 'Offsite'} · {portal.orderRef}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-full uppercase">Completed</span>
          )}
          {portal.viewCount > 0 && (
            <span className="text-[10px] text-slate-400 font-bold hidden sm:block">
              👁 {portal.viewCount}
            </span>
          )}
          <button onClick={copyLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a href={portalUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all">
            <Eye size={12} /> Preview
          </a>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-100 shrink-0">
        {[
          { k:'items',     l:`Options (${items.length})`,                         show: true },
          { k:'selected',  l:`Selected (${(portal.shortlistedIds||[]).length})`,  show: portal.type !== 'offsite' },
          { k:'shipments', l:`Shipments`,                                          show: portal.type === 'product' },
          { k:'chat',      l:`Chat (${portal.messages.length})`,                  show: true },
        ].filter(t => t.show).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${tab === t.k ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ══ ITEMS TAB ══ */}
        {tab === 'items' && (
          <div className="p-4 space-y-3">

            {/* Intro note */}
            <div className="bg-indigo-50 rounded-xl p-3">
              {editNote ? (
                <div className="space-y-2">
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    className="w-full bg-white rounded-lg p-2 text-sm outline-none border border-indigo-200 resize-none"
                    rows={3} placeholder="Write an intro note for the client..." />
                  <div className="flex gap-2">
                    <button onClick={saveMeta} disabled={saving}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">Save</button>
                    <button onClick={() => setEditNote(false)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-indigo-700 flex-1">
                    {noteText || <span className="text-indigo-300 italic">Add an intro note for the client...</span>}
                  </p>
                  <button onClick={() => setEditNote(true)} className="text-indigo-400 hover:text-indigo-600 shrink-0">
                    <Edit3 size={13} />
                  </button>
                </div>
              )}
            </div>


            {/* Items — grouped by category (products) or flat (offsite) */}
            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">No items added yet</p>
                <p className="text-xs mt-1 text-slate-300">
                  Go to {portal.type === 'product' ? 'Products' : 'Properties'} → select → "Add to Portal"
                </p>
              </div>
            ) : portal.type === 'product' ? (
              (() => {
                // Build category groups preserving original indices for move buttons
                const groupMap = new Map();
                items.forEach((item, originalIdx) => {
                  const cat = item.category || 'Uncategorised';
                  if (!groupMap.has(cat)) groupMap.set(cat, []);
                  groupMap.get(cat).push({ item, originalIdx });
                });
                return Array.from(groupMap.entries()).map(([cat, entries]) => {
                  const isOpen = !collapsed[cat];
                  return (
                    <div key={cat} className="border border-slate-100 rounded-xl overflow-hidden">
                      {/* Category header — click to collapse/expand */}
                      <button
                        onClick={() => toggleCollapse(cat)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-indigo-50 transition-colors group">
                        <div className="flex items-center gap-2">
                          <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{cat}</div>
                          <span className="text-[10px] text-slate-400 font-bold">{entries.length} item{entries.length !== 1 ? 's' : ''}</span>
                        </div>
                        {isOpen
                          ? <ChevronDown size={13} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                          : <ChevronRight size={13} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        }
                      </button>
                      {/* Items — hidden when collapsed */}
                      {isOpen && (
                        <div className="divide-y divide-slate-50">
                          {entries.map(({ item, originalIdx: idx }) => (
                            <div key={item._id} className="p-3 flex gap-3 items-start group/item hover:bg-slate-50 transition-colors">
                              <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                                {item.imageUrl
                                  ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={16} /></div>
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">₹{Number(item.price||0).toLocaleString('en-IN')}</div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {(item.additionalImages||[]).length > 0 && (
                                    <span className="text-[9px] bg-violet-100 text-violet-600 font-black px-1.5 py-0.5 rounded-full uppercase">
                                      +{item.additionalImages.length} photos
                                    </span>
                                  )}
                                  {item.videoUrl && (
                                    <span className="text-[9px] bg-rose-100 text-rose-500 font-black px-1.5 py-0.5 rounded-full uppercase">
                                      🎬 video
                                    </span>
                                  )}
                                </div>
                                {item.note && <div className="text-[10px] text-indigo-600 mt-1 italic">{item.note}</div>}
                              </div>
                              <div className="flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <button onClick={() => moveItem(item._id, 'up')} disabled={idx === 0}
                                  className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronUp size={13} /></button>
                                <button onClick={() => moveItem(item._id, 'down')} disabled={idx === items.length - 1}
                                  className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={13} /></button>
                                <button onClick={() => removeItem(item._id)}
                                  className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            ) : (
              // ── Offsite items ─────────────────────────────────────────────
              (() => {
                const STD_ADDONS = [
                  { priceKey:'djCost',         label:'DJ'                },
                  { priceKey:'licenseFeeDJ',   label:'DJ Licence'        },
                  { priceKey:'cocktailSnacks', label:'Cocktails & Snacks' },
                  { priceKey:'banquetHall',    label:'Banquet Hall'      },
                ];

                const NIGHT_ROOMS = [
                  { key:'single', label:'Single', priceKey:'singlePrice' },
                  { key:'double', label:'Double', priceKey:'doublePrice' },
                  { key:'triple', label:'Triple', priceKey:'triplePrice' },
                  { key:'quad',   label:'Quad',   priceKey:'quadPrice'   },
                ];

                const calcState = portal.calculatorState || {};

                const saveCalcState = async (newState) => {
                  try {
                    await api.put(`/portal/${portal.slug}/calculator`, { calculatorState: newState });
                    setPortal(p => ({ ...p, calculatorState: newState }));
                  } catch (e) { console.error('calc save failed', e); }
                };

                const getItemState = (itemId) => calcState[itemId] || {};

                const setRoomCount = async (itemId, roomKey, val) => {
                  const count = Math.max(0, Number(val) || 0);
                  const cur = getItemState(itemId);
                  const newState = { ...calcState, [itemId]: { ...cur, [roomKey]: count } };
                  await saveCalcState(newState);
                };

                const setGuests = async (itemId, val) => {
                  const guests = Math.max(0, Number(val) || 0);
                  const cur = getItemState(itemId);
                  const newState = { ...calcState, [itemId]: { ...cur, pax: guests } };
                  await saveCalcState(newState);
                };

                const toggleRoomDisabled = async (itemId, roomKey) => {
                  const cur = getItemState(itemId);
                  const disabled = cur.disabledRooms || {};
                  const newState = { ...calcState, [itemId]: { ...cur, disabledRooms: { ...disabled, [roomKey]: !disabled[roomKey] } } };
                  await saveCalcState(newState);
                };

                const toggleCatRoomDisabled = async (itemId, catId, roomKey) => {
                  const cur = getItemState(itemId);
                  const disabled = cur.disabledRooms || {};
                  const compositeKey = `cat_${catId}_${roomKey}`;
                  const newState = { ...calcState, [itemId]: { ...cur, disabledRooms: { ...disabled, [compositeKey]: !disabled[compositeKey] } } };
                  await saveCalcState(newState);
                };

                const setCatRoomCount = async (itemId, catId, roomKey, val) => {
                  const count = Math.max(0, Number(val) || 0);
                  const cur = getItemState(itemId);
                  const compositeKey = `cat_${catId}_${roomKey}`;
                  const newState = { ...calcState, [itemId]: { ...cur, [compositeKey]: count } };
                  await saveCalcState(newState);
                };

                const toggleAddonDisabled = async (itemId, addonKey) => {
                  const cur = getItemState(itemId);
                  const disabled = cur.disabledAddons || {};
                  const newState = { ...calcState, [itemId]: { ...cur, disabledAddons: { ...disabled, [addonKey]: !disabled[addonKey] } } };
                  await saveCalcState(newState);
                };

                return (
                  <div>
                    {/* Sync button — refreshes roomCategories from source Properties */}
                    <div className="flex justify-end mb-2 px-1">
                      <button onClick={syncOffsite} disabled={syncingOffsite}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg border border-indigo-200 transition-all disabled:opacity-50">
                        {syncingOffsite
                          ? <><Loader2 size={11} className="animate-spin" /> Syncing…</>
                          : <><RefreshCw size={11} /> Sync room categories</>
                        }
                      </button>
                    </div>
                    {items.map((item, idx) => {
                  const isDayOut    = item.type !== 'Night Stay';
                  const stdVisible  = STD_ADDONS.filter(a => (item[a.priceKey]||0) > 0);
                  const adhocVisible = (item.adhocAddons||[]).filter(a => (a.sellingPrice||0) > 0);
                  const hasAddons   = stdVisible.length > 0 || adhocVisible.length > 0;
                  const nightRooms  = isDayOut ? [] : NIGHT_ROOMS.filter(r => (item[r.priceKey]||0) > 0);
                  const itemState   = getItemState(item._id);
                  const disabledMap = itemState.disabledAddons || {};
                  const disabledRooms = itemState.disabledRooms || {};

                  return (
                    <div key={item._id} className="border border-slate-100 rounded-xl overflow-hidden">
                      {/* Item header row */}
                      <div className="p-3 flex gap-3 items-start group">
                        <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-300"><MapPin size={16} /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.location}
                            {item.doublePrice > 0 && ` · ₹${Number(item.doublePrice).toLocaleString('en-IN')}/double`}
                            {item.dayPackages?.length > 0 && ` · ${item.dayPackages.length} pkg${item.dayPackages.length !== 1 ? 's' : ''}`}
                          </div>
                          {item.note && <div className="text-[10px] text-indigo-600 mt-1 italic">{item.note}</div>}
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveItem(item._id, 'up')} disabled={idx === 0}
                            className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronUp size={13} /></button>
                          <button onClick={() => moveItem(item._id, 'down')} disabled={idx === items.length - 1}
                            className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={13} /></button>
                          <button onClick={() => removeItem(item._id)}
                            className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                      </div>

                      {/* Calculator pre-set panel */}
                      <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-3">

                        {/* ── Day Outing: single pax input ── */}
                        {isDayOut && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Guest Count</div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setGuests(item._id, Math.max(0,(Number(itemState.pax)||0)-1))}
                                className="w-6 h-6 border border-slate-200 bg-white rounded flex items-center justify-center text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm">−</button>
                              <input type="number" min="0" value={itemState.pax ?? ''} placeholder="0"
                                onChange={e => setGuests(item._id, e.target.value)}
                                className="w-16 text-center border border-slate-200 rounded bg-white px-1 py-1 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors"/>
                              <button onClick={() => setGuests(item._id, (Number(itemState.pax)||0)+1)}
                                className="w-6 h-6 border border-slate-200 bg-white rounded flex items-center justify-center text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm">+</button>
                              <span className="text-[10px] text-slate-400">guests</span>
                            </div>
                          </div>
                        )}

                        {/* ── Night Stay: per room-type count + toggle ── */}
                        {!isDayOut && nightRooms.length > 0 && (
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Room Count <span className="font-normal normal-case tracking-normal text-slate-300">— toggle off to hide room type</span></div>
                            <div className="flex flex-col gap-2">
                              {nightRooms.map(r => {
                                const isOff = !!disabledRooms[r.key];
                                const roomCount = itemState[r.key] ?? '';
                                return (
                                  <div key={r.key} className="flex items-center gap-2">
                                    {/* Toggle */}
                                    <button onClick={() => toggleRoomDisabled(item._id, r.key)}
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isOff ? 'bg-slate-200' : 'bg-indigo-500'}`}>
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOff ? 'translate-x-0' : 'translate-x-4'}`}/>
                                    </button>
                                    {/* Label + price */}
                                    <span className={`text-[11px] font-medium w-12 shrink-0 ${isOff ? 'text-slate-300' : 'text-slate-600'}`}>{r.label}</span>
                                    <span className="text-[10px] text-slate-400 flex-1">₹{Number(item[r.priceKey]).toLocaleString('en-IN')}/night</span>
                                    {/* Count stepper — disabled when room is off */}
                                    {!isOff && (
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={() => setRoomCount(item._id, r.key, Math.max(0,(Number(roomCount)||0)-1))}
                                          className="w-5 h-5 border border-slate-200 bg-white rounded flex items-center justify-center text-slate-500 hover:border-indigo-300 text-xs">−</button>
                                        <input type="number" min="0" value={roomCount} placeholder="0"
                                          onChange={e => setRoomCount(item._id, r.key, e.target.value)}
                                          className="w-12 text-center border border-slate-200 rounded bg-white px-1 py-0.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors"/>
                                        <button onClick={() => setRoomCount(item._id, r.key, (Number(roomCount)||0)+1)}
                                          className="w-5 h-5 border border-slate-200 bg-white rounded flex items-center justify-center text-slate-500 hover:border-indigo-300 text-xs">+</button>
                                        <span className="text-[9px] text-slate-400 w-10">rooms</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── Room Category toggles (per-category: on/off + counts) ── */}
                        {!isDayOut && (item.roomCategories||[]).length > 0 && (
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                              Room Categories <span className="font-normal normal-case tracking-normal text-slate-300">— toggle off to hide a category</span>
                            </div>
                            {(item.roomCategories||[]).map(cat => {
                              const catRooms = [
                                { key:'single', label:'Single', price: cat.singlePrice },
                                { key:'double', label:'Double', price: cat.doublePrice },
                                { key:'triple', label:'Triple', price: cat.triplePrice },
                              ].filter(r => r.price > 0);
                              if (catRooms.length === 0) return null;
                              const catId = cat._id || cat.name;
                              const catDisabledKey = `cat_${catId}`;
                              const isCatOff = !!disabledRooms[catDisabledKey];
                              return (
                                <div key={catId} className="border border-slate-200 rounded-lg mb-2 overflow-hidden">
                                  {/* Category header toggle */}
                                  <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-50">
                                    <button onClick={() => toggleRoomDisabled(item._id, catDisabledKey)}
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isCatOff ? 'bg-slate-200' : 'bg-indigo-500'}`}>
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isCatOff ? 'translate-x-0' : 'translate-x-4'}`}/>
                                    </button>
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${isCatOff ? 'text-slate-300' : 'text-indigo-600'}`}>{cat.name}</span>
                                  </div>
                                  {/* Per-room-type rows — hidden when category is off */}
                                  {!isCatOff && (
                                    <div className="px-2.5 py-2 space-y-1.5">
                                      {catRooms.map(r => {
                                        const compositeKey = `cat_${catId}_${r.key}`;
                                        const isOff = !!disabledRooms[compositeKey];
                                        const roomCount = itemState[compositeKey] ?? '';
                                        return (
                                          <div key={r.key} className="flex items-center gap-2">
                                            <button onClick={() => toggleCatRoomDisabled(item._id, catId, r.key)}
                                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isOff ? 'bg-slate-200' : 'bg-indigo-400'}`}>
                                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOff ? 'translate-x-0' : 'translate-x-4'}`}/>
                                            </button>
                                            <span className={`text-[11px] font-medium w-12 shrink-0 ${isOff ? 'text-slate-300' : 'text-slate-600'}`}>{r.label}</span>
                                            <span className="text-[10px] text-slate-400 flex-1">₹{Number(r.price).toLocaleString('en-IN')}/night</span>
                                            {!isOff && (
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <button onClick={() => setCatRoomCount(item._id, catId, r.key, Math.max(0,(Number(roomCount)||0)-1))}
                                                  className="w-5 h-5 border border-slate-200 bg-white rounded flex items-center justify-center text-slate-500 hover:border-indigo-300 text-xs">−</button>
                                                <input type="number" min="0" value={roomCount} placeholder="0"
                                                  onChange={e => setCatRoomCount(item._id, catId, r.key, e.target.value)}
                                                  className="w-12 text-center border border-slate-200 rounded bg-white px-1 py-0.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors"/>
                                                <button onClick={() => setCatRoomCount(item._id, catId, r.key, (Number(roomCount)||0)+1)}
                                                  className="w-5 h-5 border border-slate-200 bg-white rounded flex items-center justify-center text-slate-500 hover:border-indigo-300 text-xs">+</button>
                                                <span className="text-[9px] text-slate-400 w-10">rooms</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* ── Addon visibility toggles ── */}
                        {hasAddons && (
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                              Addon Visibility <span className="font-normal normal-case tracking-normal text-slate-300">— toggle off to hide from this order</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {stdVisible.map(a => {
                                const isDisabled = !!disabledMap[a.priceKey];
                                return (
                                  <div key={a.priceKey} className="flex items-center gap-2">
                                    <button onClick={() => toggleAddonDisabled(item._id, a.priceKey)}
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isDisabled ? 'bg-slate-200' : 'bg-indigo-500'}`}>
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isDisabled ? 'translate-x-0' : 'translate-x-4'}`}/>
                                    </button>
                                    <span className={`text-[11px] font-medium flex-1 truncate ${isDisabled ? 'text-slate-300 line-through' : 'text-slate-600'}`}>
                                      {a.label} <span className="text-[10px] text-slate-400 no-underline font-normal" style={{textDecoration:'none'}}>· ₹{Number(item[a.priceKey]).toLocaleString('en-IN')}</span>
                                    </span>
                                  </div>
                                );
                              })}
                              {adhocVisible.map((a, ai) => {
                                const key = `adhoc_${ai}`;
                                const isDisabled = !!disabledMap[key];
                                return (
                                  <div key={ai} className="flex items-center gap-2">
                                    <button onClick={() => toggleAddonDisabled(item._id, key)}
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isDisabled ? 'bg-slate-200' : 'bg-indigo-500'}`}>
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isDisabled ? 'translate-x-0' : 'translate-x-4'}`}/>
                                    </button>
                                    <span className={`text-[11px] font-medium flex-1 truncate ${isDisabled ? 'text-slate-300 line-through' : 'text-slate-600'}`}>
                                      {a.name} <span className="text-[10px] text-slate-400 font-normal">· ₹{Number(a.sellingPrice).toLocaleString('en-IN')}</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                  </div>
                );
              })()
            )}

            {/* ── Custom / Discussion item — product portals only ── */}
            {portal.type === 'product' && (
              <div className="border border-dashed border-slate-200 rounded-xl overflow-hidden">
                {!showCustomForm ? (
                  /* Trigger button */
                  <button
                    onClick={() => setShowCustomForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    <ImagePlus size={13} />
                    Add Discussion / Custom Item
                  </button>
                ) : (
                  /* Expanded inline form */
                  <div>
                    {/* Form header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100">
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Custom Item</span>
                      <button onClick={resetCustomForm} className="text-indigo-300 hover:text-indigo-500">
                        <X size={13} />
                      </button>
                    </div>

                    <div className="p-3 space-y-2.5">
                      {/* Image + Name row */}
                      <div className="flex items-start gap-2.5">
                        {/* Image picker */}
                        <div
                          onClick={() => customImageRef.current?.click()}
                          className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex-shrink-0 overflow-hidden"
                        >
                          {customPreview
                            ? <img src={customPreview} alt="" className="w-full h-full object-cover" />
                            : <ImagePlus size={16} className="text-slate-300" />
                          }
                        </div>
                        <input ref={customImageRef} type="file" accept="image/*" className="hidden" onChange={handleCustomImagePick} />

                        {/* Name */}
                        <input
                          type="text"
                          placeholder="Product name *"
                          value={customForm.name}
                          onChange={e => setCustomForm(p => ({ ...p, name: e.target.value }))}
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:font-normal placeholder:text-slate-300 transition"
                        />
                      </div>

                      {/* Description */}
                      <textarea
                        placeholder="Description (optional)"
                        value={customForm.description}
                        onChange={e => setCustomForm(p => ({ ...p, description: e.target.value }))}
                        rows={2}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300 resize-none transition"
                      />

                      {/* Price */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number" min="0"
                          placeholder="Price (optional)"
                          value={customForm.price}
                          onChange={e => setCustomForm(p => ({ ...p, price: e.target.value }))}
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300 transition"
                        />
                      </div>

                      {/* Save button */}
                      <button
                        onClick={handleAddCustomItem}
                        disabled={savingCustom || !customForm.name.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {savingCustom
                          ? <><Loader2 size={11} className="animate-spin" /> Adding…</>
                          : <><Plus size={11} /> Add to Portal</>
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-center pt-1 pb-2">
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                Add items → {portal.type === 'product' ? 'Products page' : 'Property List'} → select → "Add to Portal"
              </p>
            </div>
          </div>
        )}

        {/* ══ CHAT TAB ══ */}
        {tab === 'chat' && (
          <div className="flex flex-col" style={{ minHeight: 400 }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {portal.messages.length === 0 && (
                <div className="text-center py-10 text-slate-300 text-sm">No messages yet. Start the conversation.</div>
              )}
              {portal.messages.map(m => {
                const isTeam = m.sender === 'team';
                return (
                  <div key={m._id} className={`flex gap-2.5 ${isTeam ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 self-end mb-0.5 ${isTeam ? 'bg-indigo-600 text-white' : 'bg-orange-100 text-orange-600'}`}>
                      {(m.senderName||'T').slice(0,2).toUpperCase()}
                    </div>
                    <div className={`max-w-[78%] flex flex-col ${isTeam ? 'items-end' : 'items-start'}`}>
                      <div className={`text-[9px] font-bold mb-1 ${isTeam ? 'text-right text-slate-400' : 'text-slate-400'}`}>
                        {m.senderName} · {fmtT(m.createdAt)}
                      </div>
                      <div className={`rounded-2xl px-3.5 py-2.5 ${isTeam ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                        {m.text && <div className="text-sm leading-relaxed">{m.text}</div>}
                        {(m.attachments||[]).map((att, i) => (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer"
                            onClick={async e => {
                              e.preventDefault();
                              try {
                                const res = await fetch(att.url);
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = att.name;
                                document.body.appendChild(a); a.click();
                                document.body.removeChild(a); URL.revokeObjectURL(url);
                              } catch { window.open(att.url, '_blank'); }
                            }}
                            className={`flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${isTeam ? 'bg-indigo-500 text-indigo-100 hover:bg-indigo-400' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                            <Paperclip size={11} className="shrink-0" />
                            <span className="truncate max-w-[120px]">{att.name}</span>
                            <Download size={11} className="shrink-0 ml-auto" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* File previews */}
            {chatFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 pt-2">
                {chatFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1">
                    <Paperclip size={11} className="text-indigo-400" />
                    <span className="text-[10px] font-bold text-indigo-600 max-w-[90px] truncate">{f.name}</span>
                    <button onClick={() => setChatFiles(chatFiles.filter((_,idx)=>idx!==i))}
                      className="text-indigo-300 hover:text-red-400 ml-0.5 flex items-center"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Message input */}
            <div className="p-3 border-t border-slate-100 shrink-0">
              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-slate-50 rounded-xl border border-transparent focus-within:border-indigo-200 transition-colors">
                  <textarea value={msg} onChange={e => setMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={`Message as ${user?.name || 'Team'}... (Enter to send)`}
                    rows={2}
                    className="w-full bg-transparent px-3.5 pt-3 pb-1.5 text-sm outline-none resize-none text-slate-800 placeholder:text-slate-300" />
                  <div className="px-3 pb-2.5 flex items-center gap-2 border-t border-slate-100 mt-1 pt-1.5">
                    <button type="button" onClick={() => chatFileRef.current?.click()}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors">
                      <Paperclip size={13} /> Attach
                    </button>
                    <span className="text-[9px] text-slate-300">Max 5 files</span>
                  </div>
                </div>
                <button onClick={sendMessage} disabled={sendingMsg || (!msg.trim() && chatFiles.length === 0)}
                  className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-all shrink-0 mb-0.5">
                  {sendingMsg ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ SHIPMENTS TAB ══ */}
        {tab === 'shipments' && (() => {
          const DELAYED_STATUSES = new Set(['Returned', 'Exception']);
          const STATUS_COLORS = {
            'Pending':           'bg-slate-100 text-slate-500',
            'Booked':            'bg-blue-50 text-blue-600',
            'In Transit':        'bg-amber-50 text-amber-700',
            'Out for Delivery':  'bg-orange-50 text-orange-600',
            'Delivered':         'bg-emerald-50 text-emerald-700',
            'Completed':         'bg-emerald-50 text-emerald-700',
            'Returned':          'bg-red-50 text-red-600',
            'Exception':         'bg-red-50 text-red-600',
          };

          const q = shipmentSearch.toLowerCase().trim();
          const filtered = shipments.filter(s =>
            !q ||
            (s.recipientName || '').toLowerCase().includes(q) ||
            (s.trackingId    || '').toLowerCase().includes(q) ||
            (s.city          || '').toLowerCase().includes(q) ||
            (s.shippingPartner || '').toLowerCase().includes(q) ||
            (s.status        || '').toLowerCase().includes(q)
          );

          const statusGroups = {};
          filtered.forEach(s => {
            const st = s.status || 'Pending';
            if (!statusGroups[st]) statusGroups[st] = [];
            statusGroups[st].push(s);
          });

          const STATUS_ORDER = ['Exception','Returned','In Transit','Out for Delivery','Booked','Pending','Delivered','Completed'];
          const sortedStatuses = Object.keys(statusGroups).sort(
            (a,b) => (STATUS_ORDER.indexOf(a) === -1 ? 99 : STATUS_ORDER.indexOf(a)) -
                     (STATUS_ORDER.indexOf(b) === -1 ? 99 : STATUS_ORDER.indexOf(b))
          );

          return (
            <div className="flex flex-col h-full">
              {/* Search + refresh */}
              <div className="px-4 pt-4 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-indigo-300 transition-colors">
                    <Search size={13} className="text-slate-400 shrink-0" />
                    <input
                      value={shipmentSearch}
                      onChange={e => setShipmentSearch(e.target.value)}
                      placeholder="Search recipient, city, tracking ID, partner…"
                      className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder:text-slate-300"
                    />
                    {shipmentSearch && (
                      <button onClick={() => setShipmentSearch('')} className="text-slate-300 hover:text-slate-500">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button onClick={loadShipments} disabled={shipmentsLoading}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors disabled:opacity-40">
                    <RefreshCw size={13} className={shipmentsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Summary row */}
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
                  </span>
                  {shipments.filter(s => DELAYED_STATUSES.has(s.status)).length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest">
                      <AlertTriangle size={10} />
                      {shipments.filter(s => DELAYED_STATUSES.has(s.status)).length} delayed
                    </span>
                  )}
                  {q && (
                    <span className="text-[10px] text-slate-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {shipmentsLoading ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm font-bold">Loading shipments…</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-3xl mb-3">📦</div>
                    <p className="text-sm font-bold text-slate-400">
                      {shipments.length === 0 ? 'No shipments linked to this order yet.' : 'No results match your search.'}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      {shipments.length === 0 ? 'Link shipments from the Courier Tracking page.' : 'Try a different search term.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedStatuses.map(status => (
                      <div key={status}>
                        {/* Status group header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-500'}`}>
                            {status}
                          </span>
                          <span className="text-[9px] text-slate-300 font-bold">{statusGroups[status].length}</span>
                          {DELAYED_STATUSES.has(status) && (
                            <AlertTriangle size={10} className="text-red-400" />
                          )}
                        </div>

                        {/* Shipment cards */}
                        <div className="space-y-2">
                          {statusGroups[status].map(s => {
                            const isDelayed = DELAYED_STATUSES.has(s.status);
                            return (
                              <div key={s._id}
                                className={`rounded-xl border p-3 transition-colors ${
                                  isDelayed
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-white border-slate-100 hover:border-slate-200'
                                }`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDelayed ? 'bg-red-100' : 'bg-slate-100'}`}>
                                      <Truck size={12} className={isDelayed ? 'text-red-500' : 'text-slate-500'} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-black text-slate-800">{s.recipientName || '—'}</span>
                                        {isDelayed && (
                                          <span className="text-[9px] font-black text-red-500 uppercase bg-red-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                            <AlertTriangle size={8} /> Delayed
                                          </span>
                                        )}
                                      </div>
                                      {s.phone && <div className="text-[10px] text-slate-400 mt-0.5">{s.phone}</div>}
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {s.city && (
                                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                            <MapPin size={9} className="text-slate-400" />{s.city}
                                          </span>
                                        )}
                                        {s.shippingPartner && (
                                          <span className="text-[10px] text-slate-400">{s.shippingPartner}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    {s.trackingId ? (
                                      <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                        {s.trackingId}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-300">No tracking ID</span>
                                    )}
                                    {s.deliveryDate && (
                                      <div className="text-[9px] text-slate-400 mt-1">
                                        ETA {new Date(s.deliveryDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {s.notes && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 italic">{s.notes}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ══ SELECTED ITEMS TAB ══ */}
        {tab === 'selected' && (() => {
          const allItems = portal.type === 'product' ? (portal.productItems||[]) : (portal.offsiteItems||[]);
          const shortlistedIds = new Set(portal.shortlistedIds || []);
          const sel = allItems.filter(i => shortlistedIds.has(String(i._id)));
          return (
            <div className="p-4 space-y-3">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Client's shortlist · {sel.length} item{sel.length !== 1 ? 's' : ''}
                </div>
                {portal.lastViewedAt && (
                  <div className="text-[10px] text-slate-300">
                    Last viewed {new Date(portal.lastViewedAt).toLocaleDateString('en-IN')}
                  </div>
                )}
              </div>

              {sel.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">🤍</div>
                  <p className="text-sm font-bold text-slate-400">No items shortlisted yet</p>
                  <p className="text-xs text-slate-300 mt-1">
                    The client hasn't ♡'d any items yet, or the portal link hasn't been opened.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sel.map(item => (
                    <div key={item._id} className="flex gap-3 items-center p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-slate-300">
                              {portal.type === 'product' ? <Package size={14} /> : <MapPin size={14} />}
                            </div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {portal.type === 'product'
                            ? `₹${Number(item.price||0).toLocaleString('en-IN')}${item.category ? ` · ${item.category}` : ''}`
                            : `${item.location || ''}${item.doublePrice > 0 ? ` · ₹${Number(item.doublePrice).toLocaleString('en-IN')}/double` : ''}`
                          }
                        </div>
                      </div>
                      <div className="text-amber-400 shrink-0">♥</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Portal analytics strip */}
              <div className="mt-2 pt-3 border-t border-slate-100 flex items-center gap-4 flex-wrap">
                <div className="text-[10px] text-slate-400">
                  <span className="font-black">Views:</span> {portal.viewCount || 0}
                </div>
                <div className="text-[10px] text-slate-400">
                  <span className="font-black">Last seen:</span> {portal.lastViewedAt ? new Date(portal.lastViewedAt).toLocaleDateString('en-IN') : 'Never'}
                </div>
                <a href={portalUrl} target="_blank" rel="noreferrer"
                  className="ml-auto flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">
                  <ExternalLink size={11} /> Open link
                </a>
              </div>
            </div>
          );
        })()}

      </div>

      {/* ── File input ──────────────────────────────────────────────────────────
          MUST be a direct child of the root div (which has position:relative from
          the OrderTracker wrapper). Off-screen via top:-200/left:-200 so it is
          invisible but still in the DOM and clickable — unlike display:none which
          breaks programmatic .click() in Chrome/Safari.
      ────────────────────────────────────────────────────────────────────────── */}
      <input
        ref={chatFileRef}
        type="file"
        multiple
        style={{ position: 'absolute', top: -200, left: -200, width: 1, height: 1, opacity: 0 }}
        onChange={e => {
          const picked = Array.from(e.target.files || []);
          if (picked.length > 0) setChatFiles(prev => [...prev, ...picked].slice(0, 5));
          e.target.value = '';
        }}
      />

    </div>
  );
};

export default ClientPortalEditor;