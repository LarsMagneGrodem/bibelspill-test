// The sales pages (nb and /en/): the line that changes with the date (dato.mjs), «Minn meg på 1. desember» (one
// calendar event made here, nothing stored or sent, no e-mail), and the place for quotes from grown-ups who tried door 1.
// The quotes stand in sitater.json and are shown only when there are real ones; until then the place is not on the page.
import { forStart } from './dato.mjs';
import { saveIcs, startIcs } from './kalender.mjs';

const lang = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'en' : 'nb';
const SAVED = {
  nb: 'Kalenderfila er lastet ned. Åpne den, så legges påminnelsen inn i kalenderen. Fila er laget her på enheten, og ingenting er sendt.',
  en: 'The calendar file is downloaded. Open it to put the reminder in your calendar. The file was made here on the device, and nothing was sent.',
};

for (const button of typeof document !== 'undefined' ? document.querySelectorAll('[data-minn]') : []) {
  button.hidden = !forStart();
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
