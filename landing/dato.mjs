// The words that change with the date on the sales pages and the buy pages, by the clock on the device (as the doors
// do: engine/access.ts). Only true dates: the calendar starts on Tuesday 1 December 2026; bought in December, the doors up
// to that day open at once (calendarDay); after Christmas Eve all are open; the game stays open at least until
// 31 January 2027. Nothing about Black Friday, no «last chance». Nothing is stored or sent.
//
// In the page: <p data-dato="topp">…</p> gets the line for today (the HTML holds November's as the reserve without a
// script); an empty line hides the element. [data-for-desember] is shown only before 1 December.

export const YEAR = 2026;

/** Which part of the season `now` is in, by the device's own calendar date (natt\plan\PLAN-V3.md, «Frist»). */
export function periode(now = new Date()) {
  const [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate()];
  if (y < YEAR || (y === YEAR && m < 10)) return 'for';
  if (y === YEAR && m === 10) return d >= 29 ? 'helga' : 'for';
  if (y === YEAR && m === 11) {
    if (d === 1) return 'start';
    if (d <= 16) return 'desember';
    if (d <= 23) return 'jula';
    if (d === 24) return 'julaften';
    return 'romjul';
  }
  if (y === YEAR + 1 && m === 0) return 'januar';
  return 'slutt';
}

const PERIODER = ['for', 'helga', 'start', 'desember', 'jula', 'julaften', 'romjul', 'januar', 'slutt'];
const like = (text, unntak = {}) => Object.fromEntries(PERIODER.map((p) => [p, p in unntak ? unntak[p] : text]));

// topp: the front page; kjop: the buy page (the same, but it does not send the buyer back to door 1 before December).
const TOPP_NB = {
  for: 'Kalenderen starter tirsdag 1. desember. Luke 1 er gratis og kan prøves nå.',
  helga: 'Kalenderen starter på tirsdag. Kjøp nå, så er alt klart når kalenderen starter.',
  start: 'Kalenderen har startet i dag. Luke 1 er gratis, og luke 2 åpner i morgen.',
  desember: 'Det er ikke for sent: lukene dere har gått glipp av, står åpne. Begynn i dag og ta igjen i deres eget tempo.',
  jula: 'En julegave uten frakt. Gavekortet er en PDF dere kan skrive ut i kveld, og alle lukene fram til i dag står åpne.',
  julaften: 'God jul! Alle de 24 lukene er åpne.',
  romjul: 'Alle de 24 lukene er åpne nå. Fin å spille i romjula.',
  januar: 'Alle de 24 lukene er åpne. Spillet er åpent minst til og med 31. januar.',
  slutt: '',
};
const TOPP_EN = {
  for: 'The calendar starts on Tuesday 1 December. Door 1 is free to try now.',
  helga: 'The calendar starts on Tuesday. Buy now, and everything is ready when it begins.',
  start: 'The calendar started today. Door 1 is free, and door 2 opens tomorrow.',
  desember: 'It’s not too late: the doors you’ve missed are open. Start today and catch up at your own pace.',
  jula: 'A Christmas gift with no shipping. The gift card is a PDF you can print tonight, and all the doors so far are open.',
  julaften: 'Merry Christmas! All 24 doors are open.',
  romjul: 'All 24 doors are open now. A good thing to play over Christmas.',
  januar: 'All 24 doors are open. The game stays open at least until 31 January.',
  slutt: '',
};
const KVITTERING_FOR = 'Koden virker nå. Luke 1 kan spilles med en gang, og luke 2 åpner onsdag 2. desember. Er de andre lukene låst til da, er det slik det skal være.';

const TEKST = {
  nb: {
    topp: TOPP_NB,
    kjop: { ...TOPP_NB, for: 'Kalenderen starter tirsdag 1. desember. Kjøp nå, så er alt klart når kalenderen starter.' },
    gave: like('Gavekortet er en PDF du kan skrive ut og gi med en gang.', {
      for: 'Gi gavekortet første søndag i advent, 29. november. Da er alt klart når kalenderen starter tirsdag 1. desember.',
      romjul: '', januar: '', slutt: '',
    }),
    kvittering: like('', { for: KVITTERING_FOR, helga: KVITTERING_FOR, start: 'Koden virker nå. Luke 2 åpner i morgen, onsdag 2. desember.' }),
  },
  en: {
    topp: TOPP_EN,
    kjop: { ...TOPP_EN, for: 'The calendar starts on Tuesday 1 December. Buy now, and everything is ready when it begins.' },
    gave: like('The gift card is a PDF you can print and give straight away.', {
      for: 'Give the gift card on the first Sunday of Advent, 29 November. Then everything is ready when the calendar starts on Tuesday 1 December.',
      romjul: '', januar: '', slutt: '',
    }),
    kvittering: like(''),
  },
};
/** The line for `hva` (topp, gave, kvittering) in `lang` today; '' when there is nothing true to say. */
export function tekst(lang, hva, now = new Date()) {
  const sett = (TEKST[lang] ?? TEKST.nb)[hva];
  return sett ? sett[periode(now)] ?? '' : '';
}

/** Whether a reminder for 1 December still makes sense (before the day). */
export const forStart = (now = new Date()) => ['for', 'helga'].includes(periode(now));

/** Fills every [data-dato] in `root` and shows [data-for-desember] only before 1 December. */
export function visDato(root = document, now = new Date()) {
  const lang = (root.documentElement?.lang || 'nb').startsWith('en') ? 'en' : 'nb';
  for (const el of root.querySelectorAll('[data-dato]')) {
    const linje = tekst(lang, el.dataset.dato, now);
    if (linje) el.textContent = linje;
    el.hidden = !linje;
  }
  for (const el of root.querySelectorAll('[data-for-desember]')) el.hidden = !forStart(now);
}

if (typeof document !== 'undefined') visDato();
