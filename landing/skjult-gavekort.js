/* global window, location, AbortController, clearTimeout */
// Det skjulte gavekortet (bare den norske forsiden; aldri /en/, kjøpssidene eller spillet).
// 1. Spør kassen om ordningen er på (GET /gave/status). Er den av, eller svarer ikke kassen, skjer ingenting.
// 2. Viser den faste linjen om gavekortet, og venter til siden har vært synlig i 2 sekunder.
// 3. Henter et usynlig Turnstile-token og spør én gang (POST /gave/sjekk). Bare et funn gir en boks.
// Ingen informasjonskapsler, ingen localStorage, ingenting lagres i nettleseren. Klokkeslettet sendes aldri hit.
(function () {
  'use strict';
  var me = document.currentScript;
  var KASSE = (me && me.getAttribute('data-kasse')) || 'https://reisen-med-lukas-unlock.reisenmedlukas.workers.dev';
  // Stiene regnes ut fra skriptets egen adresse (landing/skjult-gavekort.js), så de stemmer både i kilden og på nettstedet.
  var BASE = (me && me.src) || location.href;
  var REGLER = new URL('../konkurranse.html', BASE).href;
  var asked = false;

  function timed(url, init, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms) : 0;
    return fetch(url, Object.assign({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, init || {}, ctl ? { signal: ctl.signal } : {}))
      .then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function css() {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('skjult-gavekort.css', BASE).href;
    document.head.appendChild(l);
  }
  // Den faste linjen i informasjonsdelen (delekampanje 5.1 punkt 5).
  function infoLine() {
    var foot = document.querySelector('footer.foot');
    if (!foot) return;
    var p = el('p', 'skjult-info', 'Hver dag gjemmer vi et gavekort på denne siden. ');
    var a = el('a', '', 'Se reglene.');
    a.href = REGLER;
    p.appendChild(a);
    foot.insertBefore(p, foot.firstChild);
  }
  // Vinnerboksen, ordrett fra delekampanje 5.5. «Kopiert!» er samme ord som på kjøpssiden (kjop.js).
  // Oppbygning: pynt (bånd, segl med Lukas), toppen (tittel og ingress), kortet med koden, lenken, og en roligere fot.
  function winnerBox(code, link) {
    var box = el('section', 'skjult-boks');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-labelledby', 'skjult-tittel');
    box.tabIndex = -1;
    var pynt = el('div', 'skjult-pynt');
    pynt.setAttribute('aria-hidden', 'true');
    pynt.appendChild(el('span', 'skjult-baand'));
    pynt.appendChild(el('span', 'skjult-sloyfe'));
    var segl = el('span', 'skjult-segl');
    var bilde = el('img', 'skjult-portrett');
    bilde.src = new URL('assets/skjult-lukas.webp', BASE).href;
    bilde.alt = '';
    bilde.width = 400;
    bilde.height = 400;
    bilde.decoding = 'async';
    segl.appendChild(bilde);
    pynt.appendChild(segl);
    box.appendChild(pynt);
    var inner = el('div', 'skjult-innhold');
    var top = el('div', 'skjult-topp');
    var h = el('h2', 'skjult-tittel');
    h.id = 'skjult-tittel';
    var gift = el('span', 'skjult-ikon', '🎁');
    gift.setAttribute('aria-hidden', 'true');
    h.appendChild(gift);
    h.appendChild(el('span', 'skjult-tittel-tekst', 'Du fant dagens skjulte gavekort!'));
    top.appendChild(h);
    top.appendChild(el('p', 'skjult-ingress', 'Du var den første som åpnet siden etter dagens hemmelige klokkeslett. Gavekortet er en familiekode til Reisen med Lukas. Den er gratis, og du trenger ikke kjøpe noe.'));
    inner.appendChild(top);
    var ticket = el('div', 'skjult-billett');
    ticket.appendChild(el('p', 'skjult-etikett', 'Koden din:'));
    ticket.appendChild(el('p', 'skjult-kode', code));
    var row = el('p', 'skjult-kopirad');
    var copy = el('button', 'btn gull stor skjult-kopier', 'Kopier');
    copy.type = 'button';
    var status = el('span', 'skjult-kopiert');
    status.setAttribute('role', 'status');
    copy.addEventListener('click', function () {
      var shown = function () { status.textContent = 'Kopiert!'; box.classList.add('skjult-er-kopiert'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(shown, function () {});
    });
    row.appendChild(copy);
    row.appendChild(status);
    ticket.appendChild(row);
    inner.appendChild(ticket);
    var lp = el('p', 'skjult-lenke', 'Ta vare på koden. Lukker du siden, kan du hente den igjen med denne lenken i 24 timer: ');
    var la = el('a', '', link);
    la.href = link;
    la.rel = 'noreferrer';
    lp.appendChild(la);
    inner.appendChild(lp);
    var fot = el('div', 'skjult-fot');
    fot.appendChild(el('p', 'skjult-voksen', 'Er du under 18 år? Vis dette til en voksen.'));
    fot.appendChild(el('p', 'skjult-frivillig', 'Har du lyst, kan du fortelle at du fant den i kommentarfeltet under innlegget om det skjulte gavekortet på Facebook. Det er helt frivillig.'));
    var rp = el('p', 'skjult-regler');
    var ra = el('a', '', 'Regler');
    ra.href = REGLER;
    rp.appendChild(ra);
    fot.appendChild(rp);
    inner.appendChild(fot);
    box.appendChild(inner);
    var main = document.getElementById('innhold') || document.body;
    main.insertBefore(box, main.firstChild);
    box.focus({ preventScroll: true });
    window.scrollTo(0, 0); // boksen ligger øverst i innholdet, rett under menyen
  }
  // 2 sekunder synlig, til sammen, før vi spør.
  function afterVisible(ms, done) {
    var seen = 0;
    var last = document.visibilityState === 'visible' ? Date.now() : 0;
    var timer = 0;
    function tick() {
      if (document.visibilityState !== 'visible') { if (last) seen += Date.now() - last; last = 0; clearTimeout(timer); return; }
      if (!last) last = Date.now();
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (document.visibilityState === 'visible' && seen + (Date.now() - last) >= ms) { document.removeEventListener('visibilitychange', tick); done(); }
        else tick();
      }, Math.max(0, ms - seen));
    }
    document.addEventListener('visibilitychange', tick);
    tick();
  }
  function turnstileToken(siteKey, done) {
    var holder = el('div', 'skjult-turnstile');
    document.body.appendChild(holder);
    window.__skjultGavekortLastet = function () {
      try {
        window.turnstile.render(holder, {
          sitekey: siteKey, action: 'gave', appearance: 'interaction-only', 'refresh-expired': 'never',
          callback: function (t) { done(t); }, 'error-callback': function () { done(null); return true; },
        });
      } catch (e) { done(null); }
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__skjultGavekortLastet';
    s.async = true;
    s.onerror = function () { done(null); };
    document.head.appendChild(s);
  }
  function start() {
    timed(KASSE + '/gave/status', {}, 5000).then(function (st) {
      if (!st || st.on !== true || typeof st.siteKey !== 'string' || !st.siteKey) return;
      css();
      infoLine();
      afterVisible(2000, function () {
        turnstileToken(st.siteKey, function (token) {
          if (asked || !token) return;
          asked = true; // én gang per sidevisning
          timed(KASSE + '/gave/sjekk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token }) }, 10000)
            .then(function (d) {
              if (d && d.found === true && typeof d.code === 'string' && typeof d.link === 'string' && d.link.indexOf(KASSE + '/gave/hent/') === 0) winnerBox(d.code, d.link);
            })
            .catch(function () {});
        });
      });
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
