import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

// ── Password strength meter ───────────────────────────────────────────────────
const StrengthMeter = ({ password }) => {
  if (!password) return null;

  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Uppercase letter',       pass: /[A-Z]/.test(password) },
    { label: 'Number',                 pass: /[0-9]/.test(password) },
    { label: 'Special character',      pass: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter(c => c.pass).length;
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];
  const labels = ['Too weak', 'Fair', 'Good', 'Strong'];

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: i < score ? colors[score - 1] : '#e2e8f0',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      {/* Label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {checks.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', color: c.pass ? '#22c55e' : '#94a3b8',
              transition: 'color 0.2s',
            }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%',
                background: c.pass ? '#dcfce7' : '#f1f5f9',
                border: `1px solid ${c.pass ? '#22c55e' : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.2s',
              }}>
                {c.pass && <CheckCircle2 size={9} color="#22c55e" />}
              </div>
              {c.label}
            </div>
          ))}
        </div>
        <span style={{
          fontSize: '12px', fontWeight: 700,
          color: score > 0 ? colors[score - 1] : '#94a3b8',
        }}>
          {score > 0 ? labels[score - 1] : ''}
        </span>
      </div>
    </div>
  );
};

// ── Password input with show/hide toggle ─────────────────────────────────────
const PasswordField = ({ label, value, onChange, placeholder, hint }) => {
  const [show, setShow] = useState(false);

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block', fontSize: '12px', fontWeight: 700,
        color: '#374151', marginBottom: '6px', letterSpacing: '0.01em',
      }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          style={{
            width: '100%', padding: '11px 40px 11px 14px',
            border: '1.5px solid #e5e7eb', borderRadius: '10px',
            fontSize: '14px', color: '#111827', outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = '#6366f1'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: 'absolute', right: '12px', top: '50%',
            transform: 'translateY(-50%)', background: 'none',
            border: 'none', cursor: 'pointer', color: '#9ca3af',
            padding: '2px', display: 'flex',
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ChangePassword = () => {
  const { authFetch, user } = useAuth();

  const [current, setCurrent]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Client-side checks
    if (newPass.length < 8) {
      return setError('New password must be at least 8 characters.');
    }
    if (newPass !== confirm) {
      return setError('New passwords do not match.');
    }
    if (current === newPass) {
      return setError('New password must be different from your current password.');
    }

    setLoading(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password.');

      setSuccess(true);
      setCurrent('');
      setNewPass('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '40px 32px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      maxWidth: '480px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          width: '40px', height: '40px', background: '#eef2ff',
          borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={20} color="#6366f1" />
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
          Change Password
        </h1>
      </div>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px', marginTop: '4px' }}>
        Logged in as <strong style={{ color: '#374151' }}>{user?.email}</strong>
      </p>

      {/* Success banner */}
      {success && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '10px', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          marginBottom: '24px',
        }}>
          <CheckCircle2 size={18} color="#22c55e" />
          <div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '14px' }}>Password updated!</div>
            <div style={{ color: '#16a34a', fontSize: '12px' }}>Your new password is active immediately.</div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '10px', padding: '12px 16px',
          color: '#dc2626', fontSize: '13px', marginBottom: '20px',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Form */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '14px', padding: '28px',
      }}>
        <form onSubmit={handleSubmit}>
          <PasswordField
            label="Current Password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            placeholder="Your current password"
            hint="Enter the password you use to log in now."
          />

          <PasswordField
            label="New Password"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            placeholder="Choose a strong new password"
          />

          {/* Strength meter shows while typing new password */}
          <StrengthMeter password={newPass} />

          <PasswordField
            label="Confirm New Password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat new password"
          />

          {/* Match indicator */}
          {confirm && (
            <div style={{
              fontSize: '12px', marginTop: '-8px', marginBottom: '20px',
              color: newPass === confirm ? '#22c55e' : '#ef4444',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              {newPass === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading ? '#a5b4fc' : '#6366f1',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.2s',
            }}
          >
            {loading ? 'Updating...' : 'Update Password →'}
          </button>
        </form>
      </div>

      {/* Tip */}
      <div style={{
        marginTop: '20px', padding: '14px 16px',
        background: '#fffbeb', border: '1px solid #fde68a',
        borderRadius: '10px', fontSize: '12px', color: '#92400e', lineHeight: '1.6',
      }}>
        💡 <strong>Tip:</strong> Use a mix of uppercase, numbers, and symbols.
        Don't reuse passwords from other services. You'll need to log in again on other devices after changing.
      </div>
    </div>
  );
};

export default ChangePassword;