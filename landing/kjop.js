/* global URLSearchParams, location, window, performance, AbortSignal, AbortController, DOMException, File, localStorage */
// The buy page. Vipps is first (Lars 13.11 01:14). Bank transfer on trust (Lars 12.11 16:24) stays as the
// less prominent choice: the consent on step 1, /order/start (r38, Lars 13.11 10:51: the code and the receipt come with
// the order), then the pay step. «Jeg har betalt» is still there, but never stops the code; /order/confirm writes it down.
// An order started on an older page (no code yet) still asks the consent on the pay step. No deadline.
// The bank step is one block (#bank). Vipps posts to /vipps/start and sends the buyer to Vipps.
// The gift card is drawn here in the browser (gavekort-nett.mjs) after the purchase; the names on it never leave the page.
// Lars 11.11: no card to download before buying, so no blank card here.
import { PAGES, PAGES_24, cardPdf } from './gavekort-nett.mjs';
import { qrCode } from './qr.mjs';
// Natt 15.–16.11: the line that changes with the date (filled on import), and the calendar file on the receipt.
import './dato.mjs';
import { YEAR, clock, remindDoors, remindersIcs, saveIcs } from './kalender.mjs';

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
  // Sikkerhet 12.11 (B3): the worker takes at most ten orders to one address a day (SS-L11).
  'email-many': 'Det er bestilt mange koder til denne e-postadressen i dag. Trenger du flere, skriv til lars.magne@outlook.com.',
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
// Lars 18.11 21:12: two cards to choose from, the Advent card (#gavekort) and the red Christmas card «Et spill med 24
// brett» (#gavekort24), the same code on both. Each has its own pictures, fetched once.
const CARDS = { advent: { pages: PAGES, button: 'gavekort', file: (code) => `gavekort-${code}.pdf` }, '24-brett': { pages: PAGES_24, button: 'gavekort24', file: (code) => `gavekort-24-brett-${code}.pdf` } };
const pictures = {};
function fetchPictures(order, variant = 'advent') {
  const get = async (path) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(String(res.status));
    return new Uint8Array(await res.arrayBuffer());
  };
  const { pages } = CARDS[variant];
  const got = Promise.all([get(pages.utside), get(pages[order.product])]);
  pictures[variant] = got;
  got.catch(() => { pictures[variant] = null; });
  return got;
}

async function webCard(order, variant = 'advent') {
  const card = CARDS[variant];
  $('kortfeil').textContent = '';
  $(card.button).disabled = true;
  try {
    const [utside, innside] = await (pictures[variant] ?? fetchPictures(order, variant));
    const pdf = cardPdf({ code: order.code, product: order.product, variant, name: $('navn').value, from: $('fra').value }, { utside, [order.product]: innside });
    const name = card.file(order.code);
    let file = null;
    try { file = new File([pdf], name, { type: 'application/pdf' }); } catch { /* old browser */ }
    if (IOS && file && navigator.canShare?.({ files: [file] })) {
      // SS-L2: a share sheet the phone refuses (not one the buyer closed) falls back to the download and its hint.
      navigator.share({ files: [file], title: 'Gavekort – Reisen med Lukas' }).catch((error) => {
        if (error?.name === 'AbortError') return;
        download(pdf, name);
        $('filer').hidden = false;
      });
    } else {
      download(pdf, name);
      if (IOS) $('filer').hidden = false;
    }
  } catch {
    pictures[variant] = null;
    $('kortfeil').textContent = 'Fikk ikke laget gavekortet. Sjekk at du er på nett, og prøv igjen.';
  } finally {
    $(card.button).disabled = false;
  }
}

// The link that unlocks the game where it is opened (the QR code and «Send lenka» hold the same).
const unlockLink = (code) => `https://reisenmedlukas.no/spill/?kode=${encodeURIComponent(code)}&lang=nb`;
const shareText = (code) => `Her er koden til Reisen med Lukas: ${code}. Trykk på lenka på enheten barnet skal spille på, så låses spillet opp: ${unlockLink(code)}`;
// F01: Messages opens with the text filled in. iOS reads the body after «sms:&», Android after «sms:?».
const smsHref = (text, ios) => `sms:${ios ? '&' : '?'}body=${encodeURIComponent(text)}`;

async function copyLink(link) {
  try {
    await navigator.clipboard.writeText(link);
    $('delt').textContent = 'Kopiert!';
  } catch {
    $('delt').textContent = `Fikk ikke kopiert. Her er lenka: ${link}`;
  }
}

// F01 (Lars 15.11): the buyer seldom holds the child's phone. The phone's share sheet (it has Messages), a ready SMS on
// a phone, and «Kopier lenka». No e-mail is needed on the child's side. An app's own browser on the child's phone gets
// «Åpne i Safari først» in the game (in-app.ts).
function offerLink(code) {
  const [link, text] = [unlockLink(code), shareText(code)];
  $('delt').textContent = '';
  $('send-lenke').hidden = typeof navigator.share !== 'function';
  $('send-lenke').onclick = () => navigator.share({ text }).catch((error) => {
    if (error?.name !== 'AbortError') void copyLink(link);
  });
  $('send-sms').hidden = !(IOS || /Android/i.test(navigator.userAgent));
  $('send-sms').href = smsHref(text, IOS);
  $('kopier-lenke').onclick = () => void copyLink(link);
}

// «Gi luke 1 til en familie»: the buyer sends a ready text from their own phone, grown-up to grown-up, with no reward.
// The phone's share sheet where there is one, a ready SMS on a phone, and «Kopier teksten». Nothing is sent from us.
function offerTip() {
  const text = $('tips-tekst').textContent.trim();
  const say = (words) => { $('tips-status').textContent = words; };
  $('tips-status').textContent = '';
  $('tips-del-knapp').hidden = typeof navigator.share !== 'function';
  $('tips-del-knapp').onclick = () => navigator.share({ text }).catch(() => {});
  $('tips-sms').hidden = !(IOS || /Android/i.test(navigator.userAgent));
  $('tips-sms').href = smsHref(text, IOS);
  $('tips-kopier').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      say('Kopiert!');
    } catch {
      say('Fikk ikke kopiert. Merk teksten og kopier den selv.');
    }
  };
}

// «Legg lukene i kalenderen»: one reminder a day at the chosen time, the game's own file (kalender.mjs), made here.
// Nothing is stored or sent. After Christmas Eve there are no doors left to remind of, and the part goes away.
function offerCalendar() {
  const doors = (time) => remindDoors(new Date(), YEAR, clock(time));
  $('kalender-del').hidden = !doors($('kalender-tid').value);
  $('kalender-status').textContent = '';
  $('kalender').onclick = () => {
    const time = $('kalender-tid').value;
    const left = doors(time);
    if (!left) { $('kalender-status').textContent = 'Alle lukene har åpnet seg i år, så det er ingen flere å minne om.'; return; }
    saveIcs(remindersIcs({
      year: YEAR, ...left, time, now: new Date(), url: 'https://reisenmedlukas.no/spill/',
      title: (door) => `Reisen med Lukas: luke ${door}`, description: 'Dagens luke er åpen.',
    }), 'reisen-med-lukas.ics');
    $('kalender-status').textContent = 'Fila er lastet ned. Åpne den for å legge påminnelsene i kalenderen.';
  };
}

// G3: a QR code with the code, for the child's phone or tablet: the camera opens the link in the default browser, which unlocks there.
function drawQr(code) {
  const box = $('qr-boks');
  const holder = $('qr');
  holder.replaceChildren();
  const symbol = qrCode(unlockLink(code));
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
  $('gavekort24').onclick = () => void webCard(order, '24-brett');
  // feilliste M3: the address the receipt goes to, so a typo shows now. feilliste M4: one tap into the game, unlocked.
  $('til').hidden = !order.email;
  $('til-epost').textContent = order.email ?? '';
  // The buy page is Norwegian: the game opens in Norwegian, also on a phone set to English (?lang=en is for English pages).
  $('spill').href = `../spill/?kode=${encodeURIComponent(order.code)}&lang=nb`;
  $('filer').hidden = true;
  drawQr(order.code);
  offerLink(order.code);
  // Bought as a gift (the tick box on the form, never sent to the worker): the gift card first.
  $('gave-forst').hidden = !order.gave;
  offerCalendar();
  offerTip();
  for (const variant of Object.keys(CARDS)) {
    pictures[variant] = null;
    void fetchPictures(order, variant).catch(() => {});
  }
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
  // r38: an order with its code gave the consent on step 1; only an older waiting order asks it here.
  // (.samtykke has display: flex in kjop.css, which would win over hidden alone.)
  const consentLabel = $('samtykke').closest('label');
  consentLabel.hidden = Boolean(pending.code);
  consentLabel.style.display = pending.code ? 'none' : '';
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
const params = new URLSearchParams(location.search);
const choice = params.get('valg');
function pickProduct() {
  const value = choice === 'familie' ? 'family' : 'personal';
  const input = document.querySelector(`input[name="product"][value="${value}"]`);
  if (input) input.checked = true;
}
pickProduct();

// «Dette er en gave» (natt 15.–16.11): ticked by ?gave=1 (the gift's own way from the sales page, and «Kjøp en til som
// gave» on the receipt), and kept for this tab only (sessionStorage), also across Vipps and back. It is never sent to
// the worker; it only puts the gift card first on the receipt.
const GIFT = 'kasse:gave';
function setGift(on) {
  $('gave-valg').checked = on;
  keep(GIFT, on ? true : null);
}
$('gave-valg').addEventListener('change', () => keep(GIFT, $('gave-valg').checked ? true : null));
setGift(params.get('gave') === '1' || stored(GIFT) === true);

// NS-08: the last purchase is also kept on the device for two weeks (localStorage), so a new tab, or the page opened
// again from the e-mail's link the next day, still has «Vis siste kjøp». Only this page reads it; nothing is sent.
const KEPT_DAYS = 14;
function keepLast(order) {
  keep(KEPT, order);
  // Only what the receipt shows, as the privacy page says (the e-mail and the code): not the order's key, number or sum.
  const { code, product, email, receipt } = order;
  try { localStorage.setItem(KEPT, JSON.stringify({ code, product, email, receipt, keptAt: Date.now() })); } catch { /* private mode */ }
}
function lastOnDevice(now = Date.now()) {
  try {
    const last = JSON.parse(localStorage.getItem(KEPT) ?? 'null');
    if (last?.code && now - Number(last.keptAt) < KEPT_DAYS * 864e5) return last;
    localStorage.removeItem(KEPT);
  } catch { /* private mode, or not JSON */ }
  return null;
}

function readKept() {
  const kept = stored(KEPT) ?? lastOnDevice();
  return kept?.code ? kept : null;
}

// The form again, for one more code (feilliste H1). The e-mail stays; the tick box and the name on the card do not.
function showForm(kept, gift) {
  if (gift !== undefined) setGift(gift);
  $('kvittering').hidden = true;
  $('betal').hidden = true;
  $('bestill').hidden = false;
  $('feil').textContent = '';
  $('kopiert').textContent = '';
  $('kortfeil').textContent = '';
  $('samtykke').checked = false;
  $('navn').value = '';
  $('fra').value = '';
  pickProduct();
  $('siste').hidden = !kept;
  if (kept?.email && !$('epost').value) $('epost').value = kept.email;
  if (kept) {
    $('siste-kode').textContent = kept.code;
    $('vis-siste').onclick = () => show(kept);
  }
}

for (const [id, gift] of [['ny', false], ['ny-gave', true]]) {
  $(id).addEventListener('click', () => {
    keep(PENDING, null);
    showForm(readKept(), gift);
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('input[name="product"]:checked')?.focus({ preventScroll: true });
  });
}

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

// NS-08: the browser takes «ola@gmail» as an address, and the receipt would never come. The domain needs a dot, and
// something after it.
const emailLooksSent = (email) => /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/.test(email) && !/\.\./.test(email.split('@')[1] ?? '');

// Forslag 3 (Lars 16.11): «Sjekk e-postadressen.» står rett under e-postfeltet, så den ikke havner under skjermkanten
// langt nede ved betalingsknappen. De andre meldingene står der de sto, under knappene.
const errorHome = $('feil').previousElementSibling;
const placeError = (underEmail) => {
  if (underEmail) $('epost').after($('feil'));
  else if (errorHome) errorHome.after($('feil'));
};

// Shared checks for the first step (product and e-mail).
function readOrderFields(say) {
  const email = $('epost').value.trim();
  const bad = !$('epost').checkValidity() || !emailLooksSent(email);
  placeError(bad);
  // Del 13 L9: a screen reader hears that the field is wrong, not only the message under it.
  $('epost').setAttribute('aria-invalid', String(bad));
  // Round 2 (keyboard): the field that is wrong gets the focus, so a keyboard or screen-reader user lands on it.
  if (bad) { say('email'); $('epost').focus(); return null; }
  const product = document.querySelector('input[name="product"]:checked')?.value;
  if (!product) { say('product'); return null; }
  return { email, product, website: $('nettsted').value };
}

$('epost').addEventListener('input', () => $('epost').removeAttribute('aria-invalid'));
// Finpuss r3: an unticked consent box is marked as wrong for a screen reader and gets the focus, as the email field does;
// ticking it clears the mark.
function consentMissing(id, say) {
  const box = $(id);
  const label = box.closest('label') || box;
  const message = id === 'samtykke' ? $('feil-betal') : $('feil');
  box.setAttribute('aria-invalid', 'true');
  label.classList.add('samtykke-mangler');
  if (message) label.after(message);
  box.focus();
  const result = say('consent');
  label.scrollIntoView({ block: 'center' });
  return result;
}
for (const id of ['samtykke-bestill', 'samtykke']) $(id)?.addEventListener('change', () => {
  $(id).removeAttribute('aria-invalid');
  $(id).closest('label')?.classList.remove('samtykke-mangler');
});

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
  if (!$('samtykke-bestill').checked) return consentMissing('samtykke-bestill', say);
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
  if (!$('samtykke-bestill').checked) return consentMissing('samtykke-bestill', say);
  $('feil').textContent = '';
  if (backOrder && backOrder.email === fields.email && backOrder.product === fields.product) {
    backOrder = { ...backOrder, gave: $('gave-valg').checked };
    keep(PENDING, backOrder);
    showPay(backOrder);
    return;
  }
  busy('kjop', true);
  try {
    const data = await ask('/start', { email: fields.email, product: fields.product, website: fields.website, consent: true });
    const next = { ...data, email: fields.email, gave: $('gave-valg').checked };
    backOrder = null;
    keep(PENDING, next);
    showPay(next);
  } catch (error) {
    say(error.message);
  } finally {
    busy('kjop', false);
  }
});

// Step 2: «Få koden», ticked «Jeg har betalt» or not (r38). The worker writes the tick down. An order with its code
// shows it even if that call fails; an older waiting order (no code yet) needs the consent and the worker's answer.
$('fa-kode').addEventListener('click', async () => {
  const say = (key) => { $('feil-betal').textContent = ERRORS[key] ?? ERRORS.network; };
  const order = readPending();
  if (!order) return say('order');
  if (!order.code && !$('samtykke').checked) return consentMissing('samtykke', say);
  $('feil-betal').textContent = '';
  busy('fa-kode', true);
  try {
    let data = order;
    try {
      data = await ask('/confirm', { orderNo: order.orderNo, key: order.key, paid: $('betalt').checked, consent: true });
    } catch (error) {
      if (!order.code || error.message === 'order') throw error; // 'order': stopped by Lars, or gone
    }
    const bought = { ...order, ...data, email: order.email };
    keepLast(bought);
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
