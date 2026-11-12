// Films on the sales page. Nothing is sent anywhere; no tracking.
// The trailer may play muted in a loop when it is on screen, unless the visitor asks for less motion
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

  // Silent preview of the trailer, only while it is visible.
  var trailer = document.getElementById('trailer');
  if (!trailer || lessMotion || saveData || !('IntersectionObserver' in window)) return;
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
