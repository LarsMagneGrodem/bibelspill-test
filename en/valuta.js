// The English sales and buy pages: show the visitor's currency first (€24.99 / £19.99 / $24.99,
// and the family and per-door lines). The amounts are the ones the Stripe Payment Links already
// charge (kasse r48, STRIPE_AMOUNTS_*). The pages are static on GitHub Pages, so the country is
// read only from the browser: the time zone first (America/* is USD, UK zones are GBP, any
// other known zone is EUR), and the language region (en-GB, en-US) only when the time zone is
// missing. There is no currency parameter on a Payment Link, so the checkout link itself is
// unchanged; Stripe already picks a currency (fixed EUR/GBP/USD prices, or Adaptive Pricing
// for other currencies).
export var ORDER = ['eur', 'gbp', 'usd'];

export var REKKER = {
  personlig: { eur: '€24.99', gbp: '£19.99', usd: '$24.99' },
  familie: { eur: '€49.99', gbp: '£39.99', usd: '$49.99' },
  'per-personlig': { eur: '€1.10', gbp: '£0.87', usd: '$1.10' },
  'per-familie': { eur: '€2.20', gbp: '£1.75', usd: '$2.20' },
};

export function regionOf(tag) {
  var m = String(tag || '').replace(/_/g, '-').match(/^[A-Za-z]{2,3}-([A-Za-z]{2})\b/);
  return m ? m[1].toUpperCase() : '';
}

export function currencyFromLanguages(langs) {
  var list = langs || [];
  for (var i = 0; i < list.length; i++) {
    var region = regionOf(list[i]);
    if (region === 'GB' || region === 'UK') return 'gbp';
    if (region === 'US') return 'usd';
  }
  return '';
}

// Salg 19.11: «$» alone reads as the local dollar in Canada, Australia, New Zealand, Singapore and elsewhere, where the
// amount is US dollars. Outside the United States the dollar price is written «US$» (the same amount).
var US_ZONES = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Adak|Boise|Detroit|Juneau|Sitka|Yakutat|Nome|Metlakatla|Menominee|Puerto_Rico|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+|Indianapolis|Louisville)|Pacific\/(Honolulu|Guam|Saipan|Pago_Pago)|US\/.+)$/;

var UK_ZONES = {
  'Europe/London': 1,
  'Europe/Guernsey': 1,
  'Europe/Jersey': 1,
  'Europe/Isle_of_Man': 1,
};

// 24.11 (Lars 00:12, punkt A): a zone that says nothing about the country (UTC, Etc/…, GMT, as some private browsers
// report) is treated as missing, so the browser's language decides there (en-US $, en-GB £, else €).
var NO_COUNTRY = /^(UTC|UCT|GMT|Etc\/.*|Universal|Zulu|Greenwich|Factory)$/;

export function currencyFromTimeZone(tz) {
  var zone = String(tz || '');
  if (!zone || NO_COUNTRY.test(zone)) return '';
  if (UK_ZONES[zone]) return 'gbp';
  if (zone.indexOf('America/') === 0 || US_ZONES.test(zone)) return 'usd';
  return 'eur';
}

/** The currency shown first. navigator.language (en-US $, en-GB £) decides when the time zone agrees or says nothing
 *  about the country. When the two disagree (an en-US browser in Norway), the zone wins: Stripe picks the currency it
 *  charges from where the buyer is, so the button never shows $ to someone Stripe will charge in €. */
export function visitorCurrency(langs, tz) {
  var byZone = currencyFromTimeZone(tz);
  var byLang = currencyFromLanguages(langs);
  if (!byZone) return byLang || 'eur';
  return byLang === byZone ? byLang : byZone;
}

export function formatRekke(parts, first) {
  var lead = parts[first] ? first : 'eur';
  var out = [parts[lead]];
  for (var i = 0; i < ORDER.length; i++) {
    if (ORDER[i] !== lead) out.push(parts[ORDER[i]]);
  }
  return out.join(' / ');
}

export function plainDollar(langs, tz) {
  var zone = String(tz || '');
  if (zone && !NO_COUNTRY.test(zone)) return US_ZONES.test(zone);
  return currencyFromLanguages(langs) === 'usd';
}

export function usLabel(text) {
  return text.replace(/(^|[^A-Z])\$(?=\d)/g, '$1US$$');
}

export function applyPrices(root, currency, plain) {
  var usPlain = plain !== false;
  if (!root || (currency === 'eur' && usPlain)) return;
  var names = Object.keys(REKKER);
  var from = [];
  var to = [];
  for (var i = 0; i < names.length; i++) {
    from.push(formatRekke(REKKER[names[i]], 'eur'));
    var line = formatRekke(REKKER[names[i]], currency);
    to.push(usPlain ? line : usLabel(line));
  }
  var showText = (typeof NodeFilter !== "undefined" && NodeFilter.SHOW_TEXT) || 4;
  var walk = root.createTreeWalker(root, showText);
  var node;
  while ((node = walk.nextNode())) {
    var text = node.nodeValue;
    var next = text;
    for (var j = 0; j < from.length; j++) {
      if (next.indexOf(from[j]) !== -1) next = next.split(from[j]).join(to[j]);
    }
    if (next !== text) node.nodeValue = next;
  }
}

/** Salg 19.11 (Lars 01:12 «Vi vil ha pris på den engelske knappen»): the main «Buy a code – €24.99» button shows the
 *  personal price in the visitor's currency, with «US$» outside the United States, as the lines above. */
export function priceLabel(currency, plain) {
  var p = REKKER.personlig[currency] || REKKER.personlig.eur;
  return plain === false ? usLabel(p) : p;
}
export function applyButtons(root, currency, plain) {
  if (!root || !root.querySelectorAll) return;
  var list = root.querySelectorAll('[data-pris="personlig"]');
  for (var i = 0; i < list.length; i++) {
    var el = list[i];
    el.textContent = el.textContent.replace(/ – [^ ]+$/, ' – ' + priceLabel(currency, plain));
  }
}

export function languagesOf(nav) {
  var list = [];
  // navigator.language first (the browser's own language), then the rest of the list.
  if (nav && nav.language) list.push(nav.language);
  if (nav && nav.languages && nav.languages.length) {
    for (var i = 0; i < nav.languages.length; i++) list.push(nav.languages[i]);
  }
  return list;
}

export function timeZoneOf() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    return '';
  }
}

if (typeof document !== 'undefined') {
  applyPrices(document, visitorCurrency(languagesOf(navigator), timeZoneOf()), plainDollar(languagesOf(navigator), timeZoneOf()));
  applyButtons(document, visitorCurrency(languagesOf(navigator), timeZoneOf()), plainDollar(languagesOf(navigator), timeZoneOf()));
}
