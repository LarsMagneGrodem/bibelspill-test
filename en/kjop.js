/* global document, location, URLSearchParams */
// The English checkout: the chosen code picks its Stripe Payment Link (Managed Payments; Stripe sells, the worker's
// /stripe/webhook books the code). ?valg=familie picks the family code, as on the Norwegian page.
(function () {
  var pay = document.getElementById('betal');
  var family = document.querySelector('input[name="product"][value="family"]');
  if (new URLSearchParams(location.search).get('valg') === 'familie' && family) family.checked = true;
  function pick() {
    var chosen = document.querySelector('input[name="product"]:checked');
    pay.href = chosen && chosen.value === 'family' ? pay.dataset.family : pay.dataset.personal;
  }
  document.querySelectorAll('input[name="product"]').forEach(function (r) { r.addEventListener('change', pick); });
  pick();
  document.querySelectorAll('.epost').forEach(function (s) {
    var e = s.dataset.u + '\u0040' + s.dataset.d;
    var a = document.createElement('a');
    a.href = 'mail' + 'to:' + e;
    a.textContent = e;
    s.replaceWith(a);
  });
})();
