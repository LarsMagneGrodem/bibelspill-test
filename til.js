/* global document, location, addEventListener, setTimeout */
// Tellestien /til/<mål>/ (scripts/lag-nettsted.mjs, TELLESTIER): siden telles som en vanlig sidevisning av den samme
// besøkstelleren som på forsiden, uten informasjonskapsler, og sender videre med en gang. Ingenting lagres, og ingenting
// annet sendes. Telleren får vente til siden er lastet (litt over), men aldri mer enn 1,2 sekunder til sammen; uten
// skript gjør <meta http-equiv="refresh"> det samme etter 2 sekunder. replace(): «Tilbake» går forbi denne siden.
(function () {
  var me = document.currentScript;
  var to = me && me.getAttribute('data-til');
  if (!to || to.charAt(0) !== '/' || to.charAt(1) === '/') return;
  var gone = false;
  function go() {
    if (gone) return;
    gone = true;
    location.replace(to);
  }
  addEventListener('load', function () { setTimeout(go, 150); });
  setTimeout(go, 1200);
})();
