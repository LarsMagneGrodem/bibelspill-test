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
  'per-personlig': { eur: '€1.10', gbp: '87p', usd: '$1.10' },
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

var UK_ZONES = {
  'Europe/London': 1,
  'Europe/Guernsey': 1,
  'Europe/Jersey': 1,
  'Europe/Isle_of_Man': 1,
};

export function currencyFromTimeZone(tz) {
  var zone = String(tz || '');
  if (!zone) return '';
  if (UK_ZONES[zone]) return 'gbp';
  if (zone.indexOf('America/') === 0) return 'usd';
  return 'eur';
}

export function visitorCurrency(langs, tz) {
  var zone = String(tz || '');
  if (zone) return currencyFromTimeZone(zone);
  return currencyFromLanguages(langs) || 'eur';
}

export function formatRekke(parts, first) {
  var lead = parts[first] ? first : 'eur';
  var out = [parts[lead]];
  for (var i = 0; i < ORDER.length; i++) {
    if (ORDER[i] !== lead) out.push(parts[ORDER[i]]);
  }
  return out.join(' / ');
}

export function applyPrices(root, currency) {
  if (!root || currency === 'eur') return;
  var names = Object.keys(REKKER);
  var from = [];
  var to = [];
  for (var i = 0; i < names.length; i++) {
    from.push(formatRekke(REKKER[names[i]], 'eur'));
    to.push(formatRekke(REKKER[names[i]], currency));
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

export function languagesOf(nav) {
  var list = [];
  if (nav && nav.languages && nav.languages.length) {
    for (var i = 0; i < nav.languages.length; i++) list.push(nav.languages[i]);
  }
  if (nav && nav.language) list.push(nav.language);
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
  applyPrices(document, visitorCurrency(languagesOf(navigator), timeZoneOf()));
}
