/*
 * Keeps the game openable with no connection.
 *
 * Deliberately conservative, because a service worker that caches too eagerly
 * is how an app gets stuck on an old version that cannot be updated:
 *
 *   - pages are fetched from the network first, and only fall back to the last
 *     copy when the network fails, so a new deploy is picked up immediately;
 *   - /api is never cached — the board must come from the server or not at all,
 *     and the app has its own offline handling for that;
 *   - build assets are content-hashed by Next, so those are safe to serve from
 *     the cache first.
 */

const VERSION = 'dambala-v1';
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', (event) => {
  // the shell the fallback needs, fetched ahead of the first outage
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(['/play', '/']).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/** A page the caller can still look at when the request fails. */
async function pageOrLastCopy(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(PAGES).then((c) => c.put(request, copy));
    }
    return fresh;
  } catch {
    const cached = (await caches.match(request)) || (await caches.match('/play'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#020617;color:#e2e8f0;' +
        'font-family:system-ui,sans-serif;text-align:center"><div><p style="font-weight:800">ماكو اتصال</p>' +
        '<p style="font-size:13px;opacity:.7">افتح اللعبة مرة وحدة وهي متصلة، وبعدها تشتغل بدون نت.</p></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
    );
  }
}

async function assetOrNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    const copy = fresh.clone();
    caches.open(ASSETS).then((c) => c.put(request, copy));
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // the board is never served from a cache — a stale game is worse than none
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(pageOrLastCopy(request));
    return;
  }

  // content-hashed build output and static files
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(assetOrNetwork(request));
  }
});
