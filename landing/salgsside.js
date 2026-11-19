/* global window, matchMedia */
// Films on the sales page. Nothing is sent anywhere; no tracking.
// The trailer stays as a poster until a tap. Sound only ever starts from a tap on the button,
// and then the film starts from the top (Lars 16.11).
(function () {
  var lessMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setPoster(video) {
    var src = video.getAttribute('data-poster');
    if (src && !video.getAttribute('poster')) video.setAttribute('poster', src);
  }

  // The intro poster sits below the first screen. Load it only when the film is near, so it does not
  // share the first request with the trailer poster. A tap on play still sets it at once (the top
  // link «Se introfilmen» can start it without scrolling first).
  document.querySelectorAll('video[data-poster]').forEach(function (video) {
    if (!window.IntersectionObserver) { setPoster(video); return; }
    var io = new window.IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        setPoster(video);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(video);
  });

  document.querySelectorAll('[data-film]').forEach(function (box) {
    var video = box.querySelector('video');
    var button = box.querySelector('[data-play-sound]');

    button.addEventListener('click', function () {
      setPoster(video);
      document.querySelectorAll('[data-film] video').forEach(function (other) {
        if (other !== video) other.pause();
      });
      video.loop = false;
      video.muted = false;
      video.controls = true;
      video.preload = 'auto';
      try { video.currentTime = 0; } catch (e) { /* not loaded yet */ }
      box.classList.add('spiller');
      var p = video.play();
      if (p && p.catch) p.catch(function () { box.classList.remove('spiller'); });
      video.focus();
    });
    // When a film with sound ends, show the poster and the button again.
    video.addEventListener('ended', function () {
      video.controls = false;
      box.classList.remove('spiller');
      video.load();
    });
  });

  // Lars 11.11: «Se introfilmen» at the top goes down to the film and starts it with sound in the same tap (the tap is
  // the visitor's own gesture, which the browser asks for before sound). Without the script the link still scrolls.
  document.querySelectorAll('[data-spill-intro]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var section = document.getElementById('introfilm');
      var play = section && section.querySelector('[data-film] [data-play-sound]');
      if (!play) return;
      event.preventDefault();
      play.click();
      section.scrollIntoView({ behavior: lessMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });

})();

// The e-mail address is put together here, so robots that read the HTML do not find it.
document.querySelectorAll('.epost').forEach(function (s) {
  var e = s.dataset.u + '\u0040' + s.dataset.d;
  var a = document.createElement('a');
  a.href = 'mail' + 'to:' + e;
  a.textContent = e;
  s.replaceWith(a);
});

// G6: Safari before iOS 16.4 cannot run the game (a lookbehind in its code), though this page works. Say so before buying.
(function () {
  var old = false;
  try { new RegExp('(?<=a)b'); } catch { old = true; }
  if (!old) return;
  document.querySelectorAll('[data-gammel-ios]').forEach(function (p) { p.hidden = false; });
})();

// Meny på telefon (Codex N2, Lars 16.11): «Meny» viser lenkene til delene av siden. Escape lukker, og et trykk på en
// lenke lukker. «English» og «Kjøp» står alltid i toppen. Uten denne knappen (engelsk side, uten skript) er alt som før.
(function () {
  var button = document.querySelector('.meny-knapp');
  var links = button && document.getElementById(button.getAttribute('aria-controls'));
  if (!links) return;
  button.hidden = false;
  function set(open) {
    button.setAttribute('aria-expanded', String(open));
    links.dataset.open = String(open);
  }
  button.addEventListener('click', function () { set(button.getAttribute('aria-expanded') !== 'true'); });
  links.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') { set(false); button.focus(); }
  });
})();
