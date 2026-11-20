/* global document, location, sessionStorage, URLSearchParams */
// The English checkout: the chosen code picks its Stripe Payment Link (Managed Payments; Stripe sells, the worker's
// /stripe/webhook books the code). ?valg=familie picks the family code, as on the Norwegian page.
// Salg 20.11: first-party utm/?fra=/referrer ride on Stripe's client_reference_id (no cookies).
import { readAttribution, saveAttribution, withClientReference } from '../landing/kilde.mjs';

const attr = readAttribution(location.search, document.referrer, sessionStorage);
saveAttribution(attr, sessionStorage);

const pay = document.getElementById('betal');
const family = document.querySelector('input[name="product"][value="family"]');
const params = new URLSearchParams(location.search);
if (params.get('valg') === 'familie' && family) family.checked = true;
// ?gave=1 (the gift's own way from the front page) opens «Buying it as a gift?». Nothing is sent or stored.
const gift = document.getElementById('gave-mer');
if (params.get('gave') === '1' && gift) gift.open = true;

function pick() {
  const chosen = document.querySelector('input[name="product"]:checked');
  const base = chosen && chosen.value === 'family' ? pay.dataset.family : pay.dataset.personal;
  pay.href = withClientReference(base, attr);
}

document.querySelectorAll('input[name="product"]').forEach((r) => { r.addEventListener('change', pick); });
pick();

document.querySelectorAll('.epost').forEach((s) => {
  const e = s.dataset.u + '\u0040' + s.dataset.d;
  const a = document.createElement('a');
  a.href = 'mail' + 'to:' + e;
  a.textContent = e;
  s.replaceWith(a);
});
