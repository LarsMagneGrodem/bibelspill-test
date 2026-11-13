// Regelsiden for det skjulte gavekortet: viser fingeravtrykkene fra kassen (GET /gave/fasit), og klokkeslett og salt
// for dager som er over. Svarer ikke kassen, står bare reglene. Ingen informasjonskapsler, ingenting lagres.
(function () {
  'use strict';
  var me = document.currentScript;
  var KASSE = (me && me.getAttribute('data-kasse')) || 'https://reisen-med-lukas-unlock.reisenmedlukas.workers.dev';
  document.querySelectorAll('.epost').forEach(function (s) {
    var e = s.dataset.u + '\u0040' + s.dataset.d;
    var a = document.createElement('a');
    a.href = 'mail' + 'to:' + e;
    a.textContent = e;
    s.replaceWith(a);
  });
  function cell(tr, text, code) {
    var td = document.createElement('td');
    if (text) {
      var c = document.createElement(code ? 'code' : 'span');
      c.textContent = text;
      td.appendChild(c);
    }
    tr.appendChild(td);
  }
  fetch(KASSE + '/gave/fasit', { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !Array.isArray(d.days) || !d.days.length) return;
      var body = document.querySelector('#fasit tbody');
      d.days.slice().reverse().forEach(function (day) {
        var tr = document.createElement('tr');
        cell(tr, day.day);
        cell(tr, day.hash, true);
        cell(tr, day.time || '');
        cell(tr, day.salt || '', true);
        body.appendChild(tr);
      });
      document.querySelectorAll('.fasit-del').forEach(function (e) { e.hidden = false; });
    })
    .catch(function () {});
})();
