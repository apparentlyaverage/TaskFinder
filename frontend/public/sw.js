// ReLivR service worker (H1 PWA) — offline app-shell + Web Push.
// Registered in production only (see main.jsx) so it never fights Vite HMR in dev.
const CACHE = 'relivr-shell-v3' // v3: seedling mark + plum palette
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/logo.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  // Best-effort per-item cache (not addAll, which is atomic): a single renamed
  // or missing shell asset must not brick SW install and offline support.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Network-first for page navigations (users get fresh HTML when online; the cached
// shell keeps the app openable offline). Non-navigation GETs pass straight through
// so API calls and hashed assets are never intercepted.
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  e.respondWith(fetch(req).catch(() => caches.match('/index.html').then(r => r || caches.match('/'))))
})

// Web Push — render the notification the backend sent.
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { title: 'ReLivR', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(data.title || 'ReLivR', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }))
})

// Focus an open tab (or open one) when a notification is clicked.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) { c.navigate?.(url); return c.focus() } }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined
    })
  )
})
