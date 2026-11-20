// The sales pages (nb and /en/): the line that changes with the date (dato.mjs), «Minn meg på 1. desember» (one
// calendar event made here, nothing stored or sent, no e-mail), and the place for quotes from grown-ups who tried door 1.
// The quotes stand in sitater.json and are shown only when there are real ones; until then the place is not on the page.
import { forStart } from './dato.mjs';
import './kilde.mjs'; // utm/?fra= for the buy page (this tab's sessionStorage only)
import { saveIcs, startGoogle, startIcs } from './kalender.mjs';

const lang = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'en' : 'nb';
const SAVED = {
  nb: 'Kalenderfila er lastet ned. Åpne den, så legges påminnelsen inn i kalenderen. Fila er laget her på enheten, og ingenting er sendt.',
  en: 'The calendar file is downloaded. Open it to put the reminder in your calendar. The file was made here on the device, and nothing was sent.',
};

// Salg 19.11: the reminder is a real button. Its first choice is Google Calendar (a link made from the same event, opened
// in a new tab, which works in the Facebook and Instagram apps' browsers too), with the calendar file as the other choice.
// On an iPhone or iPad outside those apps, Safari puts the file straight into the calendar, so there the file comes first.
const LABEL = {
  nb: { main: 'Minn meg på 1. desember', file: 'eller last ned kalenderfil', google: 'eller bruk Google Kalender' },
  en: { main: 'Remind me on 1 December', file: 'or download a calendar file', google: 'or use Google Calendar' },
};
export const inAppBrowser = (ua) => /FBAN|FBAV|FB_IAB|FBIOS|Instagram/i.test(ua ?? '');
export const appleTouch = (ua, touchPoints = 0) => /iPhone|iPad|iPod/.test(ua ?? '') || (/Macintosh/.test(ua ?? '') && touchPoints > 1);
/** Which choice comes first: the calendar file only on an iPhone or iPad outside the apps' own browsers. */
export const fileFirst = (ua, touchPoints = 0) => appleTouch(ua, touchPoints) && !inAppBrowser(ua);

for (const box of typeof document !== 'undefined' ? document.querySelectorAll('p.minn') : []) {
  const google = box.querySelector('[data-minn-google]');
  const button = box.querySelector('[data-minn]');
  if (!button) continue;
  button.hidden = !forStart();
  if (google) {
    google.hidden = !forStart();
    google.href = startGoogle(lang);
    if (fileFirst(navigator.userAgent, navigator.maxTouchPoints)) {
      const t = LABEL[lang];
      button.className = 'btn minn-knapp';
      button.innerHTML = '<span aria-hidden="true">📅</span> ';
      button.append(t.main);
      google.className = 'lenke-knapp minn-alt';
      google.textContent = t.google;
      box.insertBefore(button, google);
    }
  }
  button.addEventListener('click', () => {
    saveIcs(startIcs(lang), lang === 'en' ? 'journey-with-luke-1-december.ics' : 'reisen-med-lukas-1-desember.ics');
    const status = document.getElementById(button.dataset.minn);
    if (status) status.textContent = SAVED[lang];
  });
}

/** Real quotes only: each needs the words, a first name and a role, and says whether the person got a free code
 *  (then it is marked by the quote). At most three. */
export function quotes(data, language) {
  const list = Array.isArray(data?.[language]) ? data[language] : [];
  return list
    .filter((q) => q && typeof q.sitat === 'string' && q.sitat.trim() && typeof q.navn === 'string' && q.navn.trim() && typeof q.rolle === 'string' && q.rolle.trim() && q.samtykke === true)
    .slice(0, 3);
}

const FREE = { nb: 'fikk koden gratis for å prøve', en: 'received a free code to try it' };
const TRIED = { nb: 'prøvde luke 1', en: 'tried door 1' };

async function showQuotes() {
  const box = document.getElementById('sitater');
  if (!box) return;
  let data = null;
  try {
    const res = await fetch(new URL('sitater.json', import.meta.url));
    if (res.ok) data = await res.json();
  } catch { /* offline: no quotes */ }
  const list = quotes(data, lang);
  if (!list.length) return;
  const ul = box.querySelector('ul');
  for (const q of list) {
    const li = document.createElement('li');
    const words = document.createElement('blockquote');
    words.textContent = lang === 'en' ? `“${q.sitat.trim()}”` : `«${q.sitat.trim()}»`;
    const who = document.createElement('p');
    who.textContent = `${q.navn.trim()}, ${q.rolle.trim()}${q.sted ? `, ${String(q.sted).trim()}` : ''}, ${q.gratisKode ? FREE[lang] : TRIED[lang]}`;
    li.append(words, who);
    ul.append(li);
  }
  box.hidden = false;
}
if (typeof document !== 'undefined') void showQuotes();
