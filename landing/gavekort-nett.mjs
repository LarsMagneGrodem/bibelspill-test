// The gift card that comes with a web purchase: Marketing's Z-fold card on two A4 portrait pages (print both sides,
// flip on the long edge, 100 %), with the buyer's code in the code field and a QR code that opens the game with it.
// The pictures are JPEGs made by tools/koder/lag-nettkort.py; this file only places them and draws the code and the QR
// code on top, so the buy page (in the browser) and the worker (for the e-mail) make the very same file.
//
// Only web codes go on this card. A shop code never gets a QR code with the code in it: someone could scan it in the
// shop. Shop cards and the blank card are drawn by gavekort.mjs, whose QR code holds the site alone.
import { qrCode } from './qr.mjs';
import { LAYOUT } from './nettkort-oppsett.mjs';
import { escape, winAnsi } from './gavekort.mjs';

export const SITE = 'https://reisenmedlukas.no';
export const PAGES = { utside: 'nettkort/utside.jpg', personal: 'nettkort/innside-personlig.jpg', family: 'nettkort/innside-familie.jpg' };

// The serial sits in the code's first four characters, stirred by a public number (shared/unlock-code.mjs); reading it
// back needs no secret. Web serials start at 10001.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SPACE = 31 ** 4;
const UNSTIR = 679796; // the inverse of 571433 modulo 31^4, checked in tests/kasse.test.mjs
const WEB_FIRST = 10001;
const mulMod = (a, b) => ((Math.floor(a / 1024) * b % SPACE) * 1024 + (a % 1024) * b) % SPACE;

/** The code as XXXX-XXXX when it is a web code, otherwise null. */
export function webCode(code) {
  const n = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (n.length !== 8 || [...n].some((c) => !ALPHABET.includes(c))) return null;
  const stirred = [...n.slice(0, 4)].reduce((v, c) => v * 31 + ALPHABET.indexOf(c), 0);
  return mulMod(stirred, UNSTIR) >= WEB_FIRST ? `${n.slice(0, 4)}-${n.slice(4)}` : null;
}

/** What the QR code on a web card holds: the site with the code, which the game redeems at once (`?kode=`). */
export function webCardQr(code) {
  const c = webCode(code);
  if (!c) throw new Error('not a web code');
  // The web card comes from the Norwegian buy page, so the game opens in Norwegian even on a phone set to English.
  return `${SITE}/?kode=${c}&lang=nb`;
}

const f2 = (v) => Number(v.toFixed(2));

function codeOps(code) {
  const { cx, baseline, size, colour, upm } = LAYOUT.code;
  const s = size / upm;
  const width = [...code].reduce((w, ch) => w + LAYOUT.glyphs[ch].w, 0) * s;
  let x = cx - width / 2;
  const ops = [`q ${colour} rg`];
  for (const ch of code) {
    ops.push(`q ${f2(s)} 0 0 ${f2(s)} ${f2(x)} ${baseline} cm ${LAYOUT.glyphs[ch].d} f Q`);
    x += LAYOUT.glyphs[ch].w * s;
  }
  ops.push('Q');
  return ops.join('\n');
}

// One fixed mask (any of the eight is valid): choosing the best one costs the worker a few milliseconds per card, and
// the buy page and the worker must draw the same modules.
export const QR_MASK = 0;

function qrOps(text) {
  const { dark } = qrCode(text, QR_MASK);
  const { x, y, side, colour } = LAYOUT.qr;
  const cell = side / (dark.length + 8);
  const rects = [];
  dark.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      let run = 1;
      while (row[c + run]) run++;
      rects.push(`${f2(x + (c + 4) * cell)} ${f2(y + side - (r + 5) * cell)} ${f2(run * cell)} ${f2(cell)} re`);
      c += run - 1;
    }
  });
  return `q ${colour} rg ${rects.join(' ')} f Q`;
}

function nameOps(name) {
  const to = winAnsi(String(name ?? '').trim().slice(0, 40));
  if (!to) return '';
  const { x, baseline, size, colour } = LAYOUT.til;
  return `BT ${colour} rg /F1 ${size} Tf ${x} ${baseline} Td (${escape(to)}) Tj ET`;
}

/**
 * The file in two pieces. The prefix is the same for every card of a product (catalogue, pages, font and the two
 * pictures) and is made once; only the suffix (the two page drawings, the cross-reference table and the trailer) is made
 * per card. Pictures start, and the prefix ends, at offsets divisible by three, so base64 made beforehand for each piece
 * fits straight into the base64 of the whole file (cardPdfBase64).
 *
 * Objects: 1 catalogue, 2 pages, 3–4 pages, 9 font, 7–8 pictures (outside, inside), then 5–6 the page drawings.
 */
const { page, image } = LAYOUT;
// The sheet is A4 portrait, like the shop card (Marketing, butikkort/lag_butikkort.py): the card (A4 landscape) is turned
// into the page, the outside 90° anticlockwise (the cover at the top), the inside 90° clockwise, so that printing both
// sides and flipping on the long edge puts the inside right behind the outside. No /Rotate: printers ignore it too often.
export const SHEET = { w: page.h, h: page.w };
export const TURN = { outside: `0 1 -1 0 ${SHEET.w} 0 cm`, inside: `0 -1 1 0 0 ${SHEET.h} cm` };
const PAGE = (content, img) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SHEET.w} ${SHEET.h}] /Contents ${content} 0 R /Resources << /XObject << /Im ${img} 0 R >> /Font << /F1 9 0 R >> >> >>`;
const prefixes = new Map();

/** The prefix of a product's card: `texts` around the two pictures, the static objects' offsets, and its length. */
export function cardPrefix(product, lengths) {
  if (!PAGES[product] || product === 'utside') throw new Error('product');
  const key = `${product}:${lengths.utside}:${lengths[product]}`;
  if (prefixes.has(key)) return prefixes.get(key);
  const texts = [''];
  const offsets = [];
  let at = 0;
  const add = (s) => { texts[texts.length - 1] += s; at += s.length; };
  const obj = (n, body) => { offsets[n] = at; add(`${n} 0 obj\n${body}\nendobj\n`); };
  add('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /Duplex /DuplexFlipLongEdge /PrintScaling /None >> >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>');
  obj(3, PAGE(5, 7));
  obj(4, PAGE(6, 8));
  obj(9, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>');
  const pictures = [];
  for (const [key2, n] of [['utside', 7], [product, 8]]) {
    offsets[n] = at;
    const head = `${n} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.w} /Height ${image.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${lengths[key2]} >>`;
    add(`${head}${' '.repeat((3 - ((at + head.length + 8) % 3)) % 3)}\nstream\n`);
    pictures.push(key2);
    at += lengths[key2];
    texts.push('');
    add('\nendstream\nendobj\n');
  }
  add('\n'.repeat((3 - (at % 3)) % 3));
  const prefix = { texts, pictures, offsets, length: at };
  prefixes.set(key, prefix);
  return prefix;
}

/** The suffix of one card: its two page drawings, the cross-reference table and the trailer. */
export function cardSuffix({ code, name = '' }, prefix) {
  const kode = webCode(code);
  if (!kode) throw new Error('not a web code');
  const draw = (turn, extra) => `q ${turn}\nq ${page.w} 0 0 ${page.h} 0 0 cm /Im Do Q\n${extra}\nQ`;
  const contents = [draw(TURN.outside, nameOps(name)), draw(TURN.inside, `${codeOps(kode)}\n${qrOps(webCardQr(kode))}`)];
  const offsets = prefix.offsets.slice();
  let out = '';
  let at = prefix.length;
  contents.forEach((c, i) => {
    offsets[5 + i] = at;
    const o = `${5 + i} 0 obj\n<< /Length ${c.length} >>\nstream\n${c}\nendstream\nendobj\n`;
    out += o;
    at += o.length;
  });
  out += `xref\n0 10\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`;
  return out;
}

const latin1 = (s, out, at) => {
  for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i);
  return at + s.length;
};

/** The PDF as bytes, from the pictures' bytes (the buy page fetches them). */
export function cardPdf(card, jpegs) {
  const kode = webCode(card.code);
  if (!kode) throw new Error('not a web code');
  const lengths = Object.fromEntries(Object.entries(jpegs).map(([k, v]) => [k, v.length]));
  const prefix = cardPrefix(card.product, lengths);
  const suffix = cardSuffix(card, prefix);
  const out = new Uint8Array(prefix.length + suffix.length);
  let at = 0;
  prefix.texts.forEach((t, i) => {
    at = latin1(t, out, at);
    if (i < prefix.pictures.length) {
      out.set(jpegs[prefix.pictures[i]], at);
      at += jpegs[prefix.pictures[i]].length;
    }
  });
  latin1(suffix, out, at);
  return out;
}

const b64 = (binary) => btoa(binary);
const prefixes64 = new WeakMap();

/** A product's prefix as base64, made once per worker from base64 made beforehand for each picture
 * (`{ length, head, tail }`: head is the base64 of all but the last length % 3 bytes, tail those bytes as a string). */
export function cardPrefixBase64(product, pictures) {
  if (!prefixes64.has(pictures)) prefixes64.set(pictures, new Map());
  const cache = prefixes64.get(pictures);
  if (cache.has(product)) return cache.get(product);
  const lengths = Object.fromEntries(Object.entries(pictures).map(([k, v]) => [k, v.length]));
  const prefix = cardPrefix(product, lengths);
  let out = '';
  let pending = '';
  prefix.texts.forEach((t, i) => {
    pending += t;
    if (i < prefix.pictures.length) {
      out += b64(pending) + pictures[prefix.pictures[i]].head;
      pending = pictures[prefix.pictures[i]].tail;
    }
  });
  const made = { prefix, base64: out + b64(pending) };
  cache.set(product, made);
  return made;
}

/** The PDF's base64 in two pieces: the product's prefix (made once per worker) and this card's suffix. */
export function cardPdfBase64Parts(card, pictures) {
  if (!webCode(card.code)) throw new Error('not a web code');
  const { prefix, base64 } = cardPrefixBase64(card.product, pictures);
  return [base64, b64(cardSuffix(card, prefix))];
}

/** The PDF as base64, for an e-mail attachment. */
export const cardPdfBase64 = (card, pictures) => cardPdfBase64Parts(card, pictures).join('');
