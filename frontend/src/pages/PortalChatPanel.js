import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { X, Send, Paperclip, Download, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';

/**
 * PortalChatPanel
 * Shown as a slide-in panel from the order row in OrderTracker.
 * Lets the logged-in Marqland employee:
 *   - See all messages between team and client
 *   - Send messages with file attachments
 *   - Copy the client portal link
 *
 * Props:
 *   order   — full order object { _id, refNumber, clientName, orderPlacedBy, ... }
 *   onClose — close the panel
 */
const PortalChatPanel = ({ order, onClose }) => {
  const { user }              = useAuth();
  const [portal, setPortal]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState('');
  const [files, setFiles]     = useState([]);
  const [sending, setSending] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');
  const chatEnd        = useRef(null);
  const fileRef        = useRef(null);
  const [toasts, setToasts]           = useState([]);
  const prevClientCount = useRef(0);  // tracks last known client message count
  const pollTimer       = useRef(null);

  const showToast = (title, body, icon = '💬') => {
    const id = Date.now();
    setToasts(p => [...p, { id, title, body, icon }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  const slug       = order.refNumber?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const portalUrl  = `${window.location.origin}/p/${slug}`;

  useEffect(() => {
    loadPortal();
    // Request browser notification permission once
    if (window.Notification?.permission === 'default') {
      window.Notification.requestPermission();
    }
    // Poll every 12 seconds for new client replies
    pollTimer.current = setInterval(() => loadPortal(true), 12000);
    return () => clearInterval(pollTimer.current);
  }, [order._id]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [portal?.messages]);

  const loadPortal = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const res = await api.get(`/portal/order/${order._id}`);
      const data = res.data;

      // ── New client message detection ────────────────────────────────────────
      if (silent && prevClientCount.current > 0) {
        const clientMsgs = (data.messages || []).filter(m => m.sender === 'client');
        if (clientMsgs.length > prevClientCount.current) {
          const newest  = clientMsgs[clientMsgs.length - 1];
          const sender  = newest.senderName || order.clientName || 'Client';
          const preview = newest.text
            ? newest.text.slice(0, 60) + (newest.text.length > 60 ? '…' : '')
            : newest.attachments?.length
              ? `📎 ${newest.attachments[0].name}`
              : 'Sent a message';
          showToast(sender, preview, '💬');
          // Browser notification
          if (window.Notification?.permission === 'granted') {
            new window.Notification(sender, {
              body: preview,
              icon: '/favicon.ico',
              tag:  'portal-client-msg',
            });
          }
        }
        prevClientCount.current = clientMsgs.length;
      } else if (!silent) {
        prevClientCount.current = (data.messages || []).filter(m => m.sender === 'client').length;
      }

      setPortal(data);
    } catch (err) {
      if (!silent) setError(err.response?.status === 404
        ? 'No portal found for this order. Add items from Products or Property List first.'
        : 'Could not load portal chat.'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const send = async () => {
    if ((!msg.trim() && files.length === 0) || sending) return;
    setSending(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('text', msg.trim());
      fd.append('senderName', user?.name || 'Marqland Team');
      files.forEach(f => fd.append('files', f));
      // Use api (axios) — auth token injected automatically by interceptor
      await api.post(`/portal/${portal.slug}/message/team`, fd);
      setMsg('');
      setFiles([]);
      showToast('Sent', 'Your message was delivered to the client.', '✅');
      await loadPortal();
    } catch (err) {
      setError('Failed to send: ' + (err.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtT = d => new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
  });
  const fmtSz = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

  return (
    // Overlay
    <div className="fixed inset-0 z-[200] flex items-center justify-end"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Panel */}
      <div className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideIn .25s ease' }}>
        <style>{`
          @keyframes slideIn{from{transform:translateX(100%)}to{transform:none}}
          @keyframes toastSlide{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
        `}</style>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-indigo-600 font-black text-sm">💬</span>
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm text-slate-800 truncate">Portal Chat</div>
              <div className="text-[10px] text-slate-400 font-bold truncate">
                {order.clientName} · {order.refNumber}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy client link */}
            <button onClick={copyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
              title="Copy client portal link">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            {/* Open portal in new tab */}
            <a href={portalUrl} target="_blank" rel="noreferrer"
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Preview client portal">
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {loading && (
            <div className="flex-1 flex items-center justify-center py-16">
              <RefreshCw className="animate-spin text-indigo-400" size={24} />
            </div>
          )}

          {!loading && error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">💬</div>
              <p className="text-sm text-amber-800 font-bold">{error}</p>
              {error.includes('No portal') && (
                <p className="text-xs text-amber-600 mt-2">
                  Go to {order.orderType === 'offsite' ? 'Property List' : 'Products'} → select items → "Add to Portal"
                </p>
              )}
            </div>
          )}

          {!loading && portal && portal.messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-300">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm font-bold text-slate-400">No messages yet</p>
              <p className="text-xs text-slate-300 mt-1">Start the conversation with {order.clientName}</p>
            </div>
          )}

          {!loading && portal && portal.messages.map(m => {
            const isTeam = m.sender === 'team';
            return (
              <div key={m._id} className={`flex gap-2.5 ${isTeam ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 self-end mb-0.5 ${isTeam ? 'bg-indigo-600 text-white' : 'bg-orange-100 text-orange-600'}`}>
                  {isTeam
                    ? (m.senderName||'T').slice(0,2).toUpperCase()
                    : (m.senderName||'C').slice(0,2).toUpperCase()
                  }
                </div>
                <div className={`max-w-[78%] ${isTeam ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`text-[9px] font-bold mb-1 ${isTeam ? 'text-right text-slate-400' : 'text-slate-400'}`}>
                    {m.senderName} · {fmtT(m.createdAt)}
                  </div>
                  <div className={`rounded-2xl px-3.5 py-2.5 ${isTeam
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                    {m.text && <div className="text-sm leading-relaxed">{m.text}</div>}
                    {/* Attachments */}
                    {(m.attachments || []).map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const res = await fetch(att.url);
                            if (!res.ok) throw new Error();
                            const blob = await res.blob();
                            const url  = URL.createObjectURL(blob);
                            const a    = document.createElement('a');
                            a.href = url; a.download = att.name;
                            document.body.appendChild(a); a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch { window.open(att.url, '_blank'); }
                        }}
                        className={`flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${isTeam
                          ? 'bg-indigo-500 text-indigo-100 hover:bg-indigo-400'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                        <Paperclip size={11} className="shrink-0" />
                        <span className="truncate max-w-[120px]">{att.name}</span>
                        {att.size > 0 && <span className="text-[9px] opacity-70">{fmtSz(att.size)}</span>}
                        <Download size={11} className="shrink-0 ml-auto" />
                      </a>
                    ))}
                  </div>
                  {/* Client messages show as "unread" indicator for team */}
                  {!isTeam && m.text && (
                    <div className="text-[9px] text-slate-300 mt-0.5">Client message</div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatEnd} />
        </div>

        {/* ── File previews ── */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1">
                <Paperclip size={11} className="text-indigo-400" />
                <span className="text-[10px] font-bold text-indigo-600 max-w-[80px] truncate">{f.name}</span>
                <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  className="text-indigo-300 hover:text-red-400 ml-0.5 flex items-center">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Input ── */}
        {portal && !error && (
          <div className="px-4 py-3 border-t border-slate-100">
            {/* Sending as indicator */}
            <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mb-1.5 px-1">
              Sending as: {user?.name || 'Marqland Team'}
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 bg-slate-50 rounded-xl border border-transparent focus-within:border-indigo-200 transition-colors">
                <textarea
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={`Message to ${order.clientName}... (Enter to send)`}
                  rows={2}
                  className="w-full bg-transparent px-3.5 pt-3 pb-1.5 text-sm outline-none resize-none text-slate-800 placeholder:text-slate-300"
                />
                <div className="px-3 pb-2.5 flex items-center gap-2 border-t border-slate-100 mt-1 pt-1.5">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Attach files">
                    <Paperclip size={13} /> Attach
                  </button>
                  <span className="text-[9px] text-slate-300">Max 5 files</span>
                </div>
              </div>
              <button onClick={send} disabled={sending || (!msg.trim() && files.length === 0)}
                className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-all shrink-0 mb-0.5">
                {sending
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Send size={14} />
                }
              </button>
            </div>
            {error && <p className="text-[11px] text-red-500 mt-1.5 px-1">{error}</p>}
          </div>
        )}

        {/* File input lives at panel root — avoids display:none + nested onClick issues */}
        <input
          ref={fileRef}
          type="file"
          multiple
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
          onChange={e => {
            const picked = Array.from(e.target.files || []);
            if (picked.length > 0) {
              setFiles(prev => [...prev, ...picked].slice(0, 5));
            }
            e.target.value = '';
          }}
        />

        {/* ── Portal status footer ── */}
        {portal && (
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${portal.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Portal {portal.status} · {(portal.productItems?.length || portal.offsiteItems?.length || 0)} items
              </span>
            </div>
            <span className="text-[10px] text-slate-300">{portal.messages?.length || 0} messages</span>
          </div>
        )}
      {/* ── Toast notifications ── */}
      {toasts.length > 0 && (
        <div style={{position:'absolute',bottom:100,left:12,right:12,display:'flex',flexDirection:'column',gap:8,zIndex:300,pointerEvents:'none'}}>
          {toasts.map(t => (
            <div key={t.id} style={{
              display:'flex',alignItems:'flex-start',gap:10,
              background:'#1a2332',border:'1px solid rgba(197,163,87,0.3)',
              borderRadius:12,padding:'11px 14px',
              boxShadow:'0 6px 20px rgba(0,0,0,0.2)',
              animation:'toastSlide .3s ease',
            }}>
              <span style={{fontSize:16,flexShrink:0}}>{t.icon}</span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:'#c5a357',marginBottom:1}}>{t.title}</div>
                <div style={{fontSize:12,color:'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default PortalChatPanel;