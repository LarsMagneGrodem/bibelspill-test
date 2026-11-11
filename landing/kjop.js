// The buy page: an e-mail and the consent go to the sale's worker, which answers with the code and how to pay.
// The gift card is drawn here in the browser (gavekort-nett.mjs) after the purchase; the name on it never leaves the page.
// Lars 11.11: no card to download before buying, so no blank card here.
import { PAGES, cardPdf } from './gavekort-nett.mjs';

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
  busy: 'Mange kjøper akkurat nå. Prøv igjen litt senere.',
  network: 'Fikk ikke kontakt. Sjekk at du er på nett, og prøv igjen.',
};

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
async function webCard(order) {
  $('kortfeil').textContent = '';
  $('gavekort').disabled = true;
  try {
    const get = async (path) => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(String(res.status));
      return new Uint8Array(await res.arrayBuffer());
    };
    const [utside, innside] = await Promise.all([get(PAGES.utside), get(PAGES[order.product])]);
    const pdf = cardPdf({ code: order.code, product: order.product, name: $('navn').value }, { utside, [order.product]: innside });
    download(pdf, `gavekort-${order.code}.pdf`);
  } catch {
    $('kortfeil').textContent = 'Fikk ikke laget gavekortet. Sjekk at du er på nett, og prøv igjen.';
  } finally {
    $('gavekort').disabled = false;
  }
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
if (new URLSearchParams(location.search).get('valg') === 'familie') {
  const fam = document.querySelector('input[name="product"][value="family"]');
  if (fam) fam.checked = true;
}

// The last order stays for this tab only, so a reload does not lose the code.
try {
  const kept = JSON.parse(sessionStorage.getItem(KEPT) ?? 'null');
  if (kept?.code) show(kept);
} catch { /* nothing kept */ }

if (!api) {
  $('stengt').hidden = false;
  $('skjema').hidden = true;
}

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
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return say(data.error);
    try { sessionStorage.setItem(KEPT, JSON.stringify(data)); } catch { /* private mode */ }
    show(data);
  } catch {
    say('network');
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
