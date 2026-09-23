// MA HQ · service worker : ouverture rapide, écran hors ligne, notifications.
const CACHE = 'mahq-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/mabeautyplus-lotus.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Les données (Supabase, fonctions) ne passent jamais par le cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/')) return;
  if (req.mode === 'navigate') {
    // Pages : réseau d'abord, application en cache si hors ligne.
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    // Fichiers versionnés par Vite : cache d'abord.
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});

// Clic sur une notification : ouvrir (ou ramener) l'appli sur la bonne page.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// Notifications envoyées par le serveur (Web Push), actives une fois la base branchée.
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'MA HQ', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});
