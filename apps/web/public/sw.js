// Vayumukhi Dairy — offline service worker.
//
// Bumping CACHE is load-bearing: `activate` deletes every cache whose name isn't
// the current one, so a version bump purges a poisoned cache from an already
// installed app. v2 shipped two bugs that broke the native shell on a flaky
// connection, and this bump is what heals those installs.
//
//   1. Cache-first fell back with `.catch(() => cached)`. On a cache MISS plus a
//      failed fetch, that resolved respondWith() with `undefined`, which is not a
//      Response — so one dropped chunk request took down the whole page with
//      "a client-side exception has occurred". Rare on desktop wifi, routine on
//      a phone with two bars.
//
//   2. `/` was cached at install under a name that never changed, so after a
//      redeploy the offline shell still pointed at `_next` chunk hashes that now
//      404 on the CDN. Stale shell + dead chunks = the same crash.
//
// Rules now: every path returns a real Response, and nothing build-specific is
// ever served stale. `_next/static` is content-hashed, so it is immutable and
// safe to cache forever; HTML never is.
const CACHE = "vmd-v3";

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Vayumukhi Dairy</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#173a5c;color:#fff;
font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:2rem}
h1{font-size:1.4rem;margin:0 0 .5rem}p{opacity:.75;margin:0 0 1.5rem;font-size:.95rem}
button{background:#fff;color:#173a5c;border:0;border-radius:999px;padding:.85rem 2rem;font-size:1rem;font-weight:600}</style>
</head><body><div><h1>You're offline</h1><p>Vayumukhi Dairy needs a connection to load.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

const offlineResponse = () =>
  new Response(OFFLINE_HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

const emptyResponse = () => new Response("", { status: 504, statusText: "offline" });

self.addEventListener("install", () => {
  // Nothing is precached. The old build's HTML shell is exactly what went stale.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Content-hashed build output: the URL changes whenever the bytes do. */
const isImmutable = (url) => url.pathname.startsWith("/_next/static/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase / 3rd-party

  // Navigations: always try the network so a deploy is picked up immediately.
  // Falling back to a self-contained page rather than a cached shell is the
  // whole point — a stale shell references chunks the CDN has since deleted.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => offlineResponse()));
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              if (res.ok && res.type === "basic") {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
              }
              return res;
            })
            // MUST resolve to a Response. Returning `cached` here is what broke v2.
            .catch(() => emptyResponse()),
      ),
    );
    return;
  }

  // Everything else same-origin (icons, manifest): stale-while-revalidate, so a
  // changed asset is picked up next load without ever blocking on the network.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || emptyResponse());
      return cached || network;
    }),
  );
});
