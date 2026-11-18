/* global document, location, addEventListener, setTimeout, URL, URLSearchParams */
// Tellestien /til/<mål>/ (scripts/lag-nettsted.mjs, TELLESTIER): siden telles som en vanlig sidevisning av den samme
// besøkstelleren som på forsiden, uten informasjonskapsler, og sender videre med en gang. Ingenting lagres, og ingenting
// annet sendes. Telleren får vente til siden er lastet (litt over), men aldri mer enn 1,2 sekunder til sammen; uten
// skript gjør <meta http-equiv="refresh"> det samme etter 2 sekunder. replace(): «Tilbake» går forbi denne siden.
(function () {
  var me = document.currentScript;
  var to = me && me.getAttribute('data-til');
  if (!to || to.charAt(0) !== '/' || to.charAt(1) === '/') return;
  // English discount field: pass only ?code= on to the buy page, keeping the family/gift choice in data-til.
  if (/^\/en\/kjop\.html(?:\?|$)/.test(to)) {
    var code = new URLSearchParams(location.search).get('code');
    if (code) {
      var next = new URL(to, location.origin);
      next.searchParams.set('code', code.slice(0, 40));
      to = next.pathname + next.search;
    }
  }
  var gone = false;
  function go() {
    if (gone) return;
    gone = true;
    location.replace(to);
  }
  addEventListener('load', function () { setTimeout(go, 150); });
  setTimeout(go, 1200);
})();
