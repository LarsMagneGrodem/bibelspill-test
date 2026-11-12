/* global location, navigator, URL, caches, matchMedia */
// The front page is the sales page, and the game lives in spill/ (Lars, 11 Nov 2026). Runs first, before the page:
// a link into the game made for the old address (a gift card's QR code with ?kode=, a shared ?kapittel=, #unlock) goes
// on to spill/ with everything after the address kept, and so does the game installed on a home screen before the move
// (it starts here). Nothing is sent anywhere.
(function () {
  var q = location.search;
  var h = location.hash;
  var installed = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  if (/[?&](kode|kapittel|alle|lang)(=|&|$)/.test(q) || h === '#unlock' || installed) {
    // The front page is Norwegian: a link through it opens the game in Norwegian unless it names a language itself
    // (?lang=en from an English page), also on a phone set to English.
    if (!/[?&]lang=/.test(q)) q += (q ? '&' : '?') + 'lang=nb';
    location.replace('spill/' + q + h);
    return;
  }
  // The game used to live here, with its offline store (a service worker and its caches) for the whole site. Let it
  // go, so it does not keep serving the old game at the front page or keep its sounds on the device. The game's own
  // worker and caches, in spill/, stay (their names start with …spill/…).
  if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then(function (list) {
      list.forEach(function (r) {
        if (!/\/spill\/$/.test(new URL(r.scope).pathname)) r.unregister();
      });
    }).catch(function () {});
  }
  if (typeof caches !== 'undefined') {
    var old = 'lukas:' + encodeURIComponent(location.pathname.replace(/[^/]*$/, '')) + ':';
    caches.keys().then(function (keys) {
      keys.forEach(function (key) { if (key.indexOf(old) === 0) caches.delete(key); });
    }).catch(function () {});
  }
})();
