/* global self, caches, fetch, Request, Response, URL, setTimeout */
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
// A clip is named by its text, so a line recorded again with another voice keeps its name. Raise the round
// with every recording that replaces clips already published, or players keep hearing the old voice.
const VOICE_ROUND = 2;
const VOICE_PREFIX = `${SCOPE}voice:`;
const VOICE_CACHE = `${VOICE_PREFIX}${VOICE_ROUND}`;
const isVoice = (pathname) => pathname.includes('/assets/voice/');
const STILL = ['/assets/maps/', '/assets/card/', '/assets/figures/', '/assets/portraits/', '/assets/art/', '/assets/things/', '/assets/audio/', '/assets/voice/', '/assets/films/'];
// The list of recorded lines grows with every recording, so it is the one file under voice/ fetched fresh.
const isStill = (pathname) => STILL.some((part) => pathname.includes(part)) && !pathname.endsWith('/manifest.json');
const isVideo = (pathname) => /\.(mp4|webm|m4v|mov)$/i.test(pathname);
// G5: a script or style with the build's hash in its name never changes, so the stored copy is as good as the network's.
const isHashed = (pathname) => /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(pathname);
// G9: a network that takes the page but never answers (weak mobile data, a hotel's login wifi) must not keep the child
// in front of a dark screen for a minute: after this long the stored page is used, and the network fills the store behind.
const NAVIGATE_WAIT_MS = 3500;

// Filled in by the build (scripts/vite-plugins.mjs): the page, the code and the still pictures that every
// visit needs, so the start page and a first board work without the network.
const PRECACHE = ["./","assets/index-sBXoqPqH.js","assets/WorldScene-DkGrx5H_.js","assets/adult-door-tLiQdvB9.js","assets/chapter-fGVUwMqQ.js","assets/companion-16DTIfey.js","assets/diagnose-nbTjDdjo.js","assets/discovery-BnAVR93r.js","assets/draw-R9BXNFEn.js","assets/effects-Byv2na61.js","assets/focus-B00-MeE-.js","assets/gains-DGmhsCFh.js","assets/game-DKXkHV0q.js","assets/phaser-D8At0iQG.js","assets/playroom-GqDQeEGx.js","assets/report-w5DmooT0.js","assets/road-schema-35DYGkZD.js","assets/rolldown-runtime-XKyaHtl9.js","assets/schema-C0_ELLFt.js","assets/scroll-closeup-jVfwFgto.js","assets/theme-BRDZoRXh.js","assets/ui-0uufx24i.js","assets/adult-door-CsSCQWwa.css","assets/index-DGjt3jVy.css","assets/playroom-yxZfzLUs.css","assets/report-6py6UbaN.css","assets/scroll-closeup-lo-jixhK.css","assets/ui-CQ0RtpGh.css","assets/maps/cesarea-torg.webp","assets/maps/skrivestue.webp","assets/maps/verksted.webp","assets/maps/stue.webp","assets/art/intro-grandfather-arrival.webp","assets/art/intro-grandfather-nature.webp","assets/art/intro-grandfather.webp","assets/art/intro-luke-apprentice.jpg","assets/films/grandfather-intro-nb-readable-r138.vtt","assets/films/grandfather-intro-en-readable-r140.vtt","assets/voice/nb/ab3c675e65f62df9.mp3","assets/voice/en/edbdb09715454007.mp3","assets/voice/nb/3b082339ed18080a.mp3","assets/voice/en/615b56ab0a53bb41.mp3","assets/voice/nb/3ae4ee7c01301cce.mp3","assets/voice/en/c3f00f6ecced99ef.mp3","assets/voice/nb/0abede796b06af78.mp3","assets/voice/en/f4b1f77a26ef24ac.mp3","assets/voice/nb/715b3c98b066825c.mp3","assets/voice/en/4450aa4b707dab0a.mp3","assets/voice/nb/75fb455f2adaade1.mp3","assets/voice/en/58e929f668729457.mp3","assets/voice/nb/2552db08128d82a9.mp3","assets/voice/en/0ae4eb5e8e1bf67b.mp3","assets/voice/nb/74905554e1be4c01.mp3","assets/voice/en/9a343fc71b33413f.mp3","assets/voice/nb/2f3866d77bc83107.mp3","assets/voice/en/c9b353514b37bfc0.mp3","assets/voice/nb/ba4e4e1911d6412b.mp3","assets/voice/en/752ac4fc814cfee9.mp3","assets/voice/nb/083aa6a669f393e4.mp3","assets/voice/en/12d03b2139f4d80e.mp3","assets/voice/nb/85bdc0fb8c1b0ec0.mp3","assets/voice/en/47e40c77ad3ed4f2.mp3","assets/portraits/lukas.webp","assets/portraits/fisher.webp","assets/portraits/potter.webp","assets/portraits/driver.webp","assets/portraits/cart-donkey.webp","assets/portraits/shards.webp","assets/portraits/oldwoman.webp","assets/portraits/well.webp","assets/portraits/scribe.webp","assets/portraits/girl.webp","assets/portraits/boy.webp","assets/portraits/trader.webp","assets/portraits/soldier.webp","assets/portraits/courier.webp","assets/figures/apprentice.webp","assets/figures/luke.webp","assets/figures/fisher.webp","assets/figures/potter.webp","assets/figures/driver.webp","assets/things/cart-donkey-map.webp","assets/things/shard.png","assets/figures/oldwoman.webp","assets/figures/scribe.webp","assets/figures/girl.webp","assets/figures/boy.webp","assets/figures/trader.webp","assets/figures/soldier.webp","assets/figures/courier.webp","assets/things/dog-sleeping.webp","assets/figures/player-inspect.webp","assets/figures/player-inspect-away-r77.webp","assets/figures/player-inspect-sequence-r87.webp","assets/audio/fx/footstep00.mp3","assets/audio/fx/footstep01.mp3","assets/audio/fx/footstep02.mp3","assets/audio/fx/footstep03.mp3","assets/audio/fx/footstep04.mp3","assets/audio/fx/bookFlip1.mp3","assets/audio/fx/bookFlip2.mp3","assets/audio/fx/bookFlip3.mp3","assets/audio/fx/bookOpen.mp3","assets/audio/fx/cloth1.mp3","assets/audio/fx/cloth2.mp3","assets/audio/fx/handleCoins.mp3","assets/audio/fx/handleCoins2.mp3","assets/audio/fx/bookClose.mp3","assets/audio/fx/doorOpen_1.mp3","assets/audio/fx/dropLeather.mp3","assets/audio/fx/metalPot2.mp3","assets/audio/fx/creak1.mp3","assets/audio/fx/creak2.mp3","assets/audio/fx/metalPot1.mp3","assets/audio/fx/metalPot3.mp3","assets/audio/fx/handleSmallLeather.mp3","assets/things/cart-scene-parts.webp","assets/maps/mini/cesarea-torg.webp","assets/voice/nb/4f1b5cb90c3efa79.mp3","assets/voice/nb/499d9a89259320ad.mp3","assets/voice/nb/250a947b4314ee06.mp3","assets/voice/nb/ef7bbe5fed1ebf52.mp3","assets/voice/nb/bbb88ccecbd05dd6.mp3","assets/voice/nb/795113d80fac2da7.mp3","assets/voice/nb/0b9045f50b7d52e2.mp3","assets/voice/nb/0080024cb59fae25.mp3","assets/voice/en/96ddf473fd192a86.mp3","assets/voice/en/7875c651e46c2aa1.mp3","assets/voice/en/d01f5a6a070f6958.mp3","assets/voice/en/053e671928e55098.mp3","assets/voice/en/e293b8bbc1cde1e3.mp3","assets/voice/en/0cddd1f960013a11.mp3","assets/voice/en/65e5fc227d7b7310.mp3","assets/voice/en/d157e05c360cf7ae.mp3","assets/maps/landet.webp","assets/maps/landet-960.webp","assets/voice/manifest.json","manifest.webmanifest"];

const at = (url) => new URL(url, self.location.href);
// H1 (check 12.11): a page is only stored when it is this build's page. A page from a newer build that comes in behind a
// stored page (G9), or on an ordinary visit before the new worker took over, names code this build never stored; kept under
// this build's name it was served offline and stood on «Laster …» for good, also after «Last på nytt». The build fills
// PRECACHE with its own entry code, so a page is this build's when every hashed script and style it names is in that list.
const OWN_CODE = new Set(PRECACHE.filter((url) => isHashed(at(url).pathname)).map((url) => at(url).pathname));
const isPage = (response) => (response.headers.get('Content-Type') || '').includes('text/html');
async function ownBuild(response) {
  if (!OWN_CODE.size || !isPage(response)) return true;
  const html = await response.clone().text().catch(() => '');
  const named = [...html.matchAll(/(?:src|href)=["']?([^"'\s>]*\/?assets\/[^"'\s>]+\.(?:js|css))/g)].map(([, url]) => at(url).pathname).filter(isHashed);
  return named.length > 0 && named.every((pathname) => OWN_CODE.has(pathname));
}
const old = (key) => (key.startsWith(CODE_PREFIX) && key !== CODE) || (key.startsWith(VOICE_PREFIX) && key !== VOICE_CACHE);
const cacheFor = (url) => {
  const { pathname } = at(url);
  if (!isStill(pathname)) return CODE;
  return isVoice(pathname) ? VOICE_CACHE : STILL_CACHE;
};

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
      if (response.ok && (await ownBuild(response))) await caches.open(name).then((cache) => cache.put(key, response.clone())).catch(() => {});
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
const queue = PRECACHE.filter((url) => !isVideo(at(url).pathname)).sort((a, b) => Number(cacheFor(a) !== CODE) - Number(cacheFor(b) !== CODE));
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
// has no build to keep, so it takes the page at once and the store fills while the player plays. The code is fetched past
// the browser's own cache: the page and the lists keep their names from build to build, and the copy the browser held for
// ten minutes was the last build's page, stored under the new build's name, so offline it asked for code no longer kept.
// P-03 (publisering 15.11): an update takes over only when everything a start and the first board need is stored: the
// code, and the pictures and sounds of PRECACHE (most are kept from the last build already). One file that does not come
// (the network went away, the server answered with an error, or a newer build's page came in) fails the install, so the
// browser keeps the old worker and its whole store, and tries again at the next visit or check (src/app/ny-versjon.ts).
// Before, each file's failure was swallowed: the new worker took over with half a store, deleted the old one, and offline
// the child stood on «Laster …». A full device is the one exception: a store that cannot be written takes over as before.
const full = (error) => error?.name === 'QuotaExceededError';
async function keep(name, url, fresh) {
  const key = at(url).href;
  if (!fresh && (await caches.match(key, { cacheName: name }))) return;
  const response = await fetch(new Request(key, fresh ? { cache: 'reload' } : undefined));
  if (!response.ok || !(await ownBuild(response))) throw new Error(`${key}: ${response.status}`);
  await caches.open(name).then((cache) => cache.put(key, response)).catch((error) => { if (!full(error)) throw error; });
}
async function storeWhole() {
  await caches.open(CODE);
  const files = queue.slice();
  const next = async () => {
    while (files.length) {
      const url = files.shift();
      const name = cacheFor(url);
      await keep(name, url, name === CODE);
    }
  };
  await Promise.all(Array.from({ length: 6 }, next));
}
self.addEventListener('install', (event) => {
  const update = caches.keys().then((keys) => keys.some(old));
  event.waitUntil(update.then((yes) => yes && storeWhole()).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Legacy caches have no known scope owner, so leave them and every other app's caches alone.
  const sweep = caches.keys().then((keys) => Promise.all(keys.filter(old).map((key) => caches.delete(key))));
  // Earlier builds stored every film that was watched, and every clip among the pictures; give that space back.
  const moved = (pathname) => isVideo(pathname) || isVoice(pathname);
  const videos = caches.open(STILL_CACHE).then((cache) => cache.keys().then((keys) => Promise.all(keys.filter((key) => moved(new URL(key.url).pathname)).map((key) => cache.delete(key)))));
  event.waitUntil(Promise.all([sweep, videos.catch(() => {})]).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || isVideo(url.pathname)) return;
  const later = lifetime(event);
  const answer = busy(request.headers.has('range') ? ranged(request) : isStill(url.pathname) ? take(request.url) : isHashed(url.pathname) ? hashedFirst(event, later) : networkFirst(event, later));
  event.respondWith(answer);
  later.answered(answer);
});

// P-12 (publisering 15.11): WebKit refuses `waitUntil` once the fetch event has been dispatched, and the code fetched
// while the child played was then never stored (the store stood at 21 files after a whole first board; offline the first
// case could not be solved). So the event's life is extended at once, while it is dispatched, with one promise that holds
// until the answer is given and every store started for it is done.
function lifetime(event) {
  const jobs = new Set();
  let release = () => {};
  let given = false;
  const settle = () => { if (given && jobs.size === 0) release(); };
  try {
    event.waitUntil(new Promise((go) => (release = go)));
  } catch { /* an event that cannot be kept alive: the stores still run */ }
  return {
    add(promise) {
      const job = Promise.resolve(promise).catch(() => {}).finally(() => { jobs.delete(job); settle(); });
      jobs.add(job);
    },
    answered(promise) { Promise.resolve(promise).catch(() => {}).finally(() => { given = true; settle(); }); },
  };
}

// Storing happens beside the response, never in its way: a full quota is not a failed fetch.
function store(later, name, key, response) {
  later.add(ownBuild(response).then((yes) => yes && caches.open(name).then((cache) => cache.put(key, response))));
}

// A media player asks for a sound in ranges. A sound stored on install (the first board's lines) is cut from
// the stored copy so it plays offline; iOS will not play one answered with the whole file. Anything else goes
// to the network as asked and is not stored, since storing it means fetching the whole file first.
async function ranged(request) {
  const stored = await caches.match(new Request(request.url), { cacheName: cacheFor(request.url) });
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

// G5: the stored copy first; else the network; and when the server no longer has the file (a page opened before a new
// build was published asks for the old build's code), any copy this game still keeps.
async function hashedFirst(event, later) {
  const { request } = event;
  const kept = () => caches.match(request, { cacheName: CODE, ignoreVary: true });
  const hit = await kept();
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok) {
      store(later, CODE, request, response.clone());
      return response;
    }
    return (await kept()) || response;
  } catch {
    return (await kept()) || Response.error();
  }
}

async function networkFirst(event, later) {
  const { request } = event;
  const navigate = request.mode === 'navigate';
  // Any chapter address is the same page, so it is stored once, without the query, for all of them.
  const key = navigate ? new Request(new URL(request.url).pathname) : request;
  // The store filled these itself, without the page's request headers; a server that answers `Vary: Origin` (the
  // module scripts' cross-origin mode sends one) would otherwise never match its own copy offline.
  const cached = () => caches.match(key, { cacheName: CODE, ignoreSearch: navigate, ignoreVary: true });
  const net = fetch(request, navigate ? { cache: 'no-cache' } : undefined).then((response) => {
    if (response.ok) store(later, CODE, key, response.clone());
    return response;
  });
  if (navigate) {
    // G9: the network gets a few seconds; then the stored page of this same build, while the network keeps going.
    const first = await Promise.race([net.catch(() => null), new Promise((go) => setTimeout(go, NAVIGATE_WAIT_MS, 'slow'))]);
    if (first && first !== 'slow' && first.ok) return first;
    const hit = await cached();
    if (hit) {
      later.add(net);
      return hit;
    }
  }
  try {
    const response = await net;
    if (response.ok) return response;
    // G5: a server without the file (or one that answers with an error page): the stored copy, if there is one.
    return (await cached()) || response;
  } catch {
    return (await cached()) || Response.error();
  }
}
