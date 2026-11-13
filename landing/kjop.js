/* global URLSearchParams, location, window, performance, AbortSignal, AbortController, DOMException, File */
// The buy page. Vipps is first (Lars 13.11 01:14). Bank transfer on trust (Lars 12.11 16:24) stays as the
// less prominent choice: /order/start, then «Jeg har betalt» and the consent, /order/confirm. No deadline.
// The bank step is one block (#bank). Vipps posts to /vipps/start and sends the buyer to Vipps.
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
// The order waiting for «Jeg har betalt», so a reload on the pay step keeps its order number.
const PENDING = 'kasse:betal';
const PRODUCT_LINE = { personal: 'Personlig kode, for én person.', family: 'Familiekode, for hele husstanden.' };
const ERRORS = {
  email: 'Sjekk e-postadressen.',
  consent: 'Kryss av i boksen før du kjøper.',
  paid: 'Kryss av for at du har betalt.',
  order: 'Fant ikke bestillingen. Trykk «Tilbake» og prøv igjen, eller skriv til oss.',
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
  $('betal').hidden = true;
  $('kvittering').hidden = false;
  $('kode').textContent = order.code;
  $('produkt').textContent = PRODUCT_LINE[order.product] ?? '';
  $('husstand').hidden = order.product !== 'family';
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

// The bank step: what goes into the bank app, then the two tick boxes.
function showPay(pending) {
  $('bestill').hidden = true;
  $('kvittering').hidden = true;
  $('betal').hidden = false;
  $('belop').textContent = String(pending.amount);
  $('belop2').textContent = String(pending.amount);
  $('konto').textContent = pending.account;
  $('ordre').textContent = pending.orderNo;
  $('betalt').checked = false;
  $('samtykke').checked = false;
  if ($('samtykke-bestill')) $('samtykke-bestill').checked = false;
  $('feil-betal').textContent = '';
  $('kopiert-betal').textContent = '';
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('betal').focus({ preventScroll: true });
}

// Live-sjekk 12.11 (del 13 H2): the order is also kept in this variable, so «Få koden» works when sessionStorage is
// blocked (private mode, settings) and throws or forgets. sessionStorage is still what brings it back after a reload.
const held = new Map();
const keep = (key, value) => {
  if (value) held.set(key, value);
  else held.delete(key);
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* private mode */ }
};
const stored = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null') ?? held.get(key) ?? null;
  } catch {
    return held.get(key) ?? null;
  }
};
const readPending = () => {
  const pending = stored(PENDING);
  return pending?.orderNo && pending?.key ? pending : null;
};

// One call to the worker: resolves its answer, or throws the key of the words to show.
async function ask(path, body) {
  let res;
  try {
    res = await fetch(`${api}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: timeoutSignal(ORDER_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network', { cause: error });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(Object.hasOwn(ERRORS, data.error ?? '') ? data.error : 'server');
  return data;
}

// Copy buttons for what goes into the bank app: the code, the account number (digits only, which every bank takes),
// the amount and the order number. Without a clipboard (old browser, no https) the button says nothing has happened.
for (const button of document.querySelectorAll('[data-kopier]')) {
  button.addEventListener('click', async () => {
    const id = button.dataset.kopier;
    const text = $(id).textContent.trim();
    const value = id === 'konto' ? text.replace(/\D/g, '') : text;
    const status = button.closest('#betal') ? 'kopiert-betal' : 'kopiert';
    try {
      await navigator.clipboard.writeText(value);
      $(status).textContent = 'Kopiert!';
    } catch {
      $(status).textContent = 'Fikk ikke kopiert. Merk teksten og kopier den selv.';
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
  const kept = stored(KEPT);
  return kept?.code ? kept : null;
}

// The form again, for one more code (feilliste H1). The e-mail stays; the tick box and the name on the card do not.
function showForm(kept) {
  $('kvittering').hidden = true;
  $('betal').hidden = true;
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
  keep(PENDING, null);
  showForm(readKept());
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('input[name="product"]:checked')?.focus({ preventScroll: true });
});

// The last order stays for this tab, so a reload (or the back button) does not lose the code. A fresh visit from a
// link, such as «Kjøp familiekode» on the sales page, opens the form, with a button back to the last purchase.
const kept = readKept();
const pending = readPending();
const nav = performance.getEntriesByType?.('navigation')[0]?.type;
const reloaded = nav === 'reload' || nav === 'back_forward';
const again = reloaded && !choice;
// Live-sjekk 12.11: an order waiting for «Jeg har betalt» comes back after a reload whatever the address says (the
// family link has ?valg=familie, and a phone reloads the tab while the buyer is in the bank app), and on a new visit in
// the same tab unless the link asks for the other product. «Tilbake» still starts over.
const wanted = choice === 'familie' ? 'family' : null;
if (pending && (reloaded || !wanted || pending.product === wanted)) showPay(pending);
else if (kept) {
  if (again) show(kept);
  else showForm(kept);
}

if (!api) {
  $('stengt').hidden = false;
  $('skjema').hidden = true;
}
if (oldSafari()) $('gammel-ios').hidden = false;

// Shared checks for the first step (product and e-mail).
function readOrderFields(say) {
  const email = $('epost').value.trim();
  const bad = !$('epost').checkValidity() || !email;
  // Del 13 L9: a screen reader hears that the field is wrong, not only the message under it.
  $('epost').setAttribute('aria-invalid', String(bad));
  if (bad) { say('email'); return null; }
  const product = document.querySelector('input[name="product"]:checked')?.value;
  if (!product) { say('product'); return null; }
  return { email, product, website: $('nettsted').value };
}

$('epost').addEventListener('input', () => $('epost').removeAttribute('aria-invalid'));

// Del 13 L1: a button waiting for the worker says so to a screen reader too (the look is in kjop.css).
const busy = (id, on) => {
  $(id).disabled = on;
  if (on) $(id).setAttribute('aria-busy', 'true');
  else $(id).removeAttribute('aria-busy');
};

// Del 13 L2: «Tilbake» on the bank step keeps the waiting order for this page, so going back and on again with the
// same e-mail and product shows the same order instead of starting a new one (each counts against the daily limits).
let backOrder = null;

// Step 1, main: consent and «Betal med Vipps»; the worker answers with Vipps's page.
$('skjema').addEventListener('submit', async (event) => {
  event.preventDefault();
  const say = (key) => { $('feil').textContent = ERRORS[key] ?? ERRORS.network; };
  const fields = readOrderFields(say);
  if (!fields) return;
  if (!$('samtykke-bestill').checked) return say('consent');
  if (!api) return say('misconfigured');
  $('feil').textContent = '';
  busy('kjop-vipps', true);
  try {
    let res;
    try {
      res = await fetch(`${base}/vipps/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fields.email, product: fields.product, website: fields.website, consent: true }),
        signal: timeoutSignal(ORDER_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network', { cause: error });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(Object.hasOwn(ERRORS, data.error ?? '') ? data.error : 'server');
    const url = typeof data.redirectUrl === 'string' ? data.redirectUrl : '';
    if (!url.startsWith('https://')) throw new Error('server');
    location.href = url;
  } catch (error) {
    say(error.message);
  } finally {
    busy('kjop-vipps', false);
  }
});

// The less prominent choice: bank transfer on trust, same as before.
$('kjop').addEventListener('click', async () => {
  const say = (key) => { $('feil').textContent = ERRORS[key] ?? ERRORS.network; };
  const fields = readOrderFields(say);
  if (!fields) return;
  $('feil').textContent = '';
  if (backOrder && backOrder.email === fields.email && backOrder.product === fields.product) {
    keep(PENDING, backOrder);
    showPay(backOrder);
    return;
  }
  busy('kjop', true);
  try {
    const data = await ask('/start', { email: fields.email, product: fields.product, website: fields.website });
    const next = { orderNo: data.orderNo, key: data.key, amount: data.amount, account: data.account, product: data.product, email: fields.email };
    backOrder = null;
    keep(PENDING, next);
    showPay(next);
  } catch (error) {
    say(error.message);
  } finally {
    busy('kjop', false);
  }
});

// Step 2: «Jeg har betalt» and the consent; the worker answers with the code.
$('fa-kode').addEventListener('click', async () => {
  const say = (key) => { $('feil-betal').textContent = ERRORS[key] ?? ERRORS.network; };
  const order = readPending();
  if (!order) return say('order');
  if (!$('betalt').checked) return say('paid');
  if (!$('samtykke').checked) return say('consent');
  $('feil-betal').textContent = '';
  busy('fa-kode', true);
  try {
    const data = await ask('/confirm', { orderNo: order.orderNo, key: order.key, paid: true, consent: true });
    const bought = { ...data, email: order.email };
    keep(KEPT, bought);
    keep(PENDING, null);
    backOrder = null;
    show(bought);
  } catch (error) {
    say(error.message);
  } finally {
    busy('fa-kode', false);
  }
});

$('tilbake').addEventListener('click', () => {
  backOrder = readPending();
  keep(PENDING, null);
  showForm(readKept());
  window.scrollTo({ top: 0, behavior: 'instant' });
});

// The e-mail address is put together here, so robots that read the HTML do not find it.
for (const span of document.querySelectorAll('.epost')) {
  const address = `${span.dataset.u}\u0040${span.dataset.d}`;
  const a = document.createElement('a');
  a.href = `mail${'to'}:${address}`;
  a.textContent = address;
  span.replaceWith(a);
}
