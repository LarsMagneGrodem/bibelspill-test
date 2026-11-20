/* global document, location, addEventListener, setTimeout, URL, URLSearchParams */
// Tellestien /til/<mål>/ (scripts/lag-nettsted.mjs, TELLESTIER): siden telles som en vanlig sidevisning av den samme
// besøkstelleren som på forsiden, uten informasjonskapsler, og sender videre med en gang. Ingenting lagres, og ingenting
// annet sendes. Telleren får vente til siden er lastet (litt over), men aldri mer enn 1,2 sekunder til sammen; uten
// skript gjør <meta http-equiv="refresh"> det samme etter 2 sekunder. replace(): «Tilbake» går forbi denne siden.
// Salg 20.11: utm_source/medium/campaign og ?fra= følger med til kjøpssiden (førsteparts, ingen cookie).
(function () {
  var me = document.currentScript;
  var to = me && me.getAttribute('data-til');
  if (!to || to.charAt(0) !== '/' || to.charAt(1) === '/') return;
  var params = new URLSearchParams(location.search);
  var next = new URL(to, location.origin);
  // English discount field: pass only ?code= on to the buy page, keeping the family/gift choice in data-til.
  if (/^\/en\/kjop\.html(?:\?|$)/.test(to) || /^\/kjop\.html(?:\?|$)/.test(to) || /\/kjop\.html(?:\?|$)/.test(to)) {
    var code = params.get('code');
    if (code) next.searchParams.set('code', code.slice(0, 40));
    // Norsk rabattkode (20.11): ?rabatt=KODE fylles inn og sjekkes på kjøpssiden; kassen bestemmer prisen.
    var rabatt = params.get('rabatt');
    if (rabatt) next.searchParams.set('rabatt', rabatt.slice(0, 40));
  }
  ['utm_source', 'utm_medium', 'utm_campaign', 'fra'].forEach(function (k) {
    var v = params.get(k);
    if (v) next.searchParams.set(k, String(v).slice(0, 64));
  });
  to = next.pathname + next.search + next.hash;
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
