/* global document, navigator, location, URLSearchParams, sessionStorage */
// «Have a discount code?» on the English buy page (Lars 18.11 19:03 «gi gass»). Stripe turns down promotion codes on
// Payment Links with Managed Payments, so a known code sends the buyer to its own Payment Links instead, where the
// discount is already in the price (kasse r50, STRIPE_CAMPAIGNS). Matching is here, in the page, and case-insensitive;
// the checkout itself only accepts each discounted amount on its own link. Nothing is sent or stored. ?code=CHESSLUKE
// fills the field in and applies it. A code works here from its first moment (validFrom, if it has one) to its last
// (validUntil), both in Oslo time; the Stripe links are switched on and off at those times as well.
import { languagesOf, plainDollar, timeZoneOf, usLabel, visitorCurrency } from './valuta.js';
import { readAttribution, saveAttribution, withClientReference } from '../landing/kilde.mjs';

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
  // Lars 19.11 01:24 «ADVENT20 og TRY1 hvis den første virker»: public, 20 %, Friday 28 to Sunday 30 November (Oslo).
  // Not combined with CHESSLUKE: one code in the field, and each code has its own links with no code field.
  ADVENT20: {
    percent: 20,
    validFrom: '2026-11-28T00:00:00.000+01:00',
    validUntil: '2026-11-30T23:59:59.999+01:00',
    notYet: 'This code works 28–30 November.',
    personal: 'https://buy.stripe.com/9B628taqR3cJgho66HgnK04',
    family: 'https://buy.stripe.com/28EaEZ56x28FaX42UvgnK05',
    prices: {
      personal: { eur: '€19.99', gbp: '£15.99', usd: '$19.99' },
      family: { eur: '€39.99', gbp: '£31.99', usd: '$39.99' },
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

/** { ok: true, code, offer } or { ok: false, why: 'unknown' | 'expired' | 'empty' | 'notYet', code?, offer? }. */
export function lookUp(code, now, list) {
  var codes = list || KODER;
  var key = normalise(code);
  if (!key) return { ok: false, why: 'empty' };
  if (!Object.prototype.hasOwnProperty.call(codes, key)) return { ok: false, why: 'unknown' };
  var offer = codes[key];
  var t = now instanceof Date ? now.getTime() : Number(now);
  if (offer.validFrom && !(Date.parse(offer.validFrom) <= t)) return { ok: false, why: 'notYet', code: key, offer: offer };
  var end = Date.parse(offer.validUntil);
  if (!(end >= t)) return { ok: false, why: 'expired' };
  return { ok: true, code: key, offer: offer };
}

/** True when the field holds a code that has not been applied yet (typed, but «Apply» or Enter was not pressed). */
export function typedButNotApplied(typed, applied) {
  var key = normalise(typed);
  return !!key && key !== (applied || '');
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
    var kilde = readAttribution(location.search, document.referrer, sessionStorage);
    saveAttribution(kilde, sessionStorage);
    function links(personal, family) {
      pay.dataset.personal = personal;
      pay.dataset.family = family;
      var chosen = document.querySelector('input[name="product"]:checked');
      var base = chosen && chosen.value === 'family' ? family : personal;
      pay.href = withClientReference(base, kilde);
    }
    function run() {
      var hit = lookUp(input.value, new Date());
      if (hit.ok) {
        links(hit.offer.personal, hit.offer.family);
        input.value = hit.code;
        var said = appliedText(hit.offer, currency);
        answer.textContent = plainDollar(languagesOf(navigator), timeZoneOf()) ? said : usLabel(said);
        answer.className = 'small rabatt-svar rabatt-svar--ok';
        box.dataset.code = hit.code;
        return;
      }
      links(full.personal, full.family);
      delete box.dataset.code;
      answer.textContent = hit.why === 'empty' ? '' : hit.why === 'notYet' ? hit.offer.notYet || TEKST.unknown : TEKST[hit.why];
      answer.className = 'small rabatt-svar';
    }
    apply.addEventListener('click', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });
    // A Stripe link that is opened before a code expires still works; after the last moment the page goes back to the
    // full price the next time the button is pressed.
    // A code that is typed but not applied is applied here, before the link opens (Stripe has no code field on these
    // links, so the discount would be lost). A typed code that does not work stops the button and shows why, as on
    // the Norwegian page; the buyer can empty the field and go on at the full price.
    pay.addEventListener('click', function (e) {
      if (typedButNotApplied(input.value, box.dataset.code)) {
        run();
        if (!box.dataset.code) {
          e.preventDefault();
          box.open = true;
          input.focus({ preventScroll: true });
          if (answer.scrollIntoView) answer.scrollIntoView({ block: 'center' });
        }
        return;
      }
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
