/*
 * What makes this an app rather than a web page.
 *
 * Installed on a phone or a laptop, the thing has to open and run in a hall
 * with no signal at all — not just survive the connection dropping mid-game.
 * So the worker does three jobs:
 *
 *   - it takes a copy of every page the game needs the moment it is installed,
 *     rather than waiting for each to be visited while online;
 *   - it serves pages network-first, so a new deploy is picked up the next time
 *     there is a connection and nobody is ever stuck on an old build;
 *   - it keeps the build's own JavaScript and CSS, which are content-hashed by
 *     Next and therefore safe to serve from the cache first.
 *
 * /api is never cached. The game does not read the server while it is being
 * played — the board lives on the device — and a stale answer to a question
 * about accounts or reports is worse than an honest failure.
 *
 * The one exception is the card index, which is the app's own data rather than
 * live state: it changes only when the owner edits a set, and having it is the
 * difference between naming the winners offline and shrugging.
 */

const VERSION = 'dambala-v2';
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const DATA = `${VERSION}-data`;

/** Every screen that has to work with no connection. */
const SHELL = ['/play', '/check', '/sheet', '/print', '/labels'];

/**
 * The home page too — but never at the cost of making the others wait.
 *
 * It is a server-rendered page that reads the database before it answers, so it
 * is the slowest thing here by a wide margin. Holding the install open for it
 * would mean several seconds on a first visit during which the app is not yet
 * ready for an outage, to cache the one page nobody opens mid-game.
 */
const SHELL_BACKGROUND = ['/'];

const CARD_INDEX = '/api/sets/index';

/** No single page may hold the install open; the rest are worth more. */
const PRECACHE_TIMEOUT_MS = 5000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), ms)),
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      const take = (path) =>
        withTimeout(
          cache.add(new Request(path, { credentials: 'same-origin' })),
          PRECACHE_TIMEOUT_MS
        ).catch(() => undefined);

      // Each page on its own: a 404, a redirect or a page that is simply slow
      // must not cost the others.
      await Promise.all(SHELL.map(take));
      SHELL_BACKGROUND.forEach(take); // deliberately not awaited

      await self.skipWaiting();
    })()
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
    const cached =
      (await caches.match(request, { ignoreSearch: true })) || (await caches.match('/play'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0b1120;color:#e2e8f0;' +
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

/** The cards: fresh when there is a connection, the last copy when there is not. */
async function cardIndex(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(DATA).then((c) => c.put(CARD_INDEX, copy));
    }
    return fresh;
  } catch {
    const cached = await caches.match(CARD_INDEX);
    if (cached) return cached;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === CARD_INDEX) {
    event.respondWith(cardIndex(request));
    return;
  }

  // the board and every account read come from the server or not at all
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(pageOrLastCopy(request));
    return;
  }

  // content-hashed build output and static files
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(assetOrNetwork(request));
  }
});
