/* global URLSearchParams */
/* global window */
// Calendar files (RFC 5545) made here on the device and saved like any download: nothing is stored and nothing is sent.
// The same rules as the game's own file (src/engine/ics.ts; tests/salg-v2.test.mjs checks that the two give the same
// file): floating times, folded lines, the same UID per door and year, so a later file updates the reminders instead
// of doubling them. The game's code is TypeScript built into the game; the sales pages run without a build, so the few
// lines it takes are written again here.

export const YEAR = 2026;
export const GAME = 'https://reisenmedlukas.no/spill/';
// 24.11 (Lars 00:12, punkt C): the English reminder shows .com; thejourneywithluke.com/spill/ sends on to the game (301).
export const GAME_EN = 'https://thejourneywithluke.com/spill/';

const pad = (n, width = 2) => String(n).padStart(width, '0');
const utc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** A TEXT value: backslash, semicolon, comma and line breaks escaped (RFC 5545 3.3.11). */
export const escapeText = (text) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

/** A content line folded to at most 75 octets, between characters (RFC 5545 3.1). */
export function fold(line) {
  const bytes = (s) => new TextEncoder().encode(s).length;
  const parts = [];
  let part = '';
  for (const char of line) {
    const room = parts.length ? 74 : 75;
    if (bytes(part + char) > room) {
      parts.push(part);
      part = char;
    } else part += char;
  }
  parts.push(part);
  return parts.join('\r\n ');
}

/** «18:00» as it is, anything else as 18:00 (the evening, after dinner, before bedtime). */
export function clock(time) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return m ? { hours: Number(m[1]), minutes: Number(m[2]) } : { hours: 18, minutes: 0 };
}

/** The doors still to remind of, as in the game: all 24 before December, from today's in it (tomorrow's when today's
 *  time has passed), none after Christmas Eve. */
export function remindDoors(today, year = YEAR, at) {
  const [now, december] = [today.getFullYear(), today.getMonth() === 11];
  if (now > year || (now === year && december && today.getDate() > 24)) return null;
  const passed = at !== undefined && today.getHours() * 60 + today.getMinutes() >= at.hours * 60 + at.minutes;
  const from = now === year && december ? today.getDate() + (passed ? 1 : 0) : 1;
  return from > 24 ? null : { from, to: 24 };
}

const head = (product) => ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//Reisen med Lukas//${product}//NB`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
const event = ({ uid, stamp, start, duration, title, about, url }) => [
  'BEGIN:VEVENT',
  `UID:${uid}`,
  `DTSTAMP:${stamp}`,
  `DTSTART:${start}`,
  `DURATION:${duration}`,
  `SUMMARY:${escapeText(title)}`,
  ...(about ? [`DESCRIPTION:${escapeText(about)}`] : []),
  ...(url ? [`URL:${url}`] : []),
  'TRANSP:TRANSPARENT',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  `DESCRIPTION:${escapeText(title)}`,
  'TRIGGER:PT0M',
  'END:VALARM',
  'END:VEVENT',
];
const file = (lines) => lines.map(fold).join('\r\n') + '\r\n';

/** One reminder a day for doors `from`–`to` at `time` (the receipt's «Legg lukene i kalenderen»). Byte for byte the
 *  game's remindersIcs for the same input. */
export function remindersIcs({ year = YEAR, from, to, time, title, description, url, now }) {
  const { hours, minutes } = clock(time);
  const lines = head('Luker');
  const about = [description, url].filter(Boolean).join('\n');
  for (let door = Math.max(1, from); door <= Math.min(24, to); door++) {
    lines.push(...event({
      uid: `luke-${door}-${year}@reisen-med-lukas`, stamp: utc(now), start: `${year}12${pad(door)}T${pad(hours)}${pad(minutes)}00`,
      duration: 'PT15M', title: title(door), about, url,
    }));
  }
  lines.push('END:VCALENDAR');
  return file(lines);
}

const START = {
  nb: {
    title: 'Reisen med Lukas: kalenderen starter',
    about: 'Julekalenderen Reisen med Lukas starter i dag. Luke 1 er gratis:',
    url: `${GAME}?kapittel=lukas-oppdrag&lang=nb`,
    // 18.00 Norwegian time on 1 December is 17.00 UTC (winter time).
    start: `${YEAR}1201T170000Z`,
  },
  en: {
    title: 'The Journey with Luke: the calendar starts',
    about: 'The Advent calendar The Journey with Luke starts today. Door 1 is free:',
    url: `${GAME_EN}?kapittel=lukas-oppdrag&lang=en`,
    // Abroad: 6 pm by the calendar's own clock, as the doors open by the device's clock.
    start: `${YEAR}1201T180000`,
  },
};

/** «Minn meg på 1. desember»: one event, Tuesday 1 December at 18.00, with the link to door 1. It has door 1's UID
 *  from the receipt's file, so the two never stand twice in the same calendar. */
export function startIcs(lang = 'nb', now = new Date()) {
  const t = START[lang] ?? START.nb;
  return file([
    ...head('Paaminnelse'),
    ...event({ uid: `luke-1-${YEAR}@reisen-med-lukas`, stamp: utc(now), start: t.start, duration: 'PT30M', title: t.title, about: `${t.about} ${t.url}`, url: t.url }),
    'END:VCALENDAR',
  ]);
}

/** Salg 19.11 (Lars 01:07: the file was only downloaded in the Facebook app): the same event as startIcs, as a Google
 *  Calendar template link. It is a plain address made from the event's own text; opening it is the visitor's own tap,
 *  and the page itself sends and stores nothing. Norwegian 18.00 Oslo time (17.00 UTC); English 18.00 by the calendar's
 *  own clock, as in the file. */
export function startGoogle(lang = 'nb') {
  const t = START[lang] ?? START.nb;
  const end = t.start.replace(/T(\d\d)0000/, (m, h) => `T${h}3000`);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: t.title,
    dates: `${t.start}/${end}`,
    details: `${t.about} ${t.url}`,
    location: lang === 'en' ? 'https://thejourneywithluke.com/' : 'https://reisenmedlukas.no/',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Saves `text` as a calendar file, the way the game does (a link to a Blob made on the device). */
export function saveIcs(text, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
