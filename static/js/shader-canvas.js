/*
 * Mounts <div class="shader-embed"> blocks as live WebGL2 fragment-shader
 * canvases, Shadertoy-style. Markup:
 *
 *   <div class="shader-embed">
 *     <canvas></canvas>
 *     <script type="x-shader/x-fragment">
 *       // has iResolution (vec3), iTime (float), iMouse (vec4) and
 *       // `out vec4 fragColor` already declared - just write main().
 *       void main() { fragColor = vec4(1.0); }
 *     </script>
 *     <p class="shader-caption">Optional caption.</p>
 *   </div>
 *
 * iMouse convention (not identical to Shadertoy's):
 *   .xy  last pointer position in canvas pixels, GL-convention (0,0 = bottom-left)
 *   .z   1.0 while the primary button is held over the canvas, else 0.0
 *   .w   0..1, eased toward 1 while the pointer is hovering the canvas and
 *        toward 0 once it leaves - blend it in with `mix()` so a demo reacts
 *        to hover with no click required, and settles cleanly when the
 *        pointer wanders off instead of popping back to a default pose.
 *
 * A small always-visible toolbar (pause/resume, restart, elapsed time,
 * fullscreen) is injected automatically - no extra markup needed. Pausing
 * freezes iTime exactly where it was (a paused-time accumulator, not just a
 * stopped clock) so resuming doesn't jump.
 *
 * No build step, no dependencies - a single full-screen triangle per frame.
 */
(function () {
  "use strict";

  var VERTEX_SRC =
    "#version 300 es\n" +
    "layout(location=0) in vec2 aPos;\n" +
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }\n";

  var FRAGMENT_PRELUDE =
    "#version 300 es\n" +
    "precision highp float;\n" +
    "uniform vec3 iResolution;\n" +
    "uniform float iTime;\n" +
    "uniform vec4 iMouse;\n" +
    "out vec4 fragColor;\n";

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log || "shader compile failed");
    }
    return sh;
  }

  function link(gl, vs, fs) {
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(log || "program link failed");
    }
    return prog;
  }

  function showError(root, message) {
    var pre = document.createElement("pre");
    pre.className = "shader-error";
    pre.textContent = message;
    root.appendChild(pre);
  }

  function makeButton(label, ariaLabel) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "shader-btn";
    b.textContent = label;
    b.setAttribute("aria-label", ariaLabel);
    return b;
  }

  function mount(root) {
    if (root.dataset.shaderMounted) return;
    root.dataset.shaderMounted = "1";

    var canvas = root.querySelector("canvas");
    var srcEl = root.querySelector('script[type="x-shader/x-fragment"]');
    if (!canvas || !srcEl) return;

    // Wrap the canvas so the toolbar can sit over it without extra author markup.
    var wrap = document.createElement("div");
    wrap.className = "shader-canvas-wrap";
    canvas.parentNode.insertBefore(wrap, canvas);
    wrap.appendChild(canvas);

    var gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: false });
    if (!gl) {
      showError(root, "This browser doesn't support WebGL2, so the demo can't run here.");
      return;
    }

    var prog;
    try {
      var vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
      var fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_PRELUDE + srcEl.textContent);
      prog = link(gl, vs, fs);
    } catch (e) {
      showError(root, "Shader compile/link error:\n\n" + e.message);
      return;
    }

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    // one triangle big enough to cover the whole clip-space viewport
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "iResolution");
    var uTime = gl.getUniformLocation(prog, "iTime");
    var uMouse = gl.getUniformLocation(prog, "iMouse");

    // -- pointer state --------------------------------------------------
    var mouse = [0, 0, 0, 0]; // x, y, buttonDown, (w filled from hoverBlend below)
    var hovering = false;
    var hoverBlend = 0;

    canvas.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      mouse[0] = (e.clientX - r.left) * (canvas.width / r.width);
      mouse[1] = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener("pointerenter", function () { hovering = true; });
    canvas.addEventListener("pointerleave", function () { hovering = false; });
    canvas.addEventListener("pointerdown", function () { mouse[2] = 1; });
    window.addEventListener("pointerup", function () { mouse[2] = 0; });

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    // -- clock: pausing freezes iTime, it doesn't just stop drawing -----
    var startTime = performance.now();
    var totalPausedMs = 0;
    var pauseStart = 0;
    var paused = false;

    function elapsedSeconds(now) {
      var pausedMs = totalPausedMs + (paused ? now - pauseStart : 0);
      return (now - startTime - pausedMs) / 1000;
    }

    function drawFrame(now) {
      resize();
      hoverBlend += ((hovering ? 1 : 0) - hoverBlend) * 0.08;
      var t = elapsedSeconds(now);
      gl.useProgram(prog);
      gl.uniform3f(uRes, canvas.width, canvas.height, 1.0);
      gl.uniform1f(uTime, t);
      gl.uniform4f(uMouse, mouse[0], mouse[1], mouse[2], hoverBlend);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      timeEl.textContent = t.toFixed(1) + "s";
    }

    var visible = true;
    function loop(now) {
      if (!visible || paused) return;
      drawFrame(now);
      requestAnimationFrame(loop);
    }

    var observer = new IntersectionObserver(function (entries) {
      var wasVisible = visible;
      visible = entries[0].isIntersecting;
      if (visible && !wasVisible && !paused) requestAnimationFrame(loop);
    }, { threshold: 0.01 });
    observer.observe(canvas);

    // -- toolbar ----------------------------------------------------------
    var bar = document.createElement("div");
    bar.className = "shader-toolbar";

    var playBtn = makeButton("⏸", "Pause");   // ⏸
    var resetBtn = makeButton("⟲", "Restart"); // ⟲
    var timeEl = document.createElement("span");
    timeEl.className = "shader-time";
    timeEl.textContent = "0.0s";
    var fsBtn = makeButton("⛶", "Fullscreen"); // ⛶

    bar.appendChild(playBtn);
    bar.appendChild(resetBtn);
    bar.appendChild(timeEl);
    bar.appendChild(fsBtn);
    wrap.appendChild(bar);

    playBtn.addEventListener("click", function () {
      var now = performance.now();
      paused = !paused;
      playBtn.textContent = paused ? "▶" : "⏸"; // ▶ / ⏸
      playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
      if (paused) {
        pauseStart = now;
      } else {
        totalPausedMs += now - pauseStart;
        requestAnimationFrame(loop);
      }
    });

    resetBtn.addEventListener("click", function () {
      var now = performance.now();
      startTime = now;
      totalPausedMs = 0;
      if (paused) {
        pauseStart = now;
        drawFrame(now); // repaint immediately so the reset is visible while paused
      }
    });

    fsBtn.addEventListener("click", function () {
      if (document.fullscreenElement === wrap) {
        document.exitFullscreen();
      } else if (wrap.requestFullscreen) {
        wrap.requestFullscreen();
      }
    });

    requestAnimationFrame(loop);
  }

  function init() {
    document.querySelectorAll(".shader-embed").forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
