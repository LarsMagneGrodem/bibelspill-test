/* global document, location, addEventListener, setTimeout, URL, URLSearchParams */
// Tellestien /til/<mål>/ (scripts/lag-nettsted.mjs, TELLESTIER): siden telles som en vanlig sidevisning av den samme
// besøkstelleren som på forsiden, uten informasjonskapsler, og sender videre med en gang. Ingenting lagres, og ingenting
// annet sendes. Telleren får vente til siden er lastet (litt over), men aldri mer enn 1,2 sekunder til sammen; uten
// skript gjør <meta http-equiv="refresh"> det samme etter 2 sekunder. replace(): «Tilbake» går forbi denne siden.
// Salg 20.11: utm_source/medium/campaign og ?fra= følger med til kjøpssiden (førsteparts, ingen cookie).
// 24.11: en tellesti til Stripe (bare https://buy.stripe.com/…, kjent lenke) tar med client_reference_id.
(function () {
  var me = document.currentScript;
  var to = me && me.getAttribute('data-til');
  function ownPath(t) { return t && t.charAt(0) === '/' && t.charAt(1) !== '/'; }
  function stripeLink(t) {
    if (!t || !/^https:\/\/buy\.stripe\.com\/[a-zA-Z0-9]+$/.test(t)) return false;
    try {
      var u = new URL(t);
      return u.protocol === 'https:' && u.hostname === 'buy.stripe.com' && /^\/[a-zA-Z0-9]+$/.test(u.pathname);
    } catch (e) { return false; }
  }
  if (!ownPath(to) && !stripeLink(to)) return;
  var params = new URLSearchParams(location.search);
  var next = new URL(to, location.origin);
  // English discount field: pass only ?code= on to the buy page, keeping the family/gift choice in data-til.
  if (ownPath(to) && (/^\/en\/kjop\.html(?:\?|$)/.test(to) || /^\/kjop\.html(?:\?|$)/.test(to) || /\/kjop\.html(?:\?|$)/.test(to))) {
    var code = params.get('code');
    if (code) next.searchParams.set('code', code.slice(0, 40));
    // Norsk rabattkode (20.11): ?rabatt=KODE fylles inn og sjekkes på kjøpssiden; kassen bestemmer prisen.
    var rabatt = params.get('rabatt');
    if (rabatt) next.searchParams.set('rabatt', rabatt.slice(0, 40));
  }
  if (ownPath(to)) {
    ['utm_source', 'utm_medium', 'utm_campaign', 'fra'].forEach(function (k) {
      var v = params.get(k);
      if (v) next.searchParams.set(k, String(v).slice(0, 64));
    });
    to = next.pathname + next.search + next.hash;
  } else {
    // Stripe Payment Link: only client_reference_id is forwarded (kilde.mjs). Nothing else is added.
    var ref = params.get('client_reference_id');
    if (ref && /^[A-Za-z0-9_-]{1,200}$/.test(ref)) next.searchParams.set('client_reference_id', ref);
    to = next.href;
  }
  // Keep meta refresh in sync when the browser has no script delay path… meta is static; script path uses replace.
  var gone = false;
  function go() {
    if (gone) return;
    gone = true;
    location.replace(to);
  }
  addEventListener('load', function () { setTimeout(go, 150); });
  setTimeout(go, 1200);
})();
