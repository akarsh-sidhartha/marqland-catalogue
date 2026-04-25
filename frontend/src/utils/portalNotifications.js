/**
 * src/utils/portalNotifications.js
 *
 * Shared helpers for Web Push + Web Notifications API.
 *
 * Usage:
 *   import { initNotifications, pushNotif, subscribeToPortalPush } from '../utils/portalNotifications';
 *
 *   // Call once on app mount — registers SW, requests permission
 *   await initNotifications();
 *
 *   // Fire an in-tab notification (works when tab is visible or backgrounded)
 *   pushNotif('New message', 'Client said hello', '/orders', 'portal-msg');
 *
 * NOTE on "browser fully closed":
 *   True background push (browser closed) requires:
 *     1. This service worker (already done)
 *     2. A VAPID push subscription sent to your server
 *     3. Server calling web-push library when a message arrives
 *   Steps 2 & 3 are in subscribeToPortalPush() below.
 *   Until the server-side web-push is wired up, notifications work
 *   whenever the browser is open (any tab), including minimised/other tabs.
 */

const SW_PATH = '/sw.js';

// ── Register the service worker ───────────────────────────────────────────────
export const registerSW = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('[Portal SW] Registration failed:', err.message);
    return null;
  }
};

// ── Request notification permission (call on user gesture for best results) ───
export const requestNotifPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
};

// ── Initialise everything: register SW + request permission ───────────────────
export const initNotifications = async () => {
  await registerSW();
  // Don't auto-request permission — only do it on a user gesture
  // Call requestNotifPermission() explicitly when user clicks send/chat
};

// ── Fire a browser notification (works even when tab is backgrounded) ─────────
export const pushNotif = (title, body, url = '/', tag = 'portal') => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    // Prefer showing via service worker (persists when tab is hidden)
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION', title, body, tag, url,
      });
    }
    // Fallback: direct Notification API
    const n = new Notification(title, {
      body,
      icon:     '/favicon.ico',
      tag,
      renotify: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
};

// ── VAPID Push subscription — full "browser closed" support ──────────────────
// Call this after initNotifications() + after permission is granted.
// The server must have VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in .env
// and web-push installed (npm install web-push).
export const subscribeToPortalPush = async (apiFetch) => {
  if (!('PushManager' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Re-send to server in case it was lost
      await apiFetch('/api/portal/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...existing.toJSON(), userAgent: navigator.userAgent }),
      });
      return existing;
    }

    // Fetch VAPID public key from server
    const keyRes  = await apiFetch('/api/portal/vapid-public-key');
    const keyData = await keyRes.json();
    if (!keyData?.publicKey) {
      console.warn('[Portal Push] Server has no VAPID key configured yet.');
      return null;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });

    // Save subscription on server
    await apiFetch('/api/portal/push-subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...sub.toJSON(), userAgent: navigator.userAgent }),
    });

    console.log('[Portal Push] Subscribed successfully.');
    return sub;
  } catch (err) {
    console.warn('[Portal Push] Subscription failed:', err.message);
    return null;
  }
};

// Converts VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding   = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64    = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData   = atob(base64);
  const outputArr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArr[i] = rawData.charCodeAt(i);
  return outputArr;
}