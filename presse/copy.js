(function () {
  function feedback(btn, ok) {
    if (!btn) return;
    var original = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", original);
    btn.textContent = ok ? "Kopiert" : "Kunne ikke kopiere";
    window.setTimeout(function () { btn.textContent = original; }, 2000);
  }

  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        feedback(btn, true);
      }).catch(function () {
        fallback(text, btn);
      });
    } else {
      fallback(text, btn);
    }
  }

  function fallback(text, btn) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(area);
    feedback(btn, ok);
  }

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-copy]");
    if (!btn) return;
    event.preventDefault();
    var sel = btn.getAttribute("data-copy");
    var source = sel ? document.querySelector(sel) : null;
    var text = source ? (source.value || source.textContent || "") : (btn.getAttribute("data-copy-text") || "");
    text = text.replace(/^\n+|\n+$/g, "");
    if (text) copyText(text, btn);
  });
})();
