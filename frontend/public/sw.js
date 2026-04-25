/**
 * public/sw.js  —  Marqland Portal Push Notification Service Worker
 *
 * Place this file at:  frontend/public/sw.js
 * It will be served at: https://your-domain/sw.js
 *
 * Handles:
 *   1. push  — shows a notification when a push event arrives from the server
 *   2. notificationclick — focuses/opens the correct portal tab on click
 */

self.addEventListener('install', () => self.skipWaiting());

// ── Message from tab: show a notification via the SW (works when tab hidden) ──
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_NOTIFICATION') return;
  const { title, body, tag = 'portal', url = '/' } = event.data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     '/favicon.ico',
      badge:    '/favicon.ico',
      tag,
      renotify: true,
      data:     { url },
    })
  );
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push event: server sends a push, we show a notification ──────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Marqland Studios', body: 'You have a new message', tag: 'portal', url: '/' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/favicon.ico',
      badge:   '/favicon.ico',
      tag:     data.tag,       // deduplicates — replaces previous same-tag notification
      renotify: true,
      data:    { url: data.url },
    })
  );
});

// ── Notification click: open or focus the relevant page ───────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If a window with that URL is already open, focus it
      const match = clients.find(c => c.url.includes(targetUrl));
      if (match) return match.focus();
      // Otherwise open a new tab
      return self.clients.openWindow(targetUrl);
    })
  );
});