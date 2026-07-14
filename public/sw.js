// Minimal service worker — its only job is to make the app an installable PWA
// (so desktop + mobile can add a home-screen / dock shortcut). It does NOT
// cache anything: this app is auth-gated and server-rendered, so caching would
// risk serving stale or wrong-user pages. Every request goes straight to the
// network (default behaviour — no fetch handler that intercepts responses).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
