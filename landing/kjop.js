/* global URLSearchParams, location, window, performance, AbortSignal, AbortController, DOMException, File */
// The buy page: an e-mail and the consent go to the sale's worker, which answers with the code and how to pay.
// The gift card is drawn here in the browser (gavekort-nett.mjs) after the purchase; the name on it never leaves the page.
// Lars 11.11: no card to download before buying, so no blank card here.
import { PAGES, cardPdf } from './gavekort-nett.mjs';
import { qrCode } from './qr.mjs';

const $ = (id) => document.getElementById(id);
const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content.trim() ?? '';
// The worker's address, with or without /order; the sale is open only when kasse-apen says ja.
const base = meta('kasse-api').replace(/\/+$/, '');
const api = meta('kasse-apen') === 'ja' && base ? (base.endsWith('/order') ? base : `${base}/order`) : '';
const KEPT = 'kasse:siste';
const PRODUCT_LINE = { personal: 'Personlig kode, for én person.', family: 'Familiekode, for hele husstanden.' };
const ERRORS = {
  email: 'Sjekk e-postadressen.',
  consent: 'Kryss av i boksen før du kjøper.',
  product: 'Velg personlig kode eller familiekode.',
  'slow-down': 'Vent et minutt og prøv igjen.',
  // Sikkerhet 12.11 (B3): the worker takes at most three orders to one address a day.
  'email-many': 'Det er alt bestilt flere koder til denne e-postadressen i dag. Skriv til oss hvis du trenger flere.',
  busy: 'Mange kjøper akkurat nå. Prøv igjen litt senere.',
  // feilliste M2: the worker's own refusals get their own words; «network» only when the call itself fails.
  origin: 'Kjøpet må gjøres på reisenmedlukas.no. Last siden på nytt og prøv igjen.',
  misconfigured: 'Kassen er stengt en kort stund. Prøv igjen senere, eller skriv til oss.',
  body: 'Noe gikk galt med skjemaet. Last siden på nytt og prøv igjen.',
  server: 'Kassen svarte ikke som den skulle. Prøv igjen om litt, eller skriv til oss.',
  network: 'Fikk ikke kontakt. Sjekk at du er på nett, og prøv igjen.',
  // G12: the worker took more than 15 s. The order may have been made all the same, so: do not buy twice.
  timeout: 'Kassen svarer ikke nå. Har du fått en e-post med kode, ikke kjøp på nytt. Prøv igjen om litt, eller skriv til oss.',
};
const ORDER_TIMEOUT_MS = 15000;

// G12: an abort signal after `ms`; AbortSignal.timeout where there is one, else a timer.
function timeoutSignal(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), ms);
    return controller.signal;
  } catch {
    return undefined;
  }
}

// G6: Safari before iOS 16.4 cannot run the game (a lookbehind in its code), though this page works. Say so before buying.
function oldSafari() {
  try { new RegExp('(?<=a)b'); return false; } catch { return true; }
}
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// The web card (gavekort-nett.mjs): its two pictures come from this site; the name stays in the browser.
// G13: the pictures are fetched as soon as the receipt shows, so the tap can build the PDF at once and hand it to the
// share sheet while the tap still counts (iPhone: «Skriv ut», «Arkiver i Filer», Mail, AirDrop). Elsewhere it downloads.
let pictures = null;
function fetchPictures(order) {
  const get = async (path) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(String(res.status));
    return new Uint8Array(await res.arrayBuffer());
  };
  pictures = Promise.all([get(PAGES.utside), get(PAGES[order.product])]);
  pictures.catch(() => { pictures = null; });
  return pictures;
}

async function webCard(order) {
  $('kortfeil').textContent = '';
  $('gavekort').disabled = true;
  try {
    const [utside, innside] = await (pictures ?? fetchPictures(order));
    const pdf = cardPdf({ code: order.code, product: order.product, name: $('navn').value }, { utside, [order.product]: innside });
    const name = `gavekort-${order.code}.pdf`;
    let file = null;
    try { file = new File([pdf], name, { type: 'application/pdf' }); } catch { /* old browser */ }
    if (IOS && file && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: 'Gavekort – Reisen med Lukas' }).catch(() => {});
    } else {
      download(pdf, name);
      if (IOS) $('filer').hidden = false;
    }
  } catch {
    pictures = null;
    $('kortfeil').textContent = 'Fikk ikke laget gavekortet. Sjekk at du er på nett, og prøv igjen.';
  } finally {
    $('gavekort').disabled = false;
  }
}

// G3: a QR code with the code, for the child's iPad: the camera opens the link in the default browser, which unlocks there.
function drawQr(code) {
  const box = $('qr-boks');
  const holder = $('qr');
  holder.replaceChildren();
  const symbol = qrCode(`https://reisenmedlukas.no/spill/?kode=${encodeURIComponent(code)}&lang=nb`);
  if (!symbol) { box.hidden = true; return; }
  const n = symbol.dark.length;
  const quiet = 4;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n + quiet * 2} ${n + quiet * 2}`);
  svg.setAttribute('width', '180');
  svg.setAttribute('height', '180');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `QR-kode som låser opp spillet med koden ${code}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', String(n + quiet * 2));
  bg.setAttribute('height', String(n + quiet * 2));
  bg.setAttribute('fill', '#ffffff');
  svg.append(bg);
  let d = '';
  symbol.dark.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#000000');
  svg.append(path);
  holder.append(svg);
  box.hidden = false;
}

function show(order) {
  $('bestill').hidden = true;
  $('kvittering').hidden = false;
  $('kode').textContent = order.code;
  $('produkt').textContent = PRODUCT_LINE[order.product] ?? '';
  $('husstand').hidden = order.product !== 'family';
  $('belop').textContent = String(order.amount);
  $('belop2').textContent = String(order.amount);
  $('frist').textContent = order.dueText;
  $('konto').textContent = order.account;
  $('ordre').textContent = order.orderNo;
  // 'sending': the worker sends the mail after answering (ctx.waitUntil); 'sent' comes from Vipps' status check.
  $('sendt').hidden = order.receipt !== 'sent';
  $('sender').hidden = order.receipt !== 'sending';
  $('senere').hidden = order.receipt === 'sent' || order.receipt === 'sending';
  $('gavekort').onclick = () => void webCard(order);
  // feilliste M3: the address the receipt goes to, so a typo shows now. feilliste M4: one tap into the game, unlocked.
  $('til').hidden = !order.email;
  $('til-epost').textContent = order.email ?? '';
  // The buy page is Norwegian: the game opens in Norwegian, also on a phone set to English (?lang=en is for English pages).
  $('spill').href = `../spill/?kode=${encodeURIComponent(order.code)}&lang=nb`;
  $('filer').hidden = true;
  drawQr(order.code);
  pictures = null;
  void fetchPictures(order).catch(() => {});
  $('kvittering').focus();
}

// Copy buttons for what goes into the bank app: the code, the account number (digits only, which every bank takes),
// the amount and the order number. Without a clipboard (old browser, no https) the button says nothing has happened.
for (const button of document.querySelectorAll('[data-kopier]')) {
  button.addEventListener('click', async () => {
    const id = button.dataset.kopier;
    const text = $(id).textContent.trim();
    const value = id === 'konto' ? text.replace(/\D/g, '') : text;
    try {
      await navigator.clipboard.writeText(value);
      $('kopiert').textContent = 'Kopiert!';
    } catch {
      $('kopiert').textContent = 'Fikk ikke kopiert. Merk teksten og kopier den selv.';
    }
  });
}

// A link from the sales page with ?valg=familie picks the family code.
const choice = new URLSearchParams(location.search).get('valg');
function pickProduct() {
  const value = choice === 'familie' ? 'family' : 'personal';
  const input = document.querySelector(`input[name="product"][value="${value}"]`);
  if (input) input.checked = true;
}
pickProduct();

function readKept() {
  try {
    const kept = JSON.parse(sessionStorage.getItem(KEPT) ?? 'null');
    return kept?.code ? kept : null;
  } catch {
    return null;
  }
}

// The form again, for one more code (feilliste H1). The e-mail stays; the tick box and the name on the card do not.
function showForm(kept) {
  $('kvittering').hidden = true;
  $('bestill').hidden = false;
  $('feil').textContent = '';
  $('kopiert').textContent = '';
  $('kortfeil').textContent = '';
  $('samtykke').checked = false;
  $('navn').value = '';
  pickProduct();
  $('siste').hidden = !kept;
  if (kept?.email && !$('epost').value) $('epost').value = kept.email;
  if (kept) {
    $('siste-kode').textContent = kept.code;
    $('vis-siste').onclick = () => show(kept);
  }
}

$('ny').addEventListener('click', () => {
  showForm(readKept());
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('input[name="product"]:checked')?.focus({ preventScroll: true });
});

// The last order stays for this tab, so a reload (or the back button) does not lose the code. A fresh visit from a
// link, such as «Kjøp familiekode» on the sales page, opens the form, with a button back to the last purchase.
const kept = readKept();
if (kept) {
  const nav = performance.getEntriesByType?.('navigation')[0]?.type;
  if ((nav === 'reload' || nav === 'back_forward') && !choice) show(kept);
  else showForm(kept);
}

if (!api) {
  $('stengt').hidden = false;
  $('skjema').hidden = true;
}
if (oldSafari()) $('gammel-ios').hidden = false;

$('skjema').addEventListener('submit', async (event) => {
  event.preventDefault();
  const say = (key) => { $('feil').textContent = ERRORS[key] ?? ERRORS.network; };
  const email = $('epost').value.trim();
  if (!$('epost').checkValidity() || !email) return say('email');
  const product = document.querySelector('input[name="product"]:checked')?.value;
  if (!product) return say('product');
  if (!$('samtykke').checked) return say('consent');
  $('feil').textContent = '';
  $('kjop').disabled = true;
  try {
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, product, consent: true, website: $('nettsted').value }),
      signal: timeoutSignal(ORDER_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return say(Object.hasOwn(ERRORS, data.error ?? '') ? data.error : 'server');
    const bought = { ...data, email };
    try { sessionStorage.setItem(KEPT, JSON.stringify(bought)); } catch { /* private mode */ }
    show(bought);
  } catch (error) {
    say(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    $('kjop').disabled = false;
  }
});

// The e-mail address is put together here, so robots that read the HTML do not find it.
for (const span of document.querySelectorAll('.epost')) {
  const address = `${span.dataset.u}\u0040${span.dataset.d}`;
  const a = document.createElement('a');
  a.href = `mail${'to'}:${address}`;
  a.textContent = address;
  span.replaceWith(a);
}
