// The gift card as a PDF, made in the buyer's own browser: nothing about the card or the name on it leaves the page.
// One A5 landscape page drawn by hand with the PDF's own Helvetica, so no font, library or server is needed.
import { qrCode } from './qr.mjs';

// With a code it is the card the buyer gives away; without, a blank card with a field to write the code in.

const W = 595;
const H = 420;

// Advance widths (1/1000 em) of Helvetica and Helvetica-Bold for the characters 32–126, from Adobe's metrics.
const REGULAR = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584';
const BOLD = '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584';
const widths = (list, nordic) => {
  const map = new Map(list.split(' ').map((w, i) => [32 + i, Number(w)]));
  for (const [ch, w] of Object.entries(nordic)) map.set(ch.charCodeAt(0), w);
  return map;
};
const FONTS = {
  F1: widths(REGULAR, { 'æ': 889, 'ø': 611, 'å': 556, 'Æ': 1000, 'Ø': 778, 'Å': 667, 'é': 556, 'è': 556, '«': 556, '»': 556, '–': 556 }),
  F2: widths(BOLD, { 'æ': 889, 'ø': 611, 'å': 556, 'Æ': 1000, 'Ø': 778, 'Å': 722, 'é': 556, 'è': 556, '«': 556, '»': 556, '–': 556 }),
};

// WinAnsi: Latin-1 as it is, and the few typographic marks that live in 0x80–0x9F.
const WIN = { '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85, '€': 0x80 };
export const winAnsi = (text) =>
  [...String(text)].map((ch) => {
    const c = ch.codePointAt(0);
    if (WIN[ch]) return String.fromCharCode(WIN[ch]);
    return (c >= 32 && c < 127) || (c >= 0xa0 && c <= 0xff) ? ch : '?';
  }).join('');

export const escape = (bytes) => bytes.replace(/[\\()]/g, (c) => `\\${c}`);
export const textWidth = (text, font, size) => [...text].reduce((sum, ch) => sum + (FONTS[font].get(ch.charCodeAt(0)) ?? 556), 0) * size / 1000;

// Short-hand for the drawing operators. Colours are RGB 0–1.
const ink = '0.29 0.2 0.12';
const gold = '0.7 0.52 0.2';
const text = (s, x, y, size, font = 'F1', colour = ink) => `BT ${colour} rg /${font} ${size} Tf ${x.toFixed(1)} ${y} Td (${escape(winAnsi(s))}) Tj ET`;
const centred = (s, y, size, font = 'F1', colour = ink) => text(s, (W - textWidth(winAnsi(s), font, size)) / 2, y, size, font, colour);
const rect = (x, y, w, h, fill, stroke, lineWidth = 1, dash = '') => `q ${fill ? `${fill} rg ` : ''}${stroke ? `${stroke} RG ${lineWidth} w ${dash || '[] 0'} d ` : ''}${x} ${y} ${w} ${h} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'} Q`;

export const SITE = 'https://reisenmedlukas.no';

/** The QR code's modules as rows of 0 and 1, from the game's own encoder (qr.mjs, made from src/app/qr.ts). */
export const qrRows = (text) => qrCode(text).dark.map((row) => row.map((d) => (d ? '1' : '0')).join(''));

function qr(rows, x, y, size) {
  const cell = size / (rows.length + 4);
  const parts = [rect(x, y, size, size, '1 1 1')];
  rows.forEach((row, r) => [...row].forEach((bit, c) => {
    if (bit === '1') parts.push(`${(x + (c + 2) * cell).toFixed(2)} ${(y + size - (r + 3) * cell).toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re`);
  }));
  return `${parts[0]} q 0 0 0 rg ${parts.slice(1).join(' ')} f Q`;
}

/** The words on the card, kept in one place for review. */
export const CARD = {
  title: 'Reisen med Lukas',
  kind: 'Gavekort',
  kinds: { personal: 'Gavekort – personlig kode', family: 'Gavekort – familiekode' },
  codeLabel: 'Gavekoden',
  blankLabel: 'Skriv gavekoden her',
  to: 'Til:',
  enter: 'Skriv koden inn på reisenmedlukas.no.',
  steps: [
    '1. Skann QR-koden, eller gå til reisenmedlukas.no.',
    '2. Start en luke, trykk på tannhjulet, åpne «Mer» og trykk «Jeg har en kode».',
    '3. Hold «Mer» inne i tre sekunder, skriv inn koden og trykk «Lås opp».',
  ],
  doors: 'Luke 1 er gratis. Koden låser opp luke 2–24 på enheten der den tastes inn.',
  whole: 'Hele spillet følger med. Ingen kjøp i appen.',
  who: { personal: 'Den personlige koden er for én person.', family: 'Familiekoden kan tastes inn på alle enhetene i husstanden.' },
  blankBuy: 'Koden får du når du kjøper på reisenmedlukas.no.',
};

/** The page's drawing: a code card when `code` is set (`product` personal or family), the blank card when it is empty.
 * The QR code on both holds the site's address and nothing else. */
export function cardContent({ code = '', name = '', product = '' } = {}) {
  const steps = CARD.steps;
  const kind = (code && CARD.kinds[product]) || CARD.kind;
  const who = code ? CARD.who[product] : '';
  const to = winAnsi(String(name).trim().slice(0, 40));
  let toSize = 14;
  while (toSize > 9 && textWidth(`${CARD.to} ${to}`, 'F1', toSize) > 380) toSize -= 1;
  const ops = [
    rect(0, 0, W, H, '0.98 0.95 0.88'),
    rect(14, 14, W - 28, H - 28, '', gold, 2.5),
    rect(20, 20, W - 40, H - 40, '', gold, 0.6),
    centred(CARD.title, 368, 26, 'F2'),
    centred(kind, 346, 14, 'F1', gold),
    rect(118, 232, W - 236, 100, '1 1 1', gold, 1.2),
  ];
  if (code) {
    ops.push(centred(CARD.codeLabel, 312, 12, 'F1', gold), centred(code, 258, 36, 'F2'));
  } else {
    ops.push(centred(CARD.blankLabel, 312, 12, 'F1', gold), rect(170, 246, W - 340, 52, '', ink, 1, '[4 3] 0'), centred('XXXX-XXXX', 262, 24, 'F1', '0.82 0.78 0.7'));
  }
  ops.push(text(`${CARD.to} ${to}`, 46, 204, toSize));
  if (!to) ops.push(`q ${ink} RG 0.6 w 76 202 m 300 202 l S Q`);
  ops.push(text(CARD.enter, 46, 180, 12, 'F2'));
  steps.forEach((s, i) => ops.push(text(s, 46, 158 - i * 16, 10.5)));
  ops.push(text(CARD.doors, 46, 98, 10.5, 'F2'));
  if (who) ops.push(text(who, 46, 82, 10.5, 'F2'));
  ops.push(text(CARD.whole, 46, who ? 66 : 82, 10.5));
  if (!code) ops.push(text(CARD.blankBuy, 46, 58, 10.5));
  ops.push(qr(qrRows(SITE), W - 126, 44, 82));
  return ops.join('\n');
}

/** The PDF file itself, as bytes. Every character in it is one byte, so string lengths are byte offsets. */
export function giftCardPdf(options = {}) {
  const content = cardContent(options);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
}
