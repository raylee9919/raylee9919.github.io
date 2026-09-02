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
      var title = slide.getAttribute("data-slide-title");
      if (title) {
        var eyebrow = document.createElement("p");
        eyebrow.className = "pitch-eyebrow";
        eyebrow.textContent = title;
        slide.insertBefore(eyebrow, slide.firstChild);
      }
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

    // Dusk sky + stars + rolling ridges, clipped together in one rounded
    // card so the corners stay clean. Dots/hiker are appended outside this
    // wrapper so they can hang slightly past its edges without being cut
    // off. Stars sit above the sky gradient but below the ridges (so the
    // ridges still occlude them at the horizon), and fade out via --sky-t
    // in lockstep with the brightness ramp (both driven from goTo() below).
    var scene = document.createElement("div");
    scene.className = "pitch-hill-scene";
    scene.setAttribute("aria-hidden", "true");
    // Plain pixel-sized dots, not SVG circles - the scene is much wider than
    // tall, and an SVG stretched non-uniformly to fill it (preserveAspectRatio
    // "none") squashes round circles into thin horizontal slivers that blur
    // into a line instead of looking like stars.
    // [left%, top%, size(px), base opacity, glow?]
    var starSpots = [
      [5, 10, 3.2, 1, true], [13.8, 25, 2, .8, false], [22.5, 8, 3.6, 1, true],
      [32.5, 20, 1.8, .75, false], [41.3, 35, 2.4, .9, false], [50, 12, 2.2, .85, false],
      [58.8, 28, 3.4, 1, true], [67.5, 6, 2, .8, false], [76.3, 22, 2.4, .9, false],
      [85, 15, 2.2, .85, false], [93.8, 32, 1.8, .75, false], [11.3, 38, 2.2, .85, false],
      [27.5, 40, 1.8, .75, false], [47.5, 40, 2, .8, false], [62.5, 42, 1.8, .75, false],
      [80, 38, 2.2, .85, false],
    ];
    var starsHtml = starSpots.map(function (s, i) {
      var cls = "pitch-star" + (s[4] ? " pitch-star-glow" : "");
      var style = "left:" + s[0] + "%;top:" + s[1] + "%;width:" + s[2] + "px;height:" + s[2] +
        "px;--star-o:" + s[3] + ";animation-delay:-" + ((i * 0.37) % 2.6).toFixed(2) + "s";
      return '<i class="' + cls + '" style="' + style + '"></i>';
    }).join("");
    scene.innerHTML =
      '<div class="pitch-hill-stars">' + starsHtml + '</div>' +
      '<div class="pitch-hill-ridge pitch-hill-ridge-back"></div>' +
      '<div class="pitch-hill-ridge pitch-hill-ridge-mid"></div>' +
      '<div class="pitch-hill-ground"></div>';
    progress.appendChild(scene);

    // Fraction (0..1) along the slide sequence -> position on the hill.
    // Dots/hiker live outside .pitch-hill-scene's clip (so they're never cut
    // off mid-shape), but kept inset from the box edges here so they don't
    // sit right where the scene's rounded top corners carve the curve in.
    // Y is deliberately shallow (not a steep 0-100% climb): the hiker's own
    // height needs headroom above its checkpoint before it clears the top
    // of .pitch-progress, or its head pokes out above the card at the
    // summit.
    function hillX(frac) { return 10 + 80 * frac; }
    function hillY(frac) { return 25 + 25 * frac; }

    var dots = slides.map(function (slide, i) {
      var frac = slides.length > 1 ? i / (slides.length - 1) : 0;
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "pitch-bar";
      dot.style.left = hillX(frac) + "%";
      dot.style.bottom = hillY(frac) + "%";
      dot.innerHTML =
        '<svg viewBox="0 0 12 22" aria-hidden="true">' +
        '<line class="flag-pole" x1="2" y1="21" x2="2" y2="2"></line>' +
        '<path class="flag-cloth-a" d="M2,2 L7.75,4.5 L7.75,9.5 L2,12 Z"></path>' +
        '<path class="flag-cloth-b" d="M7.75,4.5 L13.5,7 L7.75,9.5 Z"></path>' +
        '</svg>';
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", slide.getAttribute("data-slide-title") || "Slide " + (i + 1));
      dot.addEventListener("click", function () { goTo(i); });
      progress.appendChild(dot);
      return dot;
    });

    var hiker = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hiker.setAttribute("viewBox", "0 0 20 30");
    hiker.setAttribute("class", "pitch-hiker");
    hiker.setAttribute("aria-hidden", "true");
    hiker.innerHTML =
      '<circle class="hiker-head" cx="10" cy="4" r="3"></circle>' +
      '<rect class="hiker-pack" x="6.5" y="8" width="3" height="6" rx="1"></rect>' +
      '<line class="hiker-part hiker-body" x1="10" y1="7" x2="10" y2="18"></line>' +
      '<line class="hiker-part hiker-arm-l" x1="10" y1="10" x2="6" y2="16"></line>' +
      '<line class="hiker-part hiker-arm-r" x1="10" y1="10" x2="14" y2="15"></line>' +
      '<line class="hiker-part hiker-leg-l" x1="10" y1="18" x2="6" y2="28"></line>' +
      '<line class="hiker-part hiker-leg-r" x1="10" y1="18" x2="14" y2="27"></line>';
    progress.appendChild(hiker);

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
      var frac = slides.length > 1 ? current / (slides.length - 1) : 0;
      hiker.style.left = hillX(frac) + "%";
      hiker.style.bottom = hillY(frac) + "%";
      progress.style.setProperty("--sky-t", frac);
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
