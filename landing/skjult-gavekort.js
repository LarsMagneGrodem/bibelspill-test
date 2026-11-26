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
    l.href = new URL('skjult-gavekort.css?v=epost-rydd-2611', BASE).href;
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
  // Oppbygning: pynt, tittel, så e-post først (primærvalg, Lars 26.11 17:59), deretter koden som et roligere valg, og fot.
  // Linja om under 18 år er tatt ut (Lars 14.11 01:32 «Ja kutt det under 18 år»).
  function winnerBox(code, link, mail) {
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
    top.appendChild(el('p', 'skjult-ingress', 'En gratis familiekode til Reisen med Lukas.'));
    inner.appendChild(top);
    if (mail) {
      box.classList.add('skjult-med-epost');
      inner.appendChild(mailForm(link));
    }
    var alt = el('div', 'skjult-alt');
    alt.appendChild(el('p', 'skjult-etikett', 'Koden din:'));
    var kodeEl = el('p', 'skjult-kode', code);
    alt.appendChild(kodeEl);
    var row = el('p', 'skjult-kopirad');
    var copy = el('button', 'skjult-kopier', 'Kopier koden');
    copy.type = 'button';
    var lcopy = el('button', 'skjult-kopier-lenka', 'Kopier lenka');
    lcopy.type = 'button';
    var status = el('span', 'skjult-kopiert');
    status.setAttribute('role', 'status');
    function kopier(tekst) {
      var ok = function () { status.textContent = 'Kopiert!'; };
      var fallback = function () {
        try {
          var r = document.createRange(); r.selectNodeContents(kodeEl);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          status.textContent = 'Trykk og hold for å kopiere';
        } catch (e) { /* ingenting */ }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tekst).then(ok, fallback);
      else fallback();
    }
    copy.addEventListener('click', function () { kopier(code); });
    lcopy.addEventListener('click', function () { kopier(link); });
    row.appendChild(copy);
    row.appendChild(lcopy);
    row.appendChild(status);
    alt.appendChild(row);
    inner.appendChild(alt);
    var fot = el('div', 'skjult-fot');
    fot.appendChild(el('p', 'skjult-frivillig', 'Vil du, kan du si ifra under Facebook-innlegget. Det er frivillig.'));
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
  // Frivillig e-post (kasse r67, Lars 26.11 16:58): koden sendes til adressen. Avkrysningen for påminnelse står ikke
  // krysset av fra før. Lenka fra boksen er nøkkelen; adressen lagres ikke i nettleseren.
  function mailForm(link) {
    var form = el('form', 'skjult-epost');
    form.noValidate = true;
    form.appendChild(el('p', 'skjult-epost-tittel', 'Få lenka på e-post'));
    var lab = el('label', 'skjult-epost-etikett', 'E-post (frivillig)');
    lab.htmlFor = 'skjult-epost-felt';
    var input = el('input', 'skjult-epost-felt');
    input.id = 'skjult-epost-felt';
    input.type = 'email';
    input.name = 'email';
    input.autocomplete = 'email';
    input.inputMode = 'email';
    input.maxLength = 254;
    var kryss = el('label', 'skjult-epost-kryss');
    var box = el('input', '');
    box.type = 'checkbox';
    box.checked = false;
    kryss.appendChild(box);
    kryss.appendChild(el('span', '', 'Ja, send meg en påminnelse når luke 2 åpner'));
    var send = el('button', 'skjult-epost-send', 'Send lenka til meg');
    send.type = 'submit';
    var svar = el('p', 'skjult-epost-svar');
    svar.setAttribute('role', 'status');
    var om = el('p', 'skjult-epost-om', 'Adressen slettes etterpå. ');
    var pa = el('a', '', 'Personvern');
    pa.href = new URL('../personvern.html#gavekort-epost', BASE).href;
    om.appendChild(pa);
    form.appendChild(lab);
    form.appendChild(input);
    form.appendChild(kryss);
    form.appendChild(send);
    form.appendChild(svar);
    form.appendChild(om);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { svar.textContent = 'Sjekk e-postadressen.'; input.focus(); return; }
      send.disabled = true;
      svar.textContent = 'Sender …';
      fetch(KASSE + '/gave/epost', {
        method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: link.split('/').pop(), email: email, remind: box.checked }),
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d || {} }; }); })
        .then(function (a) {
          if (a.status === 200 && a.d.ok) {
            svar.textContent = a.d.remind ? 'Sendt. Du får også én påminnelse 2.\u00a0desember.' : 'Sendt.';
            input.value = '';
            box.checked = false;
          } else if (a.d.error === 'email') svar.textContent = 'Sjekk e-postadressen.';
          else if (a.d.error === 'many') svar.textContent = 'Koden er alt sendt tre ganger.';
          else svar.textContent = 'Fikk ikke sendt. Prøv igjen, eller kopier koden.';
        })
        .catch(function () { svar.textContent = 'Fikk ikke sendt. Prøv igjen, eller kopier koden.'; })
        .then(function () { send.disabled = false; });
    });
    return form;
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
              if (d && d.found === true && typeof d.code === 'string' && typeof d.link === 'string' && d.link.indexOf(KASSE + '/gave/hent/') === 0) winnerBox(d.code, d.link, st.mail === true);
            })
            .catch(function () {});
        });
      });
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
