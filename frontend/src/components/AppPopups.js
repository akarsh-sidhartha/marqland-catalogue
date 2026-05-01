/**
 * AppPopups.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable popup primitives — Toast + ConfirmDialog — themed with the
 * gold / navy brand palette.
 *
 * CSS variables expected (inject once at your app root or via <AppPopupStyles />):
 *   --gold   : #C9A84C   (or your brand gold)
 *   --navy   : #0D1B2A   (or your brand navy)
 *   --gold-light : rgba(201,168,76,0.12)
 *
 * EXPORTS
 * ───────
 *   usePopup()          → { toast, showToast, confirm, ConfirmDialog, Toast }
 *   <AppPopupStyles />  → injects :root CSS variables + keyframes (place once near app root)
 *
 * USAGE
 * ─────
 *   // 1. Mount styles once (e.g. in App.jsx or index.jsx)
 *   import { AppPopupStyles } from './AppPopups';
 *   <AppPopupStyles />
 *
 *   // 2. In any component:
 *   import { usePopup } from './AppPopups';
 *   const { showToast, confirm, Toast, ConfirmDialog } = usePopup();
 *
 *   // Show a toast:
 *   showToast('success', 'Product saved!');
 *   showToast('error', 'Something went wrong');
 *
 *   // Replace window.confirm:
 *   const ok = await confirm({ title: 'Delete product?', message: 'This cannot be undone.' });
 *   if (ok) { ...delete logic... }
 *
 *   // Render at bottom of JSX return:
 *   <Toast />
 *   <ConfirmDialog />
 */

import React, { useState, useRef, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CSS variables + keyframes — mount once near app root via <AppPopupStyles />
// ─────────────────────────────────────────────────────────────────────────────
export const AppPopupStyles = () => (
  <style>{`
    :root {
      --gold        : #C9A84C;
      --gold-hover  : #b8952e;
      --gold-light  : rgba(201, 168, 76, 0.12);
      --gold-border : rgba(201, 168, 76, 0.35);
      --navy        : #0D1B2A;
      --navy-soft   : #162436;
      --navy-muted  : rgba(13, 27, 42, 0.55);
    }

    /* ── Slide-up entrance ── */
    @keyframes popup-up {
      0%   { transform: translateY(24px) scale(0.97); opacity: 0; }
      100% { transform: translateY(0)    scale(1);    opacity: 1; }
    }
    @keyframes toast-up {
      0%   { transform: translateX(-50%) translateY(16px); opacity: 0; }
      100% { transform: translateX(-50%) translateY(0);    opacity: 1; }
    }
    .popup-enter   { animation: popup-up  0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .toast-enter   { animation: toast-up  0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    /* ── Shared gold button ── */
    .btn-gold {
      display        : inline-flex;
      align-items    : center;
      gap            : 10px;
      background     : var(--gold);
      color          : var(--navy);
      padding        : 13px 32px;
      border         : none;
      cursor         : pointer;
      font-family    : 'Jost', 'Inter', sans-serif;
      font-size      : 10px;
      font-weight    : 600;
      letter-spacing : 0.25em;
      text-transform : uppercase;
      transition     : background 0.3s, transform 0.3s, opacity 0.2s;
      white-space    : nowrap;
      border-radius  : 6px;
    }
    .btn-gold:hover:not(:disabled) {
      background : var(--gold-hover);
      transform  : translateY(-1px);
    }
    .btn-gold:active:not(:disabled) { transform: translateY(0); }
    .btn-gold:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Ghost button (always visible on dark bg) ── */
    .btn-ghost {
      display        : inline-flex;
      align-items    : center;
      gap            : 8px;
      background     : transparent;
      color          : rgba(240, 236, 228, 0.75);
      padding        : 13px 28px;
      border         : 1px solid rgba(240, 236, 228, 0.22);
      cursor         : pointer;
      font-family    : 'Jost', 'Inter', sans-serif;
      font-size      : 10px;
      font-weight    : 500;
      letter-spacing : 0.25em;
      text-transform : uppercase;
      transition     : border-color 0.3s, color 0.3s, transform 0.3s;
      border-radius  : 6px;
    }
    .btn-ghost:hover:not(:disabled) {
      border-color : var(--gold);
      color        : var(--gold);
      transform    : translateY(-1px);
    }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Danger ghost ── */
    .btn-danger {
      display        : inline-flex;
      align-items    : center;
      gap            : 8px;
      background     : transparent;
      color          : #b91c1c;
      padding        : 13px 28px;
      border         : 1px solid rgba(185,28,28,0.3);
      cursor         : pointer;
      font-family    : 'Jost', 'Inter', sans-serif;
      font-size      : 10px;
      font-weight    : 600;
      letter-spacing : 0.25em;
      text-transform : uppercase;
      transition     : background 0.3s, border-color 0.3s, transform 0.3s;
      border-radius  : 6px;
    }
    .btn-danger:hover:not(:disabled) {
      background     : rgba(185,28,28,0.07);
      border-color   : #b91c1c;
      transform      : translateY(-1px);
    }
    .btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Scrollbar hide utility ── */
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// Toast — rendered by the hook consumer via <Toast />
// ─────────────────────────────────────────────────────────────────────────────
const TOAST_ICONS = {
  success : <CheckCircle2 size={17} style={{ flexShrink: 0 }} />,
  error   : <AlertCircle  size={17} style={{ flexShrink: 0 }} />,
  warning : <AlertTriangle size={17} style={{ flexShrink: 0 }} />,
};

const TOAST_COLORS = {
  success : { bg: 'var(--navy)',  border: 'var(--gold-border)', accent: 'var(--gold)' },
  error   : { bg: '#1a0808',     border: 'rgba(185,28,28,0.4)', accent: '#f87171'    },
  warning : { bg: '#1a1200',     border: 'rgba(201,168,76,0.4)', accent: 'var(--gold)' },
};

const ToastDisplay = ({ toast }) => {
  if (!toast) return null;
  const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.success;
  return (
    <div
      className="toast-enter"
      style={{
        position    : 'fixed',
        bottom      : '28px',
        left        : '50%',
        transform   : 'translateX(-50%)',
        zIndex      : 9999,
        display     : 'flex',
        alignItems  : 'center',
        gap         : '12px',
        padding     : '14px 24px',
        background  : colors.bg,
        border      : `1px solid ${colors.border}`,
        borderLeft  : `3px solid ${colors.accent}`,
        borderRadius: '8px',
        boxShadow   : '0 8px 32px rgba(0,0,0,0.35)',
        minWidth    : '260px',
        maxWidth    : '420px',
        whiteSpace  : 'nowrap',
      }}
    >
      <span style={{ color: colors.accent }}>{TOAST_ICONS[toast.type]}</span>
      <span style={{
        fontFamily    : "'Jost', 'Inter', sans-serif",
        fontSize      : '11px',
        fontWeight    : 500,
        letterSpacing : '0.06em',
        color         : '#f0ece4',
        overflow      : 'hidden',
        textOverflow  : 'ellipsis',
      }}>
        {toast.message}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog — branded modal to replace window.confirm
// Props (passed via hook's internal state):
//   title, message, confirmLabel, cancelLabel, variant ('danger'|'warning'|'default')
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmDialogDisplay = ({ state, onConfirm, onCancel }) => {
  if (!state) return null;
  const {
    title        = 'Are you sure?',
    message      = '',
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    variant      = 'danger',
  } = state;

  const accentColor = variant === 'danger' ? '#ef4444' : variant === 'warning' ? 'var(--gold)' : 'var(--gold)';
  const ConfirmBtn  = variant === 'danger' ? 'btn-danger' : 'btn-gold';

  return (
    /* Backdrop */
    <div
      onClick={onCancel}
      style={{
        position   : 'fixed',
        inset      : 0,
        background : 'rgba(7, 13, 20, 0.72)',
        backdropFilter : 'blur(4px)',
        zIndex     : 9998,
        display    : 'flex',
        alignItems : 'center',
        justifyContent : 'center',
        padding    : '20px',
      }}
    >
      {/* Card */}
      <div
        className="popup-enter"
        onClick={e => e.stopPropagation()}
        style={{
          background   : 'var(--navy, #0D1B2A)',
          border       : '1px solid var(--gold-border, rgba(201,168,76,0.25))',
          borderRadius : '12px',
          boxShadow    : '0 24px 64px rgba(0,0,0,0.55)',
          width        : '100%',
          maxWidth     : '420px',
          overflow     : 'hidden',
        }}
      >

        {/* Header */}
        <div style={{
          display        : 'flex',
          alignItems     : 'flex-start',
          justifyContent : 'space-between',
          padding        : '24px 24px 0',
        }}>
          <span style={{
            fontFamily    : "'Jost', 'Inter', sans-serif",
            fontSize      : '11px',
            fontWeight    : 700,
            letterSpacing : '0.22em',
            textTransform : 'uppercase',
            color         : accentColor,
          }}>
            {title}
          </span>
          <button
            onClick={onCancel}
            style={{
              background : 'none',
              border     : 'none',
              cursor     : 'pointer',
              color      : 'rgba(240,236,228,0.35)',
              padding    : '0',
              lineHeight : 1,
              transition : 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0ece4'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,236,228,0.35)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {message && (
          <p style={{
            fontFamily    : "'Jost', 'Inter', sans-serif",
            fontSize      : '12px',
            fontWeight    : 400,
            lineHeight    : 1.65,
            color         : 'rgba(240,236,228,0.65)',
            padding       : '14px 24px 24px',
            margin        : 0,
            letterSpacing : '0.02em',
          }}>
            {message}
          </p>
        )}

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--gold-border, rgba(201,168,76,0.18))' }} />

        {/* Footer */}
        <div style={{
          display        : 'flex',
          justifyContent : 'flex-end',
          gap            : '10px',
          padding        : '16px 20px',
        }}>
          <button className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className={ConfirmBtn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// usePopup — the main hook
// ─────────────────────────────────────────────────────────────────────────────
export const usePopup = () => {
  // Toast state
  const [toastState, setToastState]     = useState(null);
  const toastTimerRef                   = useRef(null);

  // Confirm state
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolveRef               = useRef(null);

  /* showToast(type, message, durationMs?) */
  const showToast = useCallback((type, message, duration = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastState({ type, message });
    toastTimerRef.current = setTimeout(() => setToastState(null), duration);
  }, []);

  /**
   * confirm(options) → Promise<boolean>
   * options: { title, message, confirmLabel, cancelLabel, variant }
   */
  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmResolveRef.current?.(true);
    setConfirmState(null);
  }, []);

  const handleCancel = useCallback(() => {
    confirmResolveRef.current?.(false);
    setConfirmState(null);
  }, []);

  /* Bound render components — just drop <Toast /> and <ConfirmDialog /> in JSX */
  const Toast         = useCallback(() => <ToastDisplay toast={toastState} />, [toastState]);
  const ConfirmDialog = useCallback(
    () => <ConfirmDialogDisplay state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />,
    [confirmState, handleConfirm, handleCancel]
  );

  return { showToast, confirm, Toast, ConfirmDialog };
};