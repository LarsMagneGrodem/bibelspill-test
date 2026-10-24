/* global self, caches, fetch, Request, Response, URL */
// Offline play. Pictures and sounds never change once published, so they live in one cache that
// outlives builds and are served from it first. The page and the code are fetched fresh, with
// the cache as the fallback when there is no network; that cache is named after the build, taken
// from the registration address, so a new build never serves old code. Videos are left to the browser
// and the network: they are too large to store, and a player must not wait for a whole file to start.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const SCOPE = `lukas:${encodeURIComponent(new URL(self.registration.scope).pathname)}:`;
const CODE_PREFIX = `${SCOPE}code:`;
const CODE = `${CODE_PREFIX}${VERSION}`;
const STILL_CACHE = `${SCOPE}still`;
const STILL = ['/assets/maps/', '/assets/figures/', '/assets/portraits/', '/assets/art/', '/assets/things/', '/assets/audio/', '/assets/voice/', '/assets/films/'];
// The list of recorded lines grows with every recording, so it is the one file under voice/ fetched fresh.
const isStill = (pathname) => STILL.some((part) => pathname.includes(part)) && !pathname.endsWith('/manifest.json');
const isVideo = (pathname) => /\.(mp4|webm|m4v|mov)$/i.test(pathname);

// Filled in by the build (scripts/vite-plugins.mjs): the page, the code and the still pictures that every
// visit needs, so the start page and a first board work without the network.
const PRECACHE = ["./","assets/index-CC-pJFB-.js","assets/WorldScene-FhcTMJNd.js","assets/chapter-DgfQ6IlR.js","assets/companion-DyJHZ348.js","assets/diagnose-xjlxZqVA.js","assets/discovery-PBLst_e1.js","assets/effects-CELrVPlC.js","assets/game-B_TbLUjD.js","assets/phaser-DwlVtrz6.js","assets/road-schema-DOEaqRG3.js","assets/rolldown-runtime-hePW80VL.js","assets/index-CO0QHFxc.css","assets/maps/cesarea-torg.webp","assets/maps/skrivestue.webp","assets/maps/verksted.webp","assets/maps/stue.webp","assets/art/intro-grandfather-arrival.webp","assets/art/intro-grandfather.webp","assets/art/intro-grandfather-nature.webp","assets/art/intro-luke-apprentice.jpg","assets/films/grandfather-intro-nb-r68.vtt","assets/voice/nb/ab3c675e65f62df9.mp3","assets/voice/nb/0245d1928d87cdc6.mp3","assets/voice/nb/91cf15eb51528255.mp3","assets/voice/nb/712da0b1609a97f7.mp3","assets/voice/nb/e74c40fbea09c598.mp3","assets/voice/nb/8167005b5f99eda8.mp3","assets/voice/nb/0abede796b06af78.mp3","assets/voice/nb/715b3c98b066825c.mp3","assets/voice/nb/a4b2bff0296e4788.mp3","assets/voice/nb/366f439110a463a6.mp3","assets/voice/nb/431c1027c7f06a7d.mp3","assets/voice/nb/74905554e1be4c01.mp3","assets/voice/nb/bb30f6a2446e24b5.mp3","assets/voice/nb/55ff57874124db9e.mp3","assets/voice/nb/09f9a1e3d1d7b5f9.mp3","assets/voice/nb/4ce9936e9e51fd15.mp3","assets/voice/nb/c271da3b6e2e1448.mp3","assets/voice/nb/404e5f66ba785580.mp3","assets/portraits/lukas.webp","assets/portraits/fisher.webp","assets/portraits/potter.webp","assets/portraits/driver.webp","assets/portraits/cart-donkey.webp","assets/portraits/shards.webp","assets/portraits/oldwoman.webp","assets/portraits/well.webp","assets/portraits/scribe.webp","assets/portraits/girl.webp","assets/portraits/boy.webp","assets/portraits/trader.webp","assets/portraits/soldier.webp","assets/portraits/courier.webp","assets/figures/apprentice.webp","assets/figures/luke.webp","assets/figures/fisher.webp","assets/figures/potter.webp","assets/figures/driver.webp","assets/things/cart-donkey-map.webp","assets/things/shard.png","assets/figures/oldwoman.webp","assets/figures/scribe.webp","assets/figures/girl.webp","assets/figures/boy.webp","assets/figures/trader.webp","assets/figures/soldier.webp","assets/figures/courier.webp","assets/things/dog-sleeping.webp","assets/figures/player-inspect.webp","assets/figures/player-inspect-away-r77.webp","assets/figures/player-inspect-sequence-r87.webp","assets/audio/fx/footstep00.mp3","assets/audio/fx/footstep01.mp3","assets/audio/fx/footstep02.mp3","assets/audio/fx/footstep03.mp3","assets/audio/fx/footstep04.mp3","assets/audio/fx/bookFlip1.mp3","assets/audio/fx/bookFlip2.mp3","assets/audio/fx/bookFlip3.mp3","assets/audio/fx/bookOpen.mp3","assets/audio/fx/cloth1.mp3","assets/audio/fx/cloth2.mp3","assets/audio/fx/handleCoins.mp3","assets/audio/fx/handleCoins2.mp3","assets/audio/fx/bookClose.mp3","assets/audio/fx/doorOpen_1.mp3","assets/audio/fx/dropLeather.mp3","assets/audio/fx/metalPot2.mp3","assets/audio/fx/creak1.mp3","assets/audio/fx/creak2.mp3","assets/audio/fx/metalPot1.mp3","assets/audio/fx/metalPot3.mp3","assets/audio/fx/handleSmallLeather.mp3","assets/maps/landet.webp","assets/maps/landet-960.webp","assets/voice/manifest.json","manifest.webmanifest"];

const at = (url) => new URL(url, self.location.href);
const old = (key) => key.startsWith(CODE_PREFIX) && key !== CODE;
const cacheFor = (url) => (isStill(at(url).pathname) ? STILL_CACHE : CODE);

// One fetch per file, whoever asks: the page waiting for a room and the store filling up behind it share it.
const pending = new Map();
function take(url) {
  const key = at(url).href;
  if (!pending.has(key)) {
    const name = cacheFor(key);
    const fetched = (async () => {
      const hit = await caches.match(key, { cacheName: name });
      if (hit) return hit;
      const response = await fetch(new Request(key));
      // A full quota is not a failed fetch.
      if (response.ok) await caches.open(name).then((cache) => cache.put(key, response.clone())).catch(() => {});
      return response;
    })();
    pending.set(key, fetched);
    fetched.finally(() => pending.delete(key)).catch(() => {});
  }
  return pending.get(key).then((response) => response.clone());
}

// The store fills one file at a time, and waits while the page fetches anything, so the room the player walks into
// never stands in line behind it. First what the page names (the rooms nearest the player, see src/app/offline.ts),
// then the code, then the rest of the first board.
const queue = PRECACHE.filter((url) => !isVideo(at(url).pathname)).sort((a, b) => Number(cacheFor(a) === STILL_CACHE) - Number(cacheFor(b) === STILL_CACHE));
let fetching = 0;
const quiet = [];
function busy(promise) {
  fetching += 1;
  const done = () => {
    fetching -= 1;
    if (fetching === 0) quiet.splice(0).forEach((go) => go());
  };
  promise.then(done, done);
  return promise;
}
let filling = null;
function fill() {
  filling ??= (async () => {
    while (queue.length) {
      if (fetching > 0) await new Promise((go) => quiet.push(go));
      await take(queue.shift()).catch(() => {});
    }
  })().finally(() => (filling = null));
  return filling;
}

self.addEventListener('message', (event) => {
  const near = (Array.isArray(event.data?.near) ? event.data.near : []).filter((url) => typeof url === 'string' && at(url).origin === self.location.origin && isStill(at(url).pathname) && !isVideo(at(url).pathname));
  const first = near.map((url) => at(url).href);
  const rest = queue.filter((url) => !first.includes(at(url).href));
  queue.splice(0, queue.length, ...first, ...rest);
  event.waitUntil(fill());
});

// An update stores its code before it takes over, so a player who goes offline keeps a whole build. A first install
// has no build to keep, so it takes the page at once and the store fills while the player plays.
self.addEventListener('install', (event) => {
  const update = caches.keys().then((keys) => keys.some(old));
  const code = queue.filter((url) => cacheFor(url) === CODE);
  const stored = update.then((yes) => yes && caches.open(CODE).then((cache) => Promise.all(code.map((url) => cache.add(url).catch(() => {})))));
  event.waitUntil(stored.then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Legacy caches have no known scope owner, so leave them and every other app's caches alone.
  const sweep = caches.keys().then((keys) => Promise.all(keys.filter(old).map((key) => caches.delete(key))));
  // Earlier builds stored every film that was watched; give that space back.
  const videos = caches.open(STILL_CACHE).then((cache) => cache.keys().then((keys) => Promise.all(keys.filter((key) => isVideo(new URL(key.url).pathname)).map((key) => cache.delete(key)))));
  event.waitUntil(Promise.all([sweep, videos.catch(() => {})]).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || isVideo(url.pathname)) return;
  event.respondWith(busy(request.headers.has('range') ? ranged(request) : isStill(url.pathname) ? take(request.url) : networkFirst(event)));
});

// Storing happens beside the response, never in its way: a full quota is not a failed fetch.
function store(event, name, key, response) {
  event.waitUntil(caches.open(name).then((cache) => cache.put(key, response)).catch(() => {}));
}

// A media player asks for a sound in ranges. A sound stored on install (the first board's lines) is cut from
// the stored copy so it plays offline; iOS will not play one answered with the whole file. Anything else goes
// to the network as asked and is not stored, since storing it means fetching the whole file first.
async function ranged(request) {
  const stored = await caches.match(new Request(request.url), { cacheName: STILL_CACHE });
  return stored && stored.status === 200 ? part(stored, request.headers.get('range')) : fetch(request);
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
