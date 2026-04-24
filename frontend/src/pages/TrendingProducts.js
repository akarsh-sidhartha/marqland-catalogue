import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import {
  RefreshCw, Search, Filter, ExternalLink, Globe, Mail, Phone,
  ChevronDown, X, Loader2, Check, Eye, Star, Trash2, Download,
  TrendingUp, AlertCircle, Play, Clock, CheckCircle2, XCircle,
  BarChart2, Zap, Tag, Upload, ImageIcon, Sparkles,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN: clean dark editorial dashboard — slate/zinc base with amber accents
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  'google_images_in':     { label: 'Google IN',  color: '#4ade80', icon: '🇮🇳' },
  'google_images_global': { label: 'Google',     color: '#60a5fa', icon: '🌐' },
  'pinterest':            { label: 'Pinterest',  color: '#f43f5e', icon: '📌' },
  'google_shopping_in':   { label: 'Shopping',   color: '#fb923c', icon: '🛍️' },
};

const STATUS_CONFIG = {
  new:       { label: 'New',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  icon: <Zap      size={10}/> },
  reviewed:  { label: 'Reviewed',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', icon: <Eye      size={10}/> },
  promoted:  { label: 'Promoted',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  icon: <Star     size={10}/> },
  dismissed: { label: 'Dismissed', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: <XCircle  size={10}/> },
};

const INDUSTRY_COLORS = {
  'IT':            '#6366f1',
  'Pharma':        '#0ea5e9',
  'Cement':        '#f59e0b',
  'Paints':        '#ec4899',
  'FMCG':          '#8b5cf6',
  'Finance':       '#14b8a6',
  'Manufacturing': '#f97316',
  'Healthcare':    '#22c55e',
  'Education':     '#a855f7',
  'Real Estate':   '#ef4444',
};

const industryColor = ind => INDUSTRY_COLORS[ind] || '#94a3b8';

// ── Pill badge ────────────────────────────────────────────────────────────────
const Pill = ({ label, color, bg, icon, small }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: bg || `${color}18`,
    color: color || '#94a3b8',
    fontSize: small ? 9 : 10,
    fontWeight: 700,
    padding: small ? '2px 7px' : '3px 9px',
    borderRadius: 20,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }}>
    {icon}{label}
  </span>
);

// ── Stats bar ─────────────────────────────────────────────────────────────────
const StatsBar = ({ stats }) => {
  if (!stats) return null;
  const statusMap = Object.fromEntries((stats.byStatus || []).map(s => [s._id, s.count]));
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        { label: 'Total',     val: stats.total,                color: '#f0f4ff' },
        { label: 'New',       val: statusMap.new       || 0,   color: '#818cf8' },
        { label: 'Reviewed',  val: statusMap.reviewed  || 0,   color: '#38bdf8' },
        { label: 'Promoted',  val: statusMap.promoted  || 0,   color: '#4ade80' },
        { label: 'Dismissed', val: statusMap.dismissed || 0,   color: '#f87171' },
      ].map(s => (
        <div key={s.label} style={{
          background: '#1e2433', borderRadius: 10, padding: '10px 18px',
          display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80,
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</span>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Run progress overlay ──────────────────────────────────────────────────────
const RunProgress = ({ runState, onDismiss }) => {
  if (!runState?.running && !runState?.lastResult) return null;
  const progress  = runState.progress || {};
  const industries = Object.keys(progress);
  const totalDone  = industries.reduce((s, k) => s + (progress[k]?.done || 0), 0);
  const totalAll   = industries.reduce((s, k) => s + (progress[k]?.total || 0), 0);
  const pct        = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 200,
      background: '#1e2433', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '18px 22px', width: 340,
      boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {runState.running
            ? <Loader2 size={15} className="animate-spin" style={{ color: '#6366f1' }} />
            : <CheckCircle2 size={15} style={{ color: '#22c55e' }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff' }}>
            {runState.running ? 'Discovery running…' : 'Run complete'}
          </span>
        </div>
        {!runState.running && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ background: '#0f1623', borderRadius: 6, height: 6, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          width: `${runState.lastResult ? 100 : pct}%`,
          height: '100%',
          background: runState.lastResult ? '#22c55e' : 'linear-gradient(90deg,#6366f1,#818cf8)',
          borderRadius: 6,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Industry rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
        {industries.length === 0 && runState.running && (
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Starting up…</p>
        )}
        {industries.map(ind => {
          const p = progress[ind];
          return (
            <div key={ind} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: industryColor(ind), flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{ind}</span>
              <span style={{ fontSize: 11, color: '#475569' }}>
                {p.done}/{p.total}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>+{p.saved}</span>
            </div>
          );
        })}
      </div>

      {runState.lastResult && !runState.lastResult.error && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
          ✅ {runState.lastResult.totalSaved} new products saved
        </div>
      )}
      {runState.lastResult?.error && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#f87171' }}>❌ {runState.lastResult.error}</div>
      )}
    </div>
  );
};

// ── Product Card ──────────────────────────────────────────────────────────────
const ProductCard = ({ product, onStatusChange, onDelete, isSelected, onToggleSelect }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const sc = STATUS_CONFIG[product.status] || STATUS_CONFIG.new;

  const statusActions = [
    { status: 'reviewed',  label: 'Mark Reviewed',  icon: <Eye     size={12}/> },
    { status: 'promoted',  label: 'Mark Promoted',  icon: <Star    size={12}/> },
    { status: 'dismissed', label: 'Dismiss',        icon: <XCircle size={12}/> },
    { status: 'new',       label: 'Reset to New',   icon: <Zap     size={12}/> },
  ].filter(a => a.status !== product.status);

  return (
    <div style={{
      background: '#1a2235',
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'border-color 0.2s, transform 0.2s',
      position: 'relative',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 190, background: '#0f1623', overflow: 'hidden', flexShrink: 0 }}>
        {product.imageUrl && !imgError
          ? <img src={product.imageUrl} alt={product.name}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#2d3a4f' }}>
              <TrendingUp size={32} />
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>No image</span>
            </div>
        }

        {/* Select checkbox — top-left corner */}
        <div
          onClick={e => { e.stopPropagation(); onToggleSelect(product._id); }}
          style={{
            position: 'absolute', top: 8, left: 8, zIndex: 4,
            width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
            background: isSelected ? '#6366f1' : 'rgba(10,20,34,0.7)',
            border: `2px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', backdropFilter: 'blur(4px)',
          }}>
          {isSelected && <Check size={12} style={{ color: '#fff', strokeWidth: 3 }} />}
        </div>

        {/* Industry badge + source engine badge */}
        <div style={{ position: 'absolute', top: 10, left: 38, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Pill label={product.industry} color={industryColor(product.industry)} small />
          {product.sourceEngine && SOURCE_CONFIG[product.sourceEngine] && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              color: SOURCE_CONFIG[product.sourceEngine].color,
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              border: `1px solid ${SOURCE_CONFIG[product.sourceEngine].color}40`,
            }}>
              {SOURCE_CONFIG[product.sourceEngine].icon} {SOURCE_CONFIG[product.sourceEngine].label}
            </span>
          )}
        </div>

        {/* Status badge */}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <Pill label={sc.label} color={sc.color} bg={sc.bg} icon={sc.icon} small />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{
          fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {product.name}
        </h3>

        {product.description && (
          <p style={{
            fontSize: 11, color: '#475569', lineHeight: 1.55, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {product.description}
          </p>
        )}

        {/* Source */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto', paddingTop: 6 }}>
          <Globe size={10} style={{ color: '#475569', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {product.sourceDomain || 'Unknown source'}
          </span>
        </div>

        {/* Supplier info if available */}
        {(product.supplier?.email || product.supplier?.phone) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {product.supplier.email && (
              <a href={`mailto:${product.supplier.email}`} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#6366f1', textDecoration: 'none' }}>
                <Mail size={9} />{product.supplier.email.slice(0, 22)}{product.supplier.email.length > 22 ? '…' : ''}
              </a>
            )}
            {product.supplier.phone && (
              <a href={`tel:${product.supplier.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#6366f1', textDecoration: 'none' }}>
                <Phone size={9} />{product.supplier.phone}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <a href={product.sourceUrl} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: '#6366f1', textDecoration: 'none' }}
          onClick={e => e.stopPropagation()}>
          <ExternalLink size={10} /> View Source
        </a>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Status dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0f1623', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>
              <ChevronDown size={10} /> Status
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', bottom: '110%', right: 0, background: '#1e2433',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 6,
                zIndex: 100, minWidth: 160, boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              }}>
                {statusActions.map(a => (
                  <button key={a.status}
                    onClick={() => { onStatusChange(product._id, a.status); setMenuOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontWeight: 600, borderRadius: 6, textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {a.icon}{a.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 4, paddingTop: 4 }}>
                  <button
                    onClick={() => { onDelete(product._id); setMenuOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, fontWeight: 600, borderRadius: 6, textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TrendingProducts() {
  const [products,    setProducts]    = useState([]);
  const [stats,       setStats]       = useState(null);
  const [industries,  setIndustries]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [runState,    setRunState]    = useState(null);
  const [filters, setFilters] = useState({ industry: 'all', status: 'all', search: '', sourceEngine: 'all' });
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);
  const [dismissedId, setDismissedId] = useState(null); // progress panel visibility
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [imgSearchFile,   setImgSearchFile]   = useState(null);
  const [imgSearchPreview,setImgSearchPreview]= useState(null);
  const [imgSearching,    setImgSearching]    = useState(false);
  const [imgSearchResult, setImgSearchResult] = useState(null); // { analysis, saved, skipped }
  const imgFileRef = React.useRef(null);

  // ── Multi-select state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };
  const selectAll  = () => setSelectedIds(new Set(products.map(p => p._id)));
  const clearAll   = () => setSelectedIds(new Set());

  const handleBulkStatus = async (status) => {
    if (!selectedIds.size) return;
    try {
      await Promise.all([...selectedIds].map(id =>
        api.patch(`/trending-products/${id}/status`, { status })
      ));
      setProducts(prev => prev.map(p => selectedIds.has(p._id) ? { ...p, status } : p));
      setSelectedIds(new Set());
      fetchStats();
    } catch (err) { alert('Bulk update failed: ' + err.message); }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected products?`)) return;
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/trending-products/${id}`)));
      setProducts(prev => prev.filter(p => !selectedIds.has(p._id)));
      setSelectedIds(new Set());
      fetchStats();
    } catch (err) { alert('Bulk delete failed: ' + err.message); }
  };
  const pollRef = useRef(null);
  const LIMIT   = 24;

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT, ...filters };
      if (filters.industry     === 'all') delete params.industry;
      if (filters.status       === 'all') delete params.status;
      if (filters.sourceEngine === 'all') delete params.sourceEngine;
      if (!filters.search)                delete params.search;

      const res = await api.get('/trending-products', { params });
      setProducts(res.data.products || []);
      setTotalPages(res.data.pages  || 1);
      setTotalCount(res.data.total  || 0);
      setPage(pg);
    } catch (err) {
      console.error('Failed to fetch trending products:', err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, indRes] = await Promise.all([
        api.get('/trending-products/stats'),
        api.get('/trending-products/industries'),
      ]);
      setStats(statsRes.data);
      setIndustries(indRes.data || []);
    } catch {}
  }, []);

  const fetchRunState = useCallback(async () => {
    try {
      const res = await api.get('/trending-products/run/status');
      setRunState(res.data);
      // Stop polling when run finishes
      if (!res.data.running && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        fetchProducts(1);
        fetchStats();
      }
    } catch {}
  }, [fetchProducts, fetchStats]);

  useEffect(() => {
    fetchProducts(1);
    fetchStats();
    fetchRunState();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => { fetchProducts(1); setSelectedIds(new Set()); }, [filters]);

  // ── Trigger manual run ──────────────────────────────────────────────────────
  const handleRun = async (industriesToRun = []) => {
    try {
      const body = industriesToRun.length > 0 ? { industries: industriesToRun } : {};
      await api.post('/trending-products/run', body);
      // Start polling for progress
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchRunState, 2000);
      }
      fetchRunState();
    } catch (err) {
      alert('Could not start run: ' + (err.response?.data?.message || err.message));
    }
  };

  // ── Status change ───────────────────────────────────────────────────────────
  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/trending-products/${id}/status`, { status });
      setProducts(prev => prev.map(p => p._id === id ? { ...p, status } : p));
      fetchStats();
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/trending-products/${id}`);
      setProducts(prev => prev.filter(p => p._id !== id));
      fetchStats();
    } catch (err) { alert('Delete failed: ' + err.message); }
  };

  const handlePurgeDismissed = async () => {
    if (!window.confirm('Permanently delete all dismissed products?')) return;
    try {
      const res = await api.delete('/trending-products/bulk/dismissed');
      alert(`Deleted ${res.data.deleted} products.`);
      fetchProducts(1);
      fetchStats();
    } catch (err) { alert('Purge failed: ' + err.message); }
  };

  // ── Image search handler ────────────────────────────────────────────────────
  const handleImageSearch = async () => {
    if (!imgSearchFile || imgSearching) return;
    setImgSearching(true);
    setImgSearchResult(null);
    try {
      const fd = new FormData();
      fd.append('image', imgSearchFile);
      // Async mode — backend starts job and returns immediately (no timeout risk).
      // We reuse the existing runState polling to track progress and detect completion.
      await api.post('/trending-products/search-by-image', fd);
      // Start polling every 2s — same as the daily run button
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchRunStateForImgSearch, 2000);
      }
      fetchRunStateForImgSearch();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '';
      alert('Image search failed to start: ' + msg);
      setImgSearching(false);
    }
    // Note: setImgSearching(false) is called inside fetchRunStateForImgSearch
    // when the run finishes, not here.
  };

  // Polls runState specifically for image search — updates imgSearchResult when done
  const fetchRunStateForImgSearch = async () => {
    try {
      const res = await api.get('/trending-products/run/status');
      setRunState(res.data);
      if (!res.data.running) {
        // Job finished
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setImgSearching(false);
        if (res.data.lastResult && !res.data.lastResult.error) {
          setImgSearchResult(res.data.lastResult);
        } else if (res.data.lastResult?.error) {
          alert('Image search failed: ' + res.data.lastResult.error);
        }
        fetchProducts(1);
        fetchStats();
      }
    } catch {
      setImgSearching(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
  };

  const handleImgFileChange = (file) => {
    if (!file) return;
    setImgSearchFile(file);
    setImgSearchResult(null);
    const url = URL.createObjectURL(file);
    setImgSearchPreview(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f1623', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '32px 32px 80px' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .animate-spin { animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#6366f1,#818cf8)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f0f4ff', margin: 0, letterSpacing: '-0.02em' }}>Trending Products</h1>
          </div>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Daily discovery of corporate gifting trends across industries
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {stats?.byStatus?.find(s => s._id === 'dismissed')?.count > 0 && (
            <button onClick={handlePurgeDismissed}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#f87171' }}>
              <Trash2 size={13} /> Purge Dismissed
            </button>
          )}
          <button
            onClick={() => setShowImageSearch(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: showImageSearch ? 'rgba(99,102,241,0.15)' : '#1a2235', border: `1px solid ${showImageSearch ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: showImageSearch ? '#818cf8' : '#94a3b8' }}>
            <ImageIcon size={14} /> Search by Image
          </button>
          <button
            onClick={() => handleRun()}
            disabled={runState?.running}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: runState?.running ? '#1e2433' : 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: runState?.running ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: runState?.running ? '#475569' : '#fff', opacity: runState?.running ? 0.7 : 1 }}>
            {runState?.running
              ? <><Loader2 size={14} className="animate-spin" /> Running…</>
              : <><Play size={14} /> Run Discovery Now</>
            }
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ marginBottom: 24 }}>
        <StatsBar stats={stats} />
      </div>

      {/* ── Image Search Panel ── */}
      {showImageSearch && (
        <div style={{
          background: '#1a2235', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 14, padding: 20, marginBottom: 20,
          display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          {/* Left: upload area */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Sparkles size={12} style={{ display: 'inline', marginRight: 5 }} />
                Search by Product Image
              </p>
              <button
                onClick={() => setShowImageSearch(false)}
                title="Close"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', flexShrink: 0, marginLeft: 12 }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.15)'; e.currentTarget.style.color='#f87171'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#475569'; }}
              >
                <X size={13} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#475569', marginBottom: 12, maxWidth: 320, lineHeight: 1.6 }}>
              Upload a photo of a product you're looking for. Gemini will identify it and search for that product and similar ones across the web.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => imgFileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleImgFileChange(f); }}
              style={{
                width: 200, height: 200, borderRadius: 12,
                border: `2px dashed ${imgSearchPreview ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                background: imgSearchPreview ? 'transparent' : '#0f1623',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                transition: 'border-color 0.2s',
              }}>
              {imgSearchPreview
                ? <img src={imgSearchPreview} alt="Upload preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: '#334155' }}>
                    <Upload size={28} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 11, fontWeight: 600 }}>Click or drag image</div>
                    <div style={{ fontSize: 10, marginTop: 4, color: '#1e2d40' }}>JPG, PNG, WEBP</div>
                  </div>
              }
              {imgSearchPreview && (
                <button
                  onClick={e => { e.stopPropagation(); setImgSearchFile(null); setImgSearchPreview(null); setImgSearchResult(null); }}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <input ref={imgFileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleImgFileChange(e.target.files[0]); e.target.value = ''; }} />

            <button
              onClick={handleImageSearch}
              disabled={!imgSearchFile || imgSearching}
              style={{
                marginTop: 12, width: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: (!imgSearchFile || imgSearching) ? '#0f1623' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                border: 'none', borderRadius: 10, padding: '11px 0',
                cursor: (!imgSearchFile || imgSearching) ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700,
                color: (!imgSearchFile || imgSearching) ? '#334155' : '#fff',
                opacity: (!imgSearchFile || imgSearching) ? 0.6 : 1,
                transition: 'all 0.2s',
              }}>
              {imgSearching
                ? <><Loader2 size={14} className="animate-spin" /> Searching…</>
                : <><Sparkles size={14} /> Find Similar Products</>
              }
            </button>
          </div>

          {/* Right: Gemini analysis result + found count */}
          {(imgSearching || imgSearchResult) && (
            <div style={{ flex: 1, minWidth: 260 }}>
              {imgSearching && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 600 }}>Analysing image with Gemini…</span>
                  </div>
                  {/* Live progress from runState */}
                  {runState?.progress?.['Image Search'] && (
                    <div style={{ background: '#0f1623', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                      <span style={{ color: '#818cf8', fontWeight: 600 }}>
                        {runState.progress['Image Search'].stage === 'analysing' ? '🔍 ' : '🌐 '}
                        {runState.progress['Image Search'].message}
                      </span>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: '#334155', lineHeight: 1.5, marginTop: 4, padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, margin: 0 }}>
                    ⏱ Running in background — takes 1–3 minutes. You can browse the grid below while waiting.
                  </p>
                </div>
              )}

              {imgSearchResult && !imgSearching && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* What Gemini identified */}
                  <div style={{ background: '#0f1623', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Gemini identified
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                      {imgSearchResult.analysis?.productName}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 8 }}>
                      {imgSearchResult.analysis?.description}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {imgSearchResult.analysis?.industry}
                      </span>
                    </div>
                  </div>

                  {/* Queries used */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Searched for
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(imgSearchResult.analysis?.queries || []).map((q, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11, color: '#475569' }}>
                          <span style={{ color: '#6366f1', flexShrink: 0, marginTop: 1 }}>→</span>
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Result count */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{imgSearchResult.saved}</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>New saved</div>
                    </div>
                    <div style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#475569', lineHeight: 1 }}>{imgSearchResult.skipped}</div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Already known</div>
                    </div>
                  </div>

                  <button
                    onClick={() => { setFilters(f => ({ ...f, industry: imgSearchResult.analysis?.industry || 'all' })); setShowImageSearch(false); }}
                    style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', borderRadius: 10, padding: '10px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Filter size={13} /> View Results in Grid
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Industry breakdown chips ── */}
      {stats?.byIndustry?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {stats.byIndustry.map(s => (
            <button key={s._id}
              onClick={() => setFilters(f => ({ ...f, industry: f.industry === s._id ? 'all' : s._id }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: filters.industry === s._id ? `${industryColor(s._id)}22` : '#1a2235',
                border: `1px solid ${filters.industry === s._id ? industryColor(s._id) + '60' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                color: filters.industry === s._id ? industryColor(s._id) : '#64748b',
                transition: 'all 0.15s',
              }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: industryColor(s._id) }} />
              {s._id}
              <span style={{ fontSize: 10, color: '#475569' }}>({s.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        background: '#1a2235', borderRadius: 12, padding: '12px 16px', marginBottom: 24,
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            type="text"
            placeholder="Search products, sources…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{ width: '100%', background: '#0f1623', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 10px 7px 30px', color: '#e2e8f0', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        {/* Status filter */}
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 12px', color: '#94a3b8', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="promoted">Promoted</option>
          <option value="dismissed">Dismissed</option>
        </select>

        {/* Source engine filter */}
        <select value={filters.sourceEngine || 'all'} onChange={e => setFilters(f => ({ ...f, sourceEngine: e.target.value }))}
          style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 12px', color: '#94a3b8', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
          <option value="all">All Sources</option>
          <option value="google_images_in">🇮🇳 Google India</option>
          <option value="google_images_global">🌐 Google Global</option>
          <option value="pinterest">📌 Pinterest</option>
          <option value="google_shopping_in">🛍️ Google Shopping</option>
        </select>

        {/* Industry filter */}
        <select value={filters.industry} onChange={e => setFilters(f => ({ ...f, industry: e.target.value }))}
          style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 12px', color: '#94a3b8', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
          <option value="all">All Industries</option>
          {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>

        {/* Reset */}
        {(filters.industry !== 'all' || filters.status !== 'all' || filters.search || filters.sourceEngine !== 'all') && (
          <button onClick={() => setFilters({ industry: 'all', status: 'all', search: '' })}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 12, padding: 4 }}>
            <X size={12} /> Reset
          </button>
        )}

        <span style={{ fontSize: 11, color: '#334155', marginLeft: 'auto' }}>
          {totalCount} product{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: '#6366f1' }} />
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Loading products…</span>
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <TrendingUp size={48} style={{ color: '#1e2433', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#334155', marginBottom: 8 }}>No products found</h3>
          <p style={{ fontSize: 13, color: '#1e2433', marginBottom: 24 }}>
            {filters.industry !== 'all' || filters.status !== 'all' || filters.search
              ? 'Try adjusting your filters.'
              : 'Run a discovery to find trending corporate gifts.'}
          </p>
          {filters.industry === 'all' && filters.status === 'all' && !filters.search && (
            <button onClick={() => handleRun()}
              style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', borderRadius: 10, padding: '11px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Play size={14} /> Run First Discovery
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Select-all bar + bulk action bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={selectedIds.size === products.length ? clearAll : selectAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${selectedIds.size === products.length && products.length > 0 ? '#6366f1' : '#334155'}`, background: selectedIds.size === products.length && products.length > 0 ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedIds.size === products.length && products.length > 0 && <Check size={8} style={{ color: '#fff', strokeWidth: 3 }} />}
                </div>
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
              </button>
              {selectedIds.size > 0 && (
                <button onClick={clearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#475569', padding: '4px 8px' }}>
                  Clear
                </button>
              )}
            </div>

            {/* Bulk actions — only shown when items are selected */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#475569', marginRight: 4 }}>Bulk actions:</span>
                <button onClick={() => handleBulkStatus('reviewed')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
                  <Eye size={11} /> Reviewed
                </button>
                <button onClick={() => handleBulkStatus('promoted')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#4ade80' }}>
                  <Star size={11} /> Promote
                </button>
                <button onClick={() => handleBulkStatus('dismissed')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                  <XCircle size={11} /> Dismiss
                </button>
                <button onClick={handleBulkDelete}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {products.map(p => (
              <ProductCard
                key={p._id}
                product={p}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                isSelected={selectedIds.has(p._id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32 }}>
              <button onClick={() => fetchProducts(page - 1)} disabled={page <= 1}
                style={{ padding: '7px 14px', background: '#1a2235', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#94a3b8', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: page <= 1 ? 0.4 : 1 }}>
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: '#475569', padding: '0 8px' }}>
                Page {page} of {totalPages}
              </span>
              <button onClick={() => fetchProducts(page + 1)} disabled={page >= totalPages}
                style={{ padding: '7px 14px', background: '#1a2235', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#94a3b8', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: page >= totalPages ? 0.4 : 1 }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Run progress overlay ── */}
      <RunProgress
        runState={runState}
        onDismiss={() => setRunState(s => ({ ...s, lastResult: null }))}
      />

    </div>
  );
}