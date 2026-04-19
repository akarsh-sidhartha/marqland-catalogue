import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Clock, CheckCircle2, XCircle,
  RefreshCw, Trash2, Mail, Send, X, Link2
} from 'lucide-react';

const ROLES = ['admin', 'accounts', 'sales', 'inventory', 'viewer'];

// ── All routes in the app — key = route name, path = used in ProtectedRoute ──
// ⚠ KEEP IN SYNC WITH PATH_TO_ROUTE_KEY in App.js.
// When you add a new page: 1) add it here, 2) add it to App.js PATH_TO_ROUTE_KEY.
const ALL_ROUTES = [
  { key: 'Order Tracker',    path: '/'                },
  { key: 'Sourcing Hub',     path: '/sourcinghub'     },
  { key: 'Products',         path: '/products'        },
  { key: 'Samples Provided', path: '/samplesprovided' },
  { key: 'Saved Catalogues', path: '/savedcatalogues' },
  { key: 'Payment Tracker',  path: '/paymenttracker'  },
  { key: 'Vendors',          path: '/vendors'         },
  { key: 'Clients',          path: '/clients'         },
  { key: 'Letter Head',      path: '/MarqlandLetterHead' },
  { key: 'Invoice Tracking', path: '/InvoiceTracking' },
  { key: 'Property List',    path: '/properties'      },
  { key: 'Saved Offsites',   path: '/saved-offsites'  },
  { key: 'User Management',  path: '/admin/users'     },
  { key: 'Activity Logs',    path: '/admin/logs'      },
];

// Default routes per role — used when allowedRoutes is empty
const ROLE_DEFAULTS = {
  admin:     ALL_ROUTES.map(r => r.key),
  accounts:  ['Order Tracker','Payment Tracker','Vendors','Clients','Invoice Tracking'],
  sales:     ['Order Tracker','Sourcing Hub','Products','Saved Catalogues','Clients','Property List','Saved Offsites'],
  inventory: ['Products','Samples Provided','Saved Catalogues','Sourcing Hub','Property List','Saved Offsites'],
  viewer:    ['Order Tracker'],
};

// Resolve the effective route list for a user
// If allowedRoutes is set (non-empty), use it. Otherwise fall back to role defaults.
const effectiveRoutes = (user) =>
  user.allowedRoutes?.length ? user.allowedRoutes : (ROLE_DEFAULTS[user.role] || []);

// ── Interactive route access editor ──────────────────────────────────────────
const RouteAccessEditor = ({ user, onSaved }) => {
  const { authFetch } = useAuth();
  const [selected, setSelected] = React.useState(() => new Set(effectiveRoutes(user)));
  const [saving, setSaving]     = React.useState(false);
  const [saved, setSaved]       = React.useState(false);
  const isAdmin = user.role === 'admin';

  // Keep in sync if parent user changes
  React.useEffect(() => {
    setSelected(new Set(effectiveRoutes(user)));
    setSaved(false);
  }, [user._id, user.allowedRoutes, user.role]);

  const toggle = (key) => {
    if (isAdmin) return; // admin always has all routes
    setSelected(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await authFetch(`/api/auth/users/${user._id}/routes`, {
        method: 'PATCH',
        body: JSON.stringify({ allowedRoutes: [...selected] }),
      });
      setSaved(true);
      onSaved?.([...selected]);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    const current = effectiveRoutes(user);
    if (current.length !== selected.size) return true;
    return current.some(r => !selected.has(r));
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Route Access {isAdmin ? '— All routes (admin)' : '— click to toggle'}
        </span>
        {!isAdmin && (
          <button
            onClick={save}
            disabled={saving || !hasChanges()}
            style={{
              padding: '4px 12px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700,
              background: saved ? '#dcfce7' : hasChanges() ? '#6366f1' : '#f1f5f9',
              color: saved ? '#16a34a' : hasChanges() ? '#fff' : '#94a3b8',
              cursor: (saving || !hasChanges()) ? 'not-allowed' : 'pointer',
              transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 5,
            }}>
            {saving ? '...' : saved ? '✓ Saved' : 'Save'}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ALL_ROUTES.map(({ key }) => {
          const on = isAdmin || selected.has(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              disabled={isAdmin}
              style={{
                padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: `1px solid ${on ? 'rgba(99,102,241,0.35)' : 'rgba(239,68,68,0.2)'}`,
                background: on ? 'rgba(99,102,241,0.08)' : 'rgba(239,68,68,0.06)',
                color: on ? '#4f46e5' : '#dc2626',
                cursor: isAdmin ? 'default' : 'pointer',
                transition: 'all .15s',
                userSelect: 'none',
              }}
            >
              {on ? '✓' : '✗'} {key}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ROLE_COLORS = {
  admin:     { bg: '#1e1b4b', text: '#a5b4fc', border: '#4338ca' },
  accounts:  { bg: '#022c22', text: '#6ee7b7', border: '#059669' },
  sales:     { bg: '#1c1917', text: '#fcd34d', border: '#b45309' },
  inventory: { bg: '#172554', text: '#93c5fd', border: '#1d4ed8' },
  viewer:    { bg: '#1e293b', text: '#94a3b8', border: '#475569' },
};

const STATUS_CONFIG = {
  active:    { icon: <CheckCircle2 size={13} />, color: '#4ade80', label: 'Active' },
  pending:   { icon: <Clock size={13} />,         color: '#fbbf24', label: 'Pending' },
  suspended: { icon: <XCircle size={13} />,       color: '#f87171', label: 'Suspended' },
};

const RoleBadge = ({ role }) => {
  const c = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>{role}</span>
  );
};

// ─── Invite Panel ─────────────────────────────────────────────────────────────
const InvitePanel = ({ onClose, onInviteSent }) => {
  const { authFetch } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', message }
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    setLoadingInvites(true);
    try {
      const res = await authFetch('/api/auth/invites');
      const data = await res.json();
      console.log('✅ Pending invites fetched:', data);
      setPendingInvites(data);
    } catch (e) {
      console.error('❌ Failed to fetch invites:', e);
    } finally {
      setLoadingInvites(false);
    }
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setResult(null);
    try {
      console.log('🔵 Sending invite to:', inviteEmail.trim());
      const res = await authFetch('/api/auth/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      console.log('✅ Invite sent response:', res.status, data);
      
      if (!res.ok) throw new Error(data.message);
      setResult({ type: 'success', message: data.message });
      setInviteEmail('');
      await fetchInvites();
      onInviteSent?.();
    } catch (err) {
      console.error('🔴 Send invite error:', err);
      setResult({ type: 'error', message: err.message });
    } finally {
      setSending(false);
    }
  };

  const revokeInvite = async (id) => {
    try {
      console.log('🔵 Revoking invite:', id);
      await authFetch(`/api/auth/invites/${id}`, { method: 'DELETE' });
      console.log('✅ Invite revoked');
      await fetchInvites();
    } catch (e) {
      console.error('❌ Revoke invite error:', e);
    }
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const hoursLeft = (expiresAt) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const h = Math.ceil(diff / 3600000);
    return h > 0 ? `${h}h left` : 'expired';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', background: '#eef2ff', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Mail size={18} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>Invite Employee</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Send a registration link by email</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', padding: '4px',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Invite form */}
        <div style={{ padding: '24px' }}>
          <form onSubmit={sendInvite} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="employee@marqland.com"
              required
              style={{
                flex: 1, padding: '11px 14px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                color: '#1e293b',
              }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <button type="submit" disabled={sending} style={{
              padding: '11px 20px', background: '#6366f1', color: '#fff',
              border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
              cursor: sending ? 'not-allowed' : 'pointer', display: 'flex',
              alignItems: 'center', gap: '6px', opacity: sending ? 0.7 : 1,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
              <Send size={14} />
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </form>

          {/* Result message */}
          {result && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
              marginBottom: '16px',
              background: result.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${result.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: result.type === 'success' ? '#16a34a' : '#dc2626',
            }}>
              {result.type === 'success' ? '✅' : '⚠'} {result.message}
            </div>
          )}

          {/* Pending invites */}
          <div>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
            }}>
              Pending Invites {pendingInvites.length > 0 && `(${pendingInvites.length})`}
            </div>

            {loadingInvites ? (
              <div style={{ color: '#94a3b8', fontSize: '13px', padding: '12px 0' }}>Loading...</div>
            ) : pendingInvites.length === 0 ? (
              <div style={{
                color: '#94a3b8', fontSize: '13px', padding: '20px',
                textAlign: 'center', background: '#f8fafc', borderRadius: '8px',
              }}>
                No pending invites
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                {pendingInvites.map(inv => (
                  <div key={inv._id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: '#f8fafc',
                    border: '1px solid #e2e8f0', borderRadius: '10px',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '32px', height: '32px', background: '#eef2ff',
                        borderRadius: '8px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Link2 size={14} color="#6366f1" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inv.email}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Sent {timeAgo(inv.createdAt)} · {hoursLeft(inv.expiresAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => revokeInvite(inv._id)}
                      style={{
                        background: 'rgba(239,68,68,0.08)', border: 'none',
                        color: '#ef4444', borderRadius: '6px', padding: '5px 8px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', fontWeight: 600, flexShrink: 0,
                      }}
                      title="Revoke invite"
                    >
                      <Trash2 size={11} /> Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main UserManagement Page ─────────────────────────────────────────────────
const UserManagement = () => {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedRoles, setSelectedRoles] = useState({});
  const [showInvite, setShowInvite] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);

  const fetchPendingInvites = async () => {
    try {
      const res = await authFetch('/api/auth/invites');
      const data = await res.json();
      setPendingInvites(Array.isArray(data) ? data : []);
    } catch { /* silently fail */ }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/auth/users');
      const data = await res.json();
      console.log('✅ Users fetched successfully:', data);
      console.log(`   Total users: ${data.length}`);
      data.forEach(u => {
        console.log(`   - ${u.name} (${u.email}) - Status: ${u.status}, Role: ${u.role}`);
      });
      setUsers(data);
    } catch (e) {
      console.error('❌ Error fetching users:', e);
      alert('Failed to load users: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); fetchPendingInvites(); }, []);

  const doAction = async (userId, path, body = {}) => {
    setActionLoading(userId + path);
    try {
      console.log(`🔵 Performing action: ${path} on user ${userId}`, body);
      const res = await authFetch(`/api/auth/users/${userId}/${path}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      console.log(`✅ Action ${path} completed:`, data);
      await fetchUsers();
    } catch (e) {
      console.error(`❌ Action ${path} failed:`, e);
      alert('Action failed: ' + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId, name) => {
    if (!window.confirm(`Permanently delete ${name}?`)) return;
    setActionLoading(userId + 'delete');
    try {
      console.log('🔵 Deleting user:', userId, name);
      const res = await authFetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
      console.log('✅ User deleted');
      await fetchUsers();
    } catch (e) {
      console.error('❌ Delete user error:', e);
      alert('Delete failed: ' + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Admin: send password reset email to a user ───────────────────────────────
  const sendResetEmail = async (email, name) => {
    if (!window.confirm(`Send a password reset email to ${name} (${email})?`)) return;
    try {
      const res = await authFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      alert(`✅ Reset email sent to ${email}. The link expires in 1 hour.`);
    } catch (e) {
      alert('Failed to send reset email: ' + e.message);
    }
  };

  const filtered = users.filter(u => filter === 'all' || u.status === filter);
  // Invites that haven't been accepted — shown in pending tab
  const pendingInvitesList = pendingInvites.filter(inv => !inv.used);
  const pendingCount = users.filter(u => u.status === 'pending').length + pendingInvites.filter(i => !i.used).length;

  const S = {
    page: { padding: '32px', fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: '960px' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' },
    titleRow: { display: 'flex', alignItems: 'center', gap: '12px' },
    title: { fontSize: '22px', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' },
    pendingBadge: {
      background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d',
      borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: 700,
    },
    inviteBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 18px', background: '#6366f1', color: '#fff',
      border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    filters: { display: 'flex', gap: '8px', marginBottom: '20px' },
    filterBtn: (active) => ({
      padding: '7px 16px', borderRadius: '8px', fontFamily: 'inherit',
      border: active ? '1px solid #6366f1' : '1px solid #e2e8f0',
      background: active ? '#eef2ff' : '#fff',
      color: active ? '#6366f1' : '#64748b',
      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    }),
    card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' },
    row: {
      padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
    },
    avatar: {
      width: '38px', height: '38px', borderRadius: '10px', background: '#6366f1',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '14px', flexShrink: 0,
    },
    actionBtn: (color) => ({
      padding: '6px 12px', borderRadius: '7px', border: 'none',
      background: color + '15', color: color, fontSize: '12px', fontWeight: 700,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
      fontFamily: 'inherit',
    }),
    select: {
      padding: '6px 10px', borderRadius: '7px', border: '1px solid #e2e8f0',
      fontSize: '12px', fontWeight: 600, background: '#f8fafc', cursor: 'pointer',
      fontFamily: 'inherit',
    },
    approveBtn: {
      padding: '6px 14px', borderRadius: '7px', border: 'none',
      background: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700,
      cursor: 'pointer', fontFamily: 'inherit',
    },
  };

  return (
    <div style={S.page}>
      {showInvite && (
        <InvitePanel
          onClose={() => setShowInvite(false)}
          onInviteSent={() => { fetchUsers(); fetchPendingInvites(); }}
        />
      )}

      <div style={S.header}>
        <div style={S.titleRow}>
          <Shield size={22} color="#6366f1" />
          <h1 style={S.title}>User Management</h1>
          {pendingCount > 0 && <span style={S.pendingBadge}>{pendingCount} pending</span>}
        </div>
        <button style={S.inviteBtn} onClick={() => setShowInvite(true)}>
          <Mail size={15} />
          Invite Employee
        </button>
      </div>

      <div style={S.filters}>
        {['all', 'pending', 'active', 'suspended'].map(f => (
          <button key={f} style={S.filterBtn(filter === f)} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading users...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            {filter === 'pending' ? (
              <div>
                <div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center', borderBottom: pendingInvitesList.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  No pending approvals.{' '}
                  <button style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowInvite(true)}>
                    Invite a new employee?
                  </button>
                </div>
              </div>
            ) : `No ${filter !== 'all' ? filter : ''} users found.`
            }
          </div>
        ) : (
          <>
            {filtered.map((u, i) => {
            const statusCfg = STATUS_CONFIG[u.status];
            const initials = (u.name || u.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const isLast = i === filtered.length - 1 && (filter !== 'pending' || pendingInvitesList.length === 0);

            return (
              <div key={u._id} style={{
                padding: '16px 20px',
                borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
              }}>
                {/* ── Top row: avatar · name/email · status · role · actions ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                  {/* Avatar */}
                  <div style={S.avatar}>{initials}</div>

                  {/* Name + email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name || u.email}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </div>
                  </div>

                  {/* Status pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: statusCfg.color, fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                    {statusCfg.icon} {statusCfg.label}
                  </div>

                  {/* Role badge — current role */}
                  <div style={{ flexShrink: 0 }}>
                    <RoleBadge role={u.role} />
                  </div>

                  {/* ── Action controls ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

                    {/* PENDING: role picker + approve */}
                    {u.status === 'pending' && (
                      <>
                        <select
                          style={S.select}
                          value={selectedRoles[u._id] || 'viewer'}
                          onChange={e => setSelectedRoles(prev => ({ ...prev, [u._id]: e.target.value }))}
                        >
                          {ROLES.filter(r => r !== 'admin').map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          style={S.approveBtn}
                          disabled={actionLoading === u._id + 'approve'}
                          onClick={() => doAction(u._id, 'approve', { role: selectedRoles[u._id] || 'viewer' })}
                        >
                          {actionLoading === u._id + 'approve' ? '...' : 'Approve'}
                        </button>
                      </>
                    )}

                    {/* ACTIVE: change role + suspend */}
                    {u.status === 'active' && (
                      <>
                        <select
                          style={S.select}
                          value={u.role}
                          onChange={e => doAction(u._id, 'role', { role: e.target.value })}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button style={S.actionBtn('#f59e0b')}
                          onClick={() => doAction(u._id, 'suspend')}
                          disabled={actionLoading === u._id + 'suspend'}>
                          <XCircle size={12} /> Suspend
                        </button>
                      </>
                    )}

                    {/* SUSPENDED: reactivate */}
                    {u.status === 'suspended' && (
                      <button style={S.actionBtn('#4ade80')}
                        onClick={() => doAction(u._id, 'reactivate')}
                        disabled={actionLoading === u._id + 'reactivate'}>
                        <RefreshCw size={12} /> Reactivate
                      </button>
                    )}

                    {/* Reset password email */}
                    {u.status !== 'pending' && (
                      <button style={S.actionBtn('#6366f1')}
                        onClick={() => sendResetEmail(u.email, u.name)}
                        title="Send password reset email">
                        <Mail size={12} /> Reset
                      </button>
                    )}

                    {/* Delete */}
                    <button style={S.actionBtn('#f87171')}
                      onClick={() => deleteUser(u._id, u.name || u.email)}
                      disabled={actionLoading === u._id + 'delete'}
                      title="Delete permanently">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* ── Bottom row: interactive route access editor ── */}
                {u.status !== 'pending' && (
                  <RouteAccessEditor
                    user={u}
                    onSaved={(routes) => {
                      setUsers(prev => prev.map(x => x._id === u._id ? { ...x, allowedRoutes: routes } : x));
                    }}
                  />
                )}
                {u.status === 'pending' && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                      Route access will be configurable after approval.
                      Default for <strong>{selectedRoles[u._id] || 'viewer'}</strong>:{' '}
                      {(ROLE_DEFAULTS[selectedRoles[u._id] || 'viewer'] || []).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
            {/* Pending invites — people invited but haven't registered yet */}
            {filter === 'pending' && pendingInvitesList.map((inv, i) => (
              <div key={inv._id} style={{
                ...S.row,
                borderBottom: i === pendingInvitesList.length - 1 ? 'none' : undefined,
                background: '#fffbeb',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{ ...S.avatar, background: '#f59e0b', fontSize: '16px' }}>✉</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{inv.email}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                      Invite sent · not yet registered
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                  <Clock size={13} /> Invite Pending
                </div>
                <div style={{ flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    expires {new Date(inv.expiresAt) > new Date()
                      ? Math.ceil((new Date(inv.expiresAt) - Date.now()) / 3600000) + 'h'
                      : 'expired'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    style={S.actionBtn('#f87171')}
                    onClick={async () => {
                      await authFetch(`/api/auth/invites/${inv._id}`, { method: 'DELETE' });
                      fetchUsers();
                    }}
                    title="Revoke invite"
                  >
                    <Trash2 size={12} /> Revoke
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default UserManagement;