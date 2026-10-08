/* global self, caches, fetch, Request, Response, URL */
// Offline play. Pictures and sounds never change once published, so they live in one cache that
// outlives builds and are served from it first. The page and the code are fetched fresh, with
// the cache as the fallback when there is no network; that cache is named after the build, taken
// from the registration address, so a new build never serves old code.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CODE = `lukas-${VERSION}`;
const STILL_CACHE = 'lukas-still';
const STILL = ['/assets/maps/', '/assets/figures/', '/assets/portraits/', '/assets/art/', '/assets/things/', '/assets/audio/', '/assets/voice/'];
// The list of recorded lines grows with every recording, so it is the one file under voice/ fetched fresh.
const isStill = (pathname) => STILL.some((part) => pathname.includes(part)) && !pathname.endsWith('/manifest.json');

// Filled in by the build (scripts/vite-plugins.mjs): the page, the code and the still pictures that every
// visit needs, stored on install so the start page and a first board work without the network.
const PRECACHE = ["./","assets/index-DtziPKmM.js","assets/WorldScene-DDitJXjt.js","assets/phaser-9f6nPpLz.js","assets/index-cZKdnVWN.css","assets/maps/landet.webp","assets/figures/apprentice.webp","assets/figures/bakerwife.webp","assets/figures/beggar.webp","assets/figures/boy.webp","assets/figures/courier.webp","assets/figures/driver.webp","assets/figures/fisher.webp","assets/figures/girl.webp","assets/figures/james.webp","assets/figures/luke.webp","assets/figures/oldwoman.webp","assets/figures/potter.webp","assets/figures/relative.webp","assets/figures/scribe.webp","assets/figures/soldier.webp","assets/figures/trader.webp"];

self.addEventListener('install', (event) => {
  const still = (url) => isStill(new URL(url, self.location.href).pathname);
  // One file that fails must not stop the rest from being stored.
  const keep = (name, urls) => caches.open(name).then((cache) => Promise.all(urls.map((url) => cache.add(url).catch(() => {}))));
  const stored = Promise.all([keep(CODE, PRECACHE.filter((url) => !still(url))), keep(STILL_CACHE, PRECACHE.filter(still))]);
  event.waitUntil(stored.then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Only the code caches of earlier builds go; the still assets are shared by every build.
  const old = (key) => key !== CODE && key !== STILL_CACHE;
  const sweep = caches.keys().then((keys) => Promise.all(keys.filter(old).map((key) => caches.delete(key))));
  event.waitUntil(sweep.then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(isStill(url.pathname) ? cacheFirst(event) : networkFirst(event));
});

// Storing happens beside the response, never in its way: a full quota is not a failed fetch.
function store(event, name, key, response) {
  event.waitUntil(caches.open(name).then((cache) => cache.put(key, response)).catch(() => {}));
}

// A media player asks for a sound in ranges, and iOS will not play one answered with the whole file. So the
// whole file is fetched and kept as for any other request, and the part asked for is cut from it.
async function cacheFirst(event) {
  const { request } = event;
  const range = request.headers.get('range');
  const key = range ? new Request(request.url) : request;
  let response = await caches.match(key, { cacheName: STILL_CACHE });
  if (!response) {
    response = await fetch(key);
    if (response.ok) store(event, STILL_CACHE, key, response.clone());
  }
  return range && response.status === 200 ? part(response, range) : response;
}

// `bytes=a-b`, `bytes=a-` or `bytes=-n` (the last n); a range past the end is refused as HTTP does.
async function part(response, range) {
  const body = await response.arrayBuffer();
  const size = body.byteLength;
  const [, from = '', to = ''] = /^bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = from === '' ? Math.max(0, size - Number(to)) : Number(from);
  const end = from === '' || to === '' ? size - 1 : Math.min(Number(to), size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  const type = response.headers.get('Content-Type') || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' };
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

async function networkFirst(event) {
  const { request } = event;
  const navigate = request.mode === 'navigate';
  // Any chapter address is the same page, so it is stored once, without the query, for all of them.
  const key = navigate ? new Request(new URL(request.url).pathname) : request;
  try {
    const response = await fetch(request, navigate ? { cache: 'no-cache' } : undefined);
    if (response.ok) store(event, CODE, key, response.clone());
    return response;
  } catch {
    const hit = await caches.match(key, { cacheName: CODE, ignoreSearch: navigate });
    return hit || Response.error();
  }
}
