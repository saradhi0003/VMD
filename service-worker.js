/* Vayumukhi Dairy — Service Worker v2 */
const CACHE = 'vmd-v2';
const ASSETS = [
  './', './index.html', './app.html', './styles.css', './app.js',
  './manifest.webmanifest', './assets/icon.svg', './assets/hero-dairy-farm.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

/* Push notifications — WhatsApp-style farm alerts */
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'Vayumukhi Farm', body: 'Farm update ready.' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './assets/icon.svg',
      badge: './assets/icon.svg',
      vibrate: [200, 100, 200, 100, 200],
      tag: data.tag || 'farm-update',
      data: { url: data.url || './app.html' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || './app.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('app.html') && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(target);
    })
  );
});
