// Vayumukhi Dairy — minimal offline service worker.
// Network-first for navigations (always fresh, falls back to the cached shell when
// offline); cache-first for static assets. Authed pages are not pre-cached.
const CACHE = "vmd-v2";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return; // never touch Supabase/3rd-party

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(req).then((r) => r || caches.match(SHELL))));
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached),
    ),
  );
});
