// The e-mail address is put together here, so robots that read the HTML do not find it.
document.querySelectorAll('.epost').forEach(function (s) {
  var e = s.dataset.u + '\u0040' + s.dataset.d;
  var a = document.createElement('a');
  a.href = 'mail' + 'to:' + e;
  a.textContent = e;
  s.replaceWith(a);
});
