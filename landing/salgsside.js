/* global window, matchMedia, IntersectionObserver */
// Films on the sales page. Nothing is sent anywhere; no tracking.
// The trailer may play muted in a loop when it is on screen on a fast network, unless the visitor asks for less motion
// or to save data. Sound only ever starts from a tap on the button, and then the film starts from the top.
(function () {
  var lessMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var saveData = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');

  document.querySelectorAll('[data-film]').forEach(function (box) {
    var video = box.querySelector('video');
    var button = box.querySelector('[data-play-sound]');

    button.addEventListener('click', function () {
      document.querySelectorAll('[data-film] video').forEach(function (other) {
        if (other !== video) other.pause();
      });
      // The silent loop gives way to the trailer itself (its <source>), loaded only now, on the tap.
      if (video.dataset.lokkeSpiller) {
        delete video.dataset.lokkeSpiller;
        video.removeAttribute('src');
        if (video.dataset.plakat) video.poster = video.dataset.plakat;
        video.load();
        var pause = box.querySelector('[data-lokke-pause]');
        if (pause) pause.hidden = true;
      }
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

  // Silent preview of the trailer, only while it is visible, and only where the browser says the network is fast (del 13
  // M7): the whole film is 5-6 MB. Without that signal (Safari on iPhone and iPad has none) the poster stays until a tap.
  // NS-02: Chrome on a phone says «4g» on almost any mobile network, so a phone plays it only on wifi; a computer (no
  // touch screen, no network type) as before.
  var trailer = document.getElementById('trailer');
  // Natt 15.–16.11: a short silent loop from the real game (6–8 s, under 400 kB) in the trailer's place, when the page
  // names one (data-lokke on the video). It plays by itself without sound while it is on screen, also on a phone
  // network (it is small), but never with less motion asked for, with save-data or on 2g; then the poster stays. The
  // trailer with sound is fetched only when someone taps the button. It can always be stopped (WCAG 2.2.2).
  var loopSrc = trailer && trailer.getAttribute('data-lokke');
  if (loopSrc) {
    if (lessMotion || saveData || !('IntersectionObserver' in window)) return;
    // Natt 16.11: mp4 (H.264, the smallest) where it plays, else webm; its own poster while it loads, the trailer's back
    // when sound is asked for. Nothing is fetched before the page has loaded and the browser is idle, so the first
    // screen is drawn as fast as before.
    var webm = trailer.getAttribute('data-lokke-webm');
    if (webm && !trailer.canPlayType('video/mp4; codecs="avc1.42E01E"')) loopSrc = webm;
    var loopPoster = trailer.getAttribute('data-lokke-plakat');
    var pause = trailer.parentNode.querySelector('[data-lokke-pause]');
    var en = document.documentElement.lang.indexOf('en') === 0;
    var stopped = false;
    var watch = function () { new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!trailer.muted || stopped) return;
        if (e.isIntersecting) {
          if (!trailer.dataset.lokkeSpiller) {
            trailer.dataset.lokkeSpiller = '1';
            if (loopPoster) {
              trailer.dataset.plakat = trailer.getAttribute('poster') || '';
              trailer.poster = loopPoster;
            }
            trailer.loop = true;
            trailer.src = loopSrc;
          }
          var p = trailer.play();
          if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
          if (pause) pause.hidden = false;
        } else {
          trailer.pause();
        }
      });
    }, { threshold: 0.4 }).observe(trailer); };
    var idle = function () {
      if (window.requestIdleCallback) window.requestIdleCallback(watch, { timeout: 2000 });
      else window.setTimeout(watch, 600);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
    if (pause) {
      pause.addEventListener('click', function () {
        stopped = !stopped;
        if (stopped) trailer.pause();
        else if (trailer.dataset.lokkeSpiller) trailer.play();
        pause.textContent = stopped ? (en ? 'Play' : 'Spill av') : (en ? 'Stop' : 'Stopp');
        pause.setAttribute('aria-pressed', String(stopped));
      });
    }
    return;
  }
  var fast = conn.effectiveType === '4g';
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var cheap = conn.type === 'wifi' || conn.type === 'ethernet' || (!conn.type && !touch);
  if (!trailer || lessMotion || saveData || !fast || !cheap || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!trailer.muted) return; // the visitor has turned on sound; leave it alone
      if (e.isIntersecting) {
        trailer.preload = 'auto';
        var p = trailer.play();
        if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
      } else {
        trailer.pause();
      }
    });
  }, { threshold: 0.4 }).observe(trailer);
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
