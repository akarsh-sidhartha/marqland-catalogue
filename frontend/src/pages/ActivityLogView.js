import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Activity, Search, Filter, RefreshCw, Trash2,
  ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Shield, Package, Users, CreditCard, Globe, Settings,
  LogIn, AlertTriangle, Download,
} from 'lucide-react';

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: '',        label: 'All',      icon: Activity,     color: '#6366f1' },
  { key: 'auth',    label: 'Auth',     icon: LogIn,        color: '#10b981' },
  { key: 'admin',   label: 'Admin',    icon: Shield,       color: '#8b5cf6' },
  { key: 'orders',  label: 'Orders',   icon: Package,      color: '#f59e0b' },
  { key: 'clients', label: 'Clients',  icon: Users,        color: '#3b82f6' },
  { key: 'products',label: 'Products', icon: Package,      color: '#ec4899' },
  { key: 'vendors', label: 'Vendors',  icon: Users,        color: '#06b6d4' },
  { key: 'portal',  label: 'Portal',   icon: Globe,        color: '#f97316' },
  { key: 'finance', label: 'Finance',  icon: CreditCard,   color: '#84cc16' },
];

const STATUS_FILTER = [
  { key: '',      label: 'All'     },
  { key: 'true',  label: 'Success' },
  { key: 'false', label: 'Failed'  },
];

const catConfig = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[0];

// Convert action code → plain English label
const ACTION_LABELS = {
  LOGIN:               'Logged in',
  LOGOUT:              'Logged out',
  REGISTER:            'Registered account',
  FORGOT_PASSWORD:     'Requested password reset',
  APPROVE_USER:        'Approved user',
  CHANGE_ROLE:         'Changed user role',
  SUSPEND_USER:        'Suspended user',
  REACTIVATE_USER:     'Reactivated user',
  DELETE_USER:         'Deleted user',
  UPDATE_ROUTES:       'Updated route access',
  SEND_INVITE:         'Sent invite',
  CREATE_ORDER:        'Created order',
  UPDATE_ORDER:        'Updated order',
  DELETE_ORDER:        'Deleted order',
  PATCH_ORDER:         'Updated order',
  CREATE_CLIENT:       'Added client',
  UPDATE_CLIENT:       'Updated client',
  DELETE_CLIENT:       'Deleted client',
  CREATE_PRODUCT:      'Added product',
  UPDATE_PRODUCT:      'Updated product',
  DELETE_PRODUCT:      'Deleted product',
  CREATE_VENDOR:       'Added vendor',
  UPDATE_VENDOR:       'Updated vendor',
  DELETE_VENDOR:       'Deleted vendor',
  CREATE_PORTAL:       'Created portal',
  SEND_PORTAL_MSG:     'Sent portal message',
  UPDATE_PORTAL_ITEMS: 'Updated portal items',
  DELETE_PORTAL:       'Deleted portal',
  PAYMENT_ACTION:      'Payment tracker action',
};
const actionLabel = (action) => ACTION_LABELS[action] || action?.replace(/_/g, ' ')?.toLowerCase() || '—';

const fmtDate = d => new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
});

const fmtDateShort = d => new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
});

// ── Role badge ────────────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => {
  const colors = {
    admin:     'bg-indigo-100 text-indigo-700',
    accounts:  'bg-green-100 text-green-700',
    sales:     'bg-yellow-100 text-yellow-700',
    inventory: 'bg-blue-100 text-blue-700',
    viewer:    'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${colors[role] || colors.viewer}`}>
      {role || 'system'}
    </span>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = '#6366f1', icon: Icon }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <div className="text-2xl font-black text-gray-800 leading-none">{value}</div>
      <div className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[10px] text-gray-300 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const ActivityLogView = () => {
  const { authFetch } = useAuth();

  // Log list state
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(true);

  // Stats state
  const [stats, setStats]       = useState(null);

  // Filter state
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('');
  const [success, setSuccess]   = useState('');
  const [page, setPage]         = useState(1);
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');

  // Purge state
  const [purging, setPurging]   = useState(false);
  const [purgeMsg, setPurgeMsg] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState('logs'); // logs | stats

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search)   params.set('search',   search);
      if (category) params.set('category', category);
      if (success)  params.set('success',  success);
      if (from)     params.set('from',     from);
      if (to)       params.set('to',       to + 'T23:59:59');

      const res  = await authFetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs  || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [page, search, category, success, from, to]);

  const fetchStats = useCallback(async () => {
    try {
      const res  = await authFetch('/api/logs/stats');
      const data = await res.json();
      setStats(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, category, success, from, to]);

  const purge = async (days) => {
    if (!window.confirm(`Delete all logs older than ${days} days?`)) return;
    setPurging(true);
    try {
      const res  = await authFetch(`/api/logs/purge?days=${days}`, { method: 'DELETE' });
      const data = await res.json();
      setPurgeMsg(data.message);
      fetchLogs();
      fetchStats();
      setTimeout(() => setPurgeMsg(''), 4000);
    } finally { setPurging(false); }
  };

  const exportCSV = () => {
    const headers = ['Time', 'User', 'Role', 'Category', 'Action', 'Summary', 'Status', 'Duration(ms)', 'IP'];
    const rows = logs.map(l => [
      fmtDate(l.createdAt),
      l.userEmail || l.userName,
      l.userRole,
      l.category,
      l.action,
      l.summary,
      l.status,
      l.duration,
      l.ip,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `activity_log_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">Activity Logs</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {total.toLocaleString()} total entries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition shadow-sm">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => { fetchLogs(); fetchStats(); }}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition shadow-sm">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-100 p-1 w-fit shadow-sm">
        {[{ k: 'logs', l: 'Log Feed' }, { k: 'stats', l: 'Stats & Summary' }].map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)}
            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === t.k ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══════════ STATS TAB ══════════ */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Actions (7d)"  value={stats.totalLast7}  icon={Activity}    color="#6366f1" />
            <StatCard label="Failed (7d)"   value={stats.failedLast7} icon={AlertTriangle} color="#ef4444" />
            <StatCard label="Top category"  value={stats.byCategory?.[0]?._id || '—'}  icon={Filter}   color="#f59e0b" />
            <StatCard label="Active users"  value={stats.byUser?.length || 0} icon={Users}    color="#10b981" />
          </div>

          {/* By category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Actions by Category (7d)</h3>
              <div className="space-y-2">
                {(stats.byCategory || []).map(c => {
                  const cfg = catConfig(c._id);
                  const pct = stats.totalLast7 > 0 ? Math.round((c.count / stats.totalLast7) * 100) : 0;
                  return (
                    <div key={c._id} className="flex items-center gap-3">
                      <cfg.icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                      <div className="text-xs font-bold text-gray-600 w-20 capitalize">{c._id || 'general'}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                      </div>
                      <div className="text-xs font-bold text-gray-500 w-10 text-right">{c.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Most active users */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Most Active Users (7d)</h3>
              <div className="space-y-3">
                {(stats.byUser || []).slice(0, 8).map((u, i) => (
                  <div key={u._id || i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                      {(u.name || u.email || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-700 truncate">{u.name || u.email}</div>
                      <RoleBadge role={u.role} />
                    </div>
                    <div className="text-sm font-black text-indigo-600">{u.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Recent Activity</h3>
            <div className="space-y-2">
              {(stats.recentActions || []).map((a, i) => {
                const cfg = catConfig(a.category);
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.color + '15' }}>
                      <cfg.icon size={11} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{a.summary}</div>
                      <div className="text-[10px] text-gray-400">{a.userName} · {fmtDateShort(a.createdAt)}</div>
                    </div>
                    {a.success ? <CheckCircle size={13} className="text-emerald-400 shrink-0" /> : <XCircle size={13} className="text-red-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Purge controls */}
          <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
            <h3 className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Trash2 size={12} /> Purge Old Logs
            </h3>
            <p className="text-xs text-gray-400 mb-4">Permanently delete log entries older than the selected period. Cannot be undone.</p>
            <div className="flex gap-2 flex-wrap">
              {[30, 60, 90, 180].map(d => (
                <button key={d} onClick={() => purge(d)} disabled={purging}
                  className="px-4 py-2 rounded-xl border border-red-100 text-xs font-bold text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                  {purging ? '...' : `Purge > ${d}d`}
                </button>
              ))}
            </div>
            {purgeMsg && <p className="text-xs text-emerald-600 font-bold mt-3">✅ {purgeMsg}</p>}
          </div>
        </div>
      )}

      {/* ══════════ LOG FEED TAB ══════════ */}
      {activeTab === 'logs' && (
        <>
          {/* ── Filters ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm space-y-3">
            {/* Search + date range */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  className="w-full pl-8 pr-4 py-2 bg-gray-50 rounded-xl text-xs font-semibold outline-none border-2 border-transparent focus:border-indigo-200 transition"
                  placeholder="Search by user, action, summary..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-semibold outline-none border-2 border-transparent focus:border-indigo-200 transition" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-semibold outline-none border-2 border-transparent focus:border-indigo-200 transition" />
              {/* Status filter */}
              <div className="flex gap-1">
                {STATUS_FILTER.map(s => (
                  <button key={s.key} onClick={() => setSuccess(s.key)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase transition ${success === s.key ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition border ${category === cat.key ? 'text-white border-transparent' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                  style={category === cat.key ? { background: cat.color, borderColor: cat.color } : {}}>
                  <cat.icon size={11} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Log table ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={22} className="animate-spin text-indigo-400" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20 text-gray-300">
                <Activity size={36} className="mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-400">No log entries found</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">What happened</th>
                    <th className="px-4 py-3 flex-1">Details</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const cfg = catConfig(log.category);
                    return (
                      <tr key={log._id || i}
                        className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors ${!log.success ? 'bg-red-50/30' : ''}`}>
                        {/* Time */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-[11px] font-bold text-gray-600">{fmtDateShort(log.createdAt)}</div>
                        </td>
                        {/* User */}
                        <td className="px-4 py-3">
                          <div className="text-xs font-bold text-gray-700 truncate max-w-[130px]">
                            {log.userName || 'System'}
                          </div>
                          <div className="mt-0.5">
                            <RoleBadge role={log.userRole} />
                          </div>
                        </td>
                        {/* What happened — icon + plain label + category dot */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: cfg.color + '18' }}>
                              <cfg.icon size={11} style={{ color: cfg.color }} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-700 leading-tight">
                                {actionLabel(log.action)}
                              </div>
                              <div className="text-[10px] font-semibold mt-0.5 capitalize" style={{ color: cfg.color }}>
                                {log.category || 'general'}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Details — summary + API call */}
                        <td className="px-4 py-3 max-w-[280px]">
                          <div className="text-xs text-gray-600 truncate">{log.summary}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              log.method === 'POST'   ? 'bg-emerald-100 text-emerald-700' :
                              log.method === 'PUT' || log.method === 'PATCH' ? 'bg-amber-100 text-amber-700' :
                              log.method === 'DELETE' ? 'bg-red-100 text-red-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>{log.method}</span>
                            <span className="text-[9px] text-gray-300 font-mono truncate">{log.path}</span>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-black flex items-center gap-1 ${log.success ? 'text-emerald-500' : 'text-red-500'}`}>
                            {log.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Pagination ── */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400 font-bold">
                Page {page} of {pages} · {total.toLocaleString()} entries
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-xl border border-gray-100 bg-white text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition shadow-sm">
                  <ChevronLeft size={15} />
                </button>
                {/* Page number pills */}
                {Array.from({ length: Math.min(7, pages) }, (_, i) => {
                  const p = page <= 4 ? i + 1 : page - 3 + i;
                  if (p < 1 || p > pages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-black transition border ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="p-2 rounded-xl border border-gray-100 bg-white text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition shadow-sm">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActivityLogView;