/* global document */
// The e-mail address is put together here, not written in the page, as on the Norwegian pages.
document.querySelectorAll('.epost').forEach(function (s) {
  var e = s.dataset.u + '\u0040' + s.dataset.d;
  var a = document.createElement('a');
  a.href = 'mail' + 'to:' + e;
  a.textContent = e;
  s.replaceWith(a);
});
