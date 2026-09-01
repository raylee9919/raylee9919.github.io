(function () {
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  var KEY = "ssg-theme";

  function apply(theme) {
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  apply(saved);

  if (btn) {
    btn.addEventListener("click", function () {
      var current = root.getAttribute("data-theme");
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var effectiveDark = current ? current === "dark" : prefersDark;
      var next = effectiveDark ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
    });
  }
})();

// Pitch decks: {{< pitch >}}{{< slide title="..." >}}...{{< /slide >}}{{< /pitch >}}
// A click/swipe/keyboard-navigable slide sequence (Problem -> Solution ->
// Result, or any other run of sections). Built here rather than baked into
// the shortcode's HTML so any page - post or project - gets the same nav
// chrome from one place.
(function () {
  var decks = document.querySelectorAll(".pitch-deck");
  if (!decks.length) return;

  decks.forEach(function (deck) {
    var slides = Array.prototype.slice.call(deck.querySelectorAll(":scope > .pitch-slide"));
    if (!slides.length) return;

    var viewport = document.createElement("div");
    viewport.className = "pitch-viewport";
    deck.insertBefore(viewport, slides[0]);
    slides.forEach(function (slide, i) {
      var eyebrow = document.createElement("p");
      eyebrow.className = "pitch-eyebrow";
      eyebrow.textContent = slide.getAttribute("data-slide-title") || "";
      slide.insertBefore(eyebrow, slide.firstChild);
      viewport.appendChild(slide);
    });

    var prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "pitch-nav pitch-nav-prev";
    prevBtn.setAttribute("aria-label", "Previous");
    prevBtn.innerHTML = "&#8249;";
    var nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "pitch-nav pitch-nav-next";
    nextBtn.setAttribute("aria-label", "Next");
    nextBtn.innerHTML = "&#8250;";
    viewport.appendChild(prevBtn);
    viewport.appendChild(nextBtn);

    var progress = document.createElement("div");
    progress.className = "pitch-progress";
    progress.setAttribute("role", "tablist");
    var dots = slides.map(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "pitch-bar";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", slide.getAttribute("data-slide-title") || "Slide " + (i + 1));
      dot.addEventListener("click", function () { goTo(i); });
      progress.appendChild(dot);
      return dot;
    });
    deck.insertBefore(progress, viewport);

    var current = 0;
    function goTo(i) {
      current = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (slide, idx) { slide.classList.toggle("is-active", idx === current); });
      dots.forEach(function (dot, idx) {
        dot.classList.toggle("is-done", idx < current);
        dot.classList.toggle("is-current", idx === current);
        dot.setAttribute("aria-selected", idx === current ? "true" : "false");
      });
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === slides.length - 1;
    }
    function step(delta) { goTo(current + delta); }

    prevBtn.addEventListener("click", function () { step(-1); });
    nextBtn.addEventListener("click", function () { step(1); });

    // Click the viewport itself (not a link/button/text selection inside a
    // slide) to advance - left third = back, right third = forward.
    viewport.addEventListener("click", function (e) {
      if (e.target.closest("a, button, code, pre, summary")) return;
      var rect = viewport.getBoundingClientRect();
      var frac = (e.clientX - rect.left) / rect.width;
      if (frac < 0.33) step(-1);
      else if (frac > 0.67) step(1);
    });

    deck.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { step(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
    });

    var touchStartX = null, touchStartY = null;
    viewport.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });
    viewport.addEventListener("touchend", function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    goTo(0);
  });
})();
