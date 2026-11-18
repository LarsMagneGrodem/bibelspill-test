/* global location */
// Den engelske siden har flyttet til https://thejourneywithluke.com (Lars 18.11 21:22 «alt der skal nå gå via .com når
// det er i utlandet og på engelsk»). På reisenmedlukas.no/en/… sender denne fila videre til samme sti på .com, med
// spørrestreng (?code=, ?fra=) og #. Uten skript gjør <meta http-equiv="refresh"> det samme, uten spørrestreng.
// thejourneywithluke.com (Cloudflare-workeren) tar ut begge taggene, så .com sender aldri noen videre.
(function () {
  if (location.hostname !== 'reisenmedlukas.no') return;
  var path = location.pathname;
  if (path !== '/en' && path.indexOf('/en/') !== 0) return;
  location.replace('https://thejourneywithluke.com' + (path.slice(3) || '/') + location.search + location.hash);
})();
