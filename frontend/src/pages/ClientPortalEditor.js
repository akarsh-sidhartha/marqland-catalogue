import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Link2, Plus, Trash2, Send, Check, X, Edit3,
  Package, MapPin, ChevronUp, ChevronDown, ExternalLink,
  RefreshCw, Copy, Eye, Paperclip, Download,
} from 'lucide-react';

/**
 * ClientPortalEditor
 * Shown as a panel inside the order detail modal in OrderTracker.
 * Props:
 *   order       — the full order object from OrderTracker
 *   onClose     — close the editor
 */
const ClientPortalEditor = ({ order, onClose }) => {
  const { user }                    = useAuth();
  const [portal, setPortal]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [tab, setTab]               = useState('items');  // 'items' | 'chat' | 'settings'
  const [msg, setMsg]               = useState('');
  const [chatFiles, setChatFiles]   = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [editNote, setEditNote]     = useState(false);
  const [noteText, setNoteText]     = useState('');
  const chatEndRef                  = useRef(null);
  const chatFileRef                 = useRef(null);

  const portalUrl = portal ? `${window.location.origin}/p/${portal.slug}` : '';

  // ── Load or create portal ─────────────────────────────────────────────────
  useEffect(() => {
    loadPortal();
  }, [order._id]);

  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [portal?.messages, tab]);

  const loadPortal = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/portal/order/${order._id}`);
      setPortal(res.data);
      setNoteText(res.data.teamNote || '');
    } catch (err) {
      if (err.response?.status === 404) {
        // Auto-create portal
        await createPortal();
      }
    } finally {
      setLoading(false);
    }
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

  // ── Items management ──────────────────────────────────────────────────────
  const removeItem = async (itemId) => {
    if (!portal) return;
    const isProduct = portal.type === 'product';
    const key = isProduct ? 'productItems' : 'offsiteItems';
    const updated = portal[key].filter(i => i._id !== itemId);
    await saveItems(updated);
  };

  const moveItem = async (itemId, dir) => {
    if (!portal) return;
    const key = portal.type === 'product' ? 'productItems' : 'offsiteItems';
    const items = [...portal[key]];
    const idx = items.findIndex(i => i._id === itemId);
    if (dir === 'up' && idx > 0) [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    if (dir === 'down' && idx < items.length - 1) [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    await saveItems(items);
  };

  const saveItems = async (items) => {
    setSaving(true);
    try {
      const key = portal.type === 'product' ? 'productItems' : 'offsiteItems';
      const res = await api.put(`/portal/${portal.slug}/items`, { [key]: items });
      setPortal(res.data);
    } finally {
      setSaving(false);
    }
  };

  // ── Add items from selection (called from OrderTracker via prop or modal) ─
  // Products / properties are added via the "Add from catalogue" sheet below

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!msg.trim() && chatFiles.length === 0) || sendingMsg) return;
    setSendingMsg(true);
    try {
      const fd = new FormData();
      fd.append('text', msg.trim());
      fd.append('senderName', user?.name || 'Marqland Team');
      chatFiles.forEach(f => fd.append('files', f));
      // Use fetch directly since api (axios) needs special config for FormData
      const token = localStorage.getItem('marqland_token');
      await fetch(`/api/portal/${portal.slug}/message/team`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      setMsg('');
      setChatFiles([]);
      await loadPortal();
    } finally {
      setSendingMsg(false);
    }
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const saveMeta = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/portal/${portal.slug}/meta`, { teamNote: noteText });
      setPortal(res.data);
      setEditNote(false);
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async () => {
    if (!window.confirm('Mark this order as completed? The client will see the thank-you screen.')) return;
    setSaving(true);
    try {
      const res = await api.put(`/portal/${portal.slug}/complete`, {});
      setPortal(res.data);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <RefreshCw className="animate-spin text-indigo-400" size={28} />
      </div>
    );
  }

  if (!portal) return null;

  const items = portal.type === 'product' ? portal.productItems : portal.offsiteItems;
  const isCompleted = portal.status === 'completed';

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-slate-200">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Link2 size={16} className="text-white" />
          </div>
          <div>
            <div className="font-black text-sm text-slate-800 uppercase tracking-tight">Client Portal</div>
            <div className="text-[10px] text-slate-400 font-bold">{portal.type === 'product' ? 'Product' : 'Offsite'} · {portal.orderRef}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-full uppercase">Completed</span>
          )}
          <button onClick={copyLink} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a href={portalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all">
            <Eye size={12} /> Preview
          </a>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-100">
        {['items', 'chat', 'settings'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${tab === t ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
            {t === 'items' ? `Options (${items.length})` : t === 'chat' ? `Chat (${portal.messages.length})` : 'Settings'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── ITEMS TAB ── */}
        {tab === 'items' && (
          <div className="p-4 space-y-3">
            {/* Team intro note */}
            <div className="bg-indigo-50 rounded-xl p-3">
              {editNote ? (
                <div className="space-y-2">
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    className="w-full bg-white rounded-lg p-2 text-sm outline-none border border-indigo-200 resize-none"
                    rows={3} placeholder="Write an intro note for the client..." />
                  <div className="flex gap-2">
                    <button onClick={saveMeta} disabled={saving} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">Save</button>
                    <button onClick={() => setEditNote(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-indigo-700 flex-1">{noteText || <span className="text-indigo-300 italic">Add an intro note for the client...</span>}</p>
                  <button onClick={() => setEditNote(true)} className="text-indigo-400 hover:text-indigo-600 shrink-0"><Edit3 size={13} /></button>
                </div>
              )}
            </div>

            {/* Items list */}
            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">No items added yet</p>
                <p className="text-xs mt-1">Go to {portal.type === 'product' ? 'Products' : 'Properties'} and select items to add</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={item._id} className="bg-slate-50 rounded-xl p-3 flex gap-3 items-start group">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        {portal.type === 'product' ? <Package size={20} /> : <MapPin size={20} />}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                    {portal.type === 'product' ? (
                      <div className="text-[11px] text-slate-500 mt-0.5">₹{item.price?.toLocaleString('en-IN') || 0}</div>
                    ) : (
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.location} · ₹{item.doublePrice?.toLocaleString('en-IN')}/double</div>
                    )}
                    {item.note && <div className="text-[10px] text-indigo-600 mt-1 italic">{item.note}</div>}
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveItem(item._id, 'up')} disabled={idx === 0} className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronUp size={13} /></button>
                    <button onClick={() => moveItem(item._id, 'down')} disabled={idx === items.length - 1} className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={13} /></button>
                    <button onClick={() => removeItem(item._id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))
            )}

            {/* Add items hint */}
            <div className="text-center pt-2 pb-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                To add items → go to {portal.type === 'product' ? 'Products page' : 'Property List'} · select items · click "Add to Portal"
              </p>
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {tab === 'chat' && (
          <div className="flex flex-col h-full" style={{ minHeight: 400 }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {portal.messages.length === 0 && (
                <div className="text-center py-8 text-slate-300 text-sm">No messages yet. Start the conversation.</div>
              )}
              {portal.messages.map(m => (
                <div key={m._id} className={`flex ${m.sender === 'team' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${m.sender === 'team' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                    <div className={`text-[10px] font-bold mb-1 ${m.sender === 'team' ? 'text-indigo-200' : 'text-slate-400'}`}>{m.senderName}</div>
                    {m.text && <div className="text-sm leading-snug">{m.text}</div>}
                    {(m.attachments||[]).map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer" download={att.name}
                        className={`flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${m.sender==='team' ? 'bg-indigo-500 text-indigo-100 hover:bg-indigo-400' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                        <Paperclip size={11} />
                        <span className="truncate max-w-[120px]">{att.name}</span>
                        <Download size={11} className="shrink-0" />
                      </a>
                    ))}
                    <div className={`text-[9px] mt-1 ${m.sender === 'team' ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {new Date(m.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {/* Message input */}
            <div className="p-3 border-t border-slate-100">
              {/* File previews */}
              {chatFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {chatFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1">
                      <Paperclip size={11} className="text-indigo-400" />
                      <span className="text-[10px] font-bold text-indigo-600 max-w-[90px] truncate">{f.name}</span>
                      <button onClick={() => setChatFiles(chatFiles.filter((_,idx)=>idx!==i))} className="text-indigo-300 hover:text-red-400 ml-0.5">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-slate-50 rounded-xl border border-transparent focus-within:border-indigo-200 transition-colors">
                  <textarea
                    value={msg}
                    onChange={e => setMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={`Message as ${user?.name || 'Team'}... (Enter to send)`}
                    rows={2}
                    className="w-full bg-transparent px-4 pt-2.5 pb-1 text-sm outline-none resize-none"
                  />
                  <div className="px-3 pb-2 flex items-center gap-2">
                    <button onClick={() => chatFileRef.current?.click()} className="p-1 text-slate-300 hover:text-indigo-500 transition-colors" title="Attach file">
                      <Paperclip size={14} />
                    </button>
                    <input ref={chatFileRef} type="file" multiple className="hidden"
                      onChange={e => { setChatFiles(prev => [...prev, ...Array.from(e.target.files||[])].slice(0,5)); e.target.value=''; }} />
                    <span className="text-[9px] text-slate-300 font-bold">Sending as: {user?.name || 'Marqland Team'}</span>
                  </div>
                </div>
                <button onClick={sendMessage} disabled={sendingMsg || (!msg.trim() && chatFiles.length===0)}
                  className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shrink-0">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <div className="p-4 space-y-4">
            {/* Portal link */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client link</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 truncate">{portalUrl}</code>
                <a href={portalUrl} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-indigo-600">
                  <ExternalLink size={14} />
                </a>
              </div>
              <div className="text-[10px] text-slate-400">Views: {portal.viewCount || 0} · Last viewed: {portal.lastViewedAt ? new Date(portal.lastViewedAt).toLocaleDateString('en-IN') : 'Never'}</div>
            </div>

            {/* Complete order */}
            {!isCompleted && (
              <div className="bg-emerald-50 rounded-xl p-3 space-y-2">
                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Mark as completed</div>
                <p className="text-xs text-slate-600">Client will see a thank-you screen with a Google review prompt.</p>
                <button onClick={markComplete} disabled={saving} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase hover:bg-emerald-700 transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : 'Complete this order'}
                </button>
              </div>
            )}
            {isCompleted && (
              <div className="bg-emerald-100 rounded-xl p-3 text-center">
                <Check size={24} className="text-emerald-600 mx-auto mb-2" />
                <div className="text-sm font-black text-emerald-800">Order completed</div>
                <div className="text-xs text-emerald-600 mt-1">{new Date(portal.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              </div>
            )}

            {/* Portal type */}
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portal type</div>
              <div className="flex items-center gap-2">
                {portal.type === 'product' ? <Package size={14} className="text-indigo-500" /> : <MapPin size={14} className="text-orange-500" />}
                <span className="text-sm font-bold text-slate-700 capitalize">{portal.type === 'product' ? 'Product gifting' : 'Offsite / property'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPortalEditor;