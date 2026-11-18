/* global document, navigator, location, URLSearchParams */
// «Have a discount code?» on the English buy page (Lars 18.11 19:03 «gi gass»). Stripe turns down promotion codes on
// Payment Links with Managed Payments, so a known code sends the buyer to its own Payment Links instead, where the
// discount is already in the price (kasse r50, STRIPE_CAMPAIGNS). Matching is here, in the page, and case-insensitive;
// the checkout itself only accepts each discounted amount on its own link. Nothing is sent or stored. ?code=CHESSLUKE
// fills the field in and applies it. A code stops working here after its last moment (Oslo time); the Stripe links are
// switched off then as well.
import { languagesOf, timeZoneOf, visitorCurrency } from './valuta.js';

// More codes later: one more entry, with its own two Payment Links and the prices those links charge.
export var KODER = {
  CHESSLUKE: {
    percent: 25,
    validUntil: '2026-12-24T23:59:59.999+01:00',
    personal: 'https://buy.stripe.com/fZu7sN42tcNj5CK7aLgnK02',
    family: 'https://buy.stripe.com/4gM5kF0QhbJffdkamXgnK03',
    prices: {
      personal: { eur: '€18.74', gbp: '£14.99', usd: '$18.74' },
      family: { eur: '€37.49', gbp: '£29.99', usd: '$37.49' },
    },
  },
};

export var TEKST = {
  applied: '{percent}% off applied. Personal: {personal}. Family: {family}.',
  unknown: 'We don’t recognise that code.',
  expired: 'That code has expired.',
};

export function normalise(code) {
  return String(code || '').replace(/\s+/g, '').toUpperCase();
}

/** { ok: true, code, offer } or { ok: false, why: 'unknown' | 'expired' | 'empty' }. */
export function lookUp(code, now, list) {
  var codes = list || KODER;
  var key = normalise(code);
  if (!key) return { ok: false, why: 'empty' };
  if (!Object.prototype.hasOwnProperty.call(codes, key)) return { ok: false, why: 'unknown' };
  var offer = codes[key];
  var end = Date.parse(offer.validUntil);
  if (!(end >= (now instanceof Date ? now.getTime() : Number(now)))) return { ok: false, why: 'expired' };
  return { ok: true, code: key, offer: offer };
}

export function appliedText(offer, currency) {
  var cur = offer.prices.personal[currency] ? currency : 'eur';
  return TEKST.applied.replace('{percent}', String(offer.percent)).replace('{personal}', offer.prices.personal[cur]).replace('{family}', offer.prices.family[cur]);
}

if (typeof document !== 'undefined') {
  (function () {
    var box = document.getElementById('rabatt');
    var input = document.getElementById('rabattkode');
    var apply = document.getElementById('rabatt-bruk');
    var answer = document.getElementById('rabatt-svar');
    var pay = document.getElementById('betal');
    var form = document.getElementById('skjema');
    if (!box || !input || !apply || !answer || !pay) return;
    var full = { personal: pay.dataset.personal, family: pay.dataset.family };
    var currency = visitorCurrency(languagesOf(navigator), timeZoneOf());
    function links(personal, family) {
      pay.dataset.personal = personal;
      pay.dataset.family = family;
      var chosen = document.querySelector('input[name="product"]:checked');
      pay.href = chosen && chosen.value === 'family' ? family : personal;
    }
    function run() {
      var hit = lookUp(input.value, new Date());
      if (hit.ok) {
        links(hit.offer.personal, hit.offer.family);
        input.value = hit.code;
        answer.textContent = appliedText(hit.offer, currency);
        answer.className = 'small rabatt-svar rabatt-svar--ok';
        box.dataset.code = hit.code;
        return;
      }
      links(full.personal, full.family);
      delete box.dataset.code;
      answer.textContent = hit.why === 'empty' ? '' : TEKST[hit.why];
      answer.className = 'small rabatt-svar';
    }
    apply.addEventListener('click', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });
    // A Stripe link that is opened before a code expires still works; after the last moment the page goes back to the
    // full price the next time the button is pressed.
    pay.addEventListener('click', function () {
      if (box.dataset.code && !lookUp(box.dataset.code, new Date()).ok) run();
    });
    var given = new URLSearchParams(location.search).get('code');
    if (given) {
      box.open = true;
      input.value = normalise(given).slice(0, 40);
      run();
    }
  })();
}
