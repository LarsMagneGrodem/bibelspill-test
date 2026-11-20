/* global URLSearchParams, location, atob */
// First-party buy attribution (Lars via Markedsføring 20.11 «fiks resten»): utm_source, utm_medium, utm_campaign,
// ?fra= and the referring host. No cookies, no third-party tools. Values live in the URL and, for the same tab
// session only, in sessionStorage so a click from the front page to the buy page still carries them.
const KEY = 'lukas-kilde-v1';
const MAX = 64;
const TOKEN = /^[a-zA-Z0-9._-]{1,64}$/;
const HOST = /^[a-z0-9.-]{1,64}$/;
const OWN = /^(?:www\.)?(?:reisenmedlukas\.no|thejourneywithluke\.com|larsmagnegrodem\.github\.io)$/;

export function clean(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim().slice(0, MAX);
  return TOKEN.test(v) ? v : '';
}

export function referrerHost(referrer) {
  if (typeof referrer !== 'string' || !referrer) return '';
  try {
    const h = new URL(referrer).hostname.toLowerCase().slice(0, MAX);
    if (!h || OWN.test(h) || !HOST.test(h)) return '';
    return h;
  } catch {
    return '';
  }
}

/** Read attribution from a query string (and optional referrer), merge with what this tab already stored. */
export function readAttribution(search, referrer, storage) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  let prev;
  try {
    prev = JSON.parse((storage && storage.getItem(KEY)) || '{}') || {};
  } catch {
    prev = {};
  }
  const out = {
    utm_source: clean(params.get('utm_source') || '') || clean(prev.utm_source) || '',
    utm_medium: clean(params.get('utm_medium') || '') || clean(prev.utm_medium) || '',
    utm_campaign: clean(params.get('utm_campaign') || '') || clean(prev.utm_campaign) || '',
    fra: clean(params.get('fra') || '') || clean(prev.fra) || '',
    referrer_host: referrerHost(referrer) || (typeof prev.referrer_host === 'string' && HOST.test(prev.referrer_host) && !OWN.test(prev.referrer_host) ? prev.referrer_host : '') || '',
  };
  return out;
}

export function saveAttribution(attr, storage) {
  if (!storage || !attr) return;
  const slim = {
    utm_source: attr.utm_source || '',
    utm_medium: attr.utm_medium || '',
    utm_campaign: attr.utm_campaign || '',
    fra: attr.fra || '',
    referrer_host: attr.referrer_host || '',
  };
  if (!slim.utm_source && !slim.utm_medium && !slim.utm_campaign && !slim.fra && !slim.referrer_host) return;
  try {
    storage.setItem(KEY, JSON.stringify(slim));
  } catch { /* private mode */ }
}

/** The plain form «s=…|m=…|c=…|f=…|r=…». */
function plainReference(attr) {
  if (!attr) return '';
  const parts = [];
  if (attr.utm_source) parts.push(`s=${attr.utm_source}`);
  if (attr.utm_medium) parts.push(`m=${attr.utm_medium}`);
  if (attr.utm_campaign) parts.push(`c=${attr.utm_campaign}`);
  if (attr.fra) parts.push(`f=${attr.fra}`);
  if (attr.referrer_host) parts.push(`r=${attr.referrer_host}`);
  return parts.join('|');
}

/** Stripe Payment Link client_reference_id. Stripe keeps it only when it is letters, digits, «-» and «_» (max 200) and
 *  drops anything else without a word (checked live 20.11), so the plain form goes as «k1» + base64url (kasse r61). */
export function stripeClientReference(attr) {
  const plain = plainReference(attr).slice(0, 147);
  if (!plain) return '';
  return 'k1' + btoa(plain).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseStripeClientReference(raw) {
  const out = { utm_source: '', utm_medium: '', utm_campaign: '', fra: '', referrer_host: '' };
  if (typeof raw !== 'string' || !raw) return out;
  const k1 = /^k1([A-Za-z0-9_-]{1,198})$/.exec(raw);
  if (k1) {
    try {
      const b64 = k1[1].replace(/-/g, '+').replace(/_/g, '/');
      raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    } catch {
      return out;
    }
  }
  for (const part of raw.slice(0, 200).split('|')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i);
    const v = part.slice(i + 1);
    if (k === 's') out.utm_source = clean(v);
    else if (k === 'm') out.utm_medium = clean(v);
    else if (k === 'c') out.utm_campaign = clean(v);
    else if (k === 'f') out.fra = clean(v);
    else if (k === 'r') {
      const h = String(v).toLowerCase().slice(0, MAX);
      if (HOST.test(h) && !OWN.test(h)) out.referrer_host = h;
    }
  }
  return out;
}

/** Body fields to send with a Norwegian order (only non-empty). */
export function orderFields(attr) {
  const body = {};
  if (!attr) return body;
  if (attr.utm_source) body.utm_source = attr.utm_source;
  if (attr.utm_medium) body.utm_medium = attr.utm_medium;
  if (attr.utm_campaign) body.utm_campaign = attr.utm_campaign;
  if (attr.fra) body.fra = attr.fra;
  if (attr.referrer_host) body.referrer = attr.referrer_host;
  return body;
}

/** Append client_reference_id to a Stripe Payment Link URL when attribution is present. */
export function withClientReference(url, attr) {
  const ref = stripeClientReference(attr);
  if (!url || !ref) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('client_reference_id', ref);
    return u.href;
  } catch {
    return url;
  }
}

if (typeof document !== 'undefined' && typeof sessionStorage !== 'undefined' && typeof location !== 'undefined') {
  const attr = readAttribution(location.search, document.referrer, sessionStorage);
  saveAttribution(attr, sessionStorage);
}
