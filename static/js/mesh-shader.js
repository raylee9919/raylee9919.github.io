/*
 * Mounts <div class="mesh-shader-embed" data-obj="..."> as a live, editable
 * WebGL2 mesh viewer: a real vertex/index-buffer mesh (loaded from a plain
 * .obj file - genuinely arbitrary, whatever the file contains), a fixed
 * vertex stage, and a fragment shader you can rewrite in the browser.
 *
 * Markup:
 *   <div class="mesh-shader-embed" data-obj="resources/torus.obj">
 *     <canvas></canvas>
 *     <script type="x-shader/x-fragment">
 *       // @param uAlbedo    color  0.8 0.4 0.2
 *       // @param uRoughness slider 0.05 1.0 0.35
 *       // has vNormal, vWorldPos (varyings), iTime, iMouse, iResolution,
 *       // uCameraPos, uLightDir, and any @param uniforms declared above -
 *       // just write main().
 *       void main() { fragColor = vec4(uAlbedo, 1.0); }
 *     </script>
 *     <p class="shader-caption">Optional caption.</p>
 *   </div>
 *
 * The "// @param NAME kind ...args" pragma is this file's own convention
 * (not GLSL, not Shadertoy) - a comment line, parsed on every recompile, that
 * both declares a uniform and generates its control:
 *   color  r g b       -> vec3 uniform + a color swatch input
 *   slider min max val -> float uniform + a range input
 *   toggle 0|1         -> float uniform (0.0/1.0) + a checkbox
 *
 * Camera: drag to orbit, wheel to dolly; it auto-rotates slowly while you're
 * not dragging, so it's never inert. Editing recompiles on demand (Run
 * button or Ctrl+/Cmd+Enter) and keeps the last working program on screen if
 * the new one fails, with the compiler's own error message shown inline.
 */
(function () {
  "use strict";

  var VERTEX_SRC =
    "#version 300 es\n" +
    "layout(location=0) in vec3 aPosition;\n" +
    "layout(location=1) in vec3 aNormal;\n" +
    "uniform mat4 uView;\n" +
    "uniform mat4 uProj;\n" +
    "out vec3 vNormal;\n" +
    "out vec3 vWorldPos;\n" +
    "void main() {\n" +
    "  vWorldPos = aPosition;\n" +
    "  vNormal = aNormal;\n" +
    "  gl_Position = uProj * uView * vec4(aPosition, 1.0);\n" +
    "}\n";

  var FRAGMENT_PRELUDE =
    "#version 300 es\n" +
    "precision highp float;\n" +
    "in vec3 vNormal;\n" +
    "in vec3 vWorldPos;\n" +
    "uniform vec3 iResolution;\n" +
    "uniform float iTime;\n" +
    "uniform vec4 iMouse;\n" +
    "uniform vec3 uCameraPos;\n" +
    "uniform vec3 uLightDir;\n" +
    "out vec4 fragColor;\n";

  var PARAM_RE = /^\s*\/\/\s*@param\s+(\w+)\s+(color|slider|toggle)\s+(.+?)\s*$/;

  // ---- tiny column-major mat4 helpers (GLSL/uniformMatrix4fv convention) --
  function perspective(fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  function normalize3(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function lookAt(eye, target, up) {
    var z = normalize3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
    var x = normalize3(cross3(up, z));
    var y = cross3(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
    ]);
  }

  // ---- minimal OBJ loader: v / vn / f (triangulates fans) ----------------
  function parseObj(text) {
    var positions = [];
    var normals = [];
    var outPos = [];
    var outNorm = [];
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === "" || line[0] === "#") continue;
      var parts = line.split(/\s+/);
      var tag = parts[0];
      if (tag === "v") {
        positions.push([+parts[1], +parts[2], +parts[3]]);
      } else if (tag === "vn") {
        normals.push([+parts[1], +parts[2], +parts[3]]);
      } else if (tag === "f") {
        var verts = parts.slice(1).map(function (token) {
          var idx = token.split("/");
          var vi = parseInt(idx[0], 10);
          var ni = idx[2] ? parseInt(idx[2], 10) : null;
          if (vi < 0) vi = positions.length + vi + 1;
          if (ni !== null && ni < 0) ni = normals.length + ni + 1;
          return { v: vi - 1, n: ni !== null ? ni - 1 : null };
        });
        for (var k = 1; k < verts.length - 1; k++) {
          [verts[0], verts[k], verts[k + 1]].forEach(function (vert) {
            var p = positions[vert.v] || [0, 0, 0];
            var n = vert.n !== null ? normals[vert.n] : null;
            outPos.push(p[0], p[1], p[2]);
            if (n) { outNorm.push(n[0], n[1], n[2]); } else { outNorm.push(0, 1, 0); }
          });
        }
      }
    }
    return { positions: outPos, normals: outNorm, count: outPos.length / 3 };
  }

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

  function makeButton(label, ariaLabel, extraClass) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "shader-btn" + (extraClass ? " " + extraClass : "");
    b.textContent = label;
    b.setAttribute("aria-label", ariaLabel);
    return b;
  }

  function showError(root, message) {
    var pre = document.createElement("pre");
    pre.className = "shader-error";
    pre.textContent = message;
    root.appendChild(pre);
  }

  function parseParams(source) {
    var params = [];
    source.split("\n").forEach(function (line) {
      var m = PARAM_RE.exec(line);
      if (!m) return;
      var name = m[1], kind = m[2], rest = m[3].trim().split(/\s+/).map(Number);
      if (kind === "color") {
        params.push({ name: name, kind: kind, type: "vec3", value: rest.slice(0, 3) });
      } else if (kind === "slider") {
        params.push({ name: name, kind: kind, type: "float", min: rest[0], max: rest[1], value: rest[2] !== undefined ? rest[2] : rest[0] });
      } else if (kind === "toggle") {
        params.push({ name: name, kind: kind, type: "float", value: rest[0] ? 1 : 0 });
      }
    });
    return params;
  }

  function uniformDecls(params) {
    return params.map(function (p) { return "uniform " + p.type + " " + p.name + ";"; }).join("\n") + "\n";
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map(function (c) {
      return Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0");
    }).join("");
  }
  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function mount(root) {
    if (root.dataset.shaderMounted) return;
    root.dataset.shaderMounted = "1";

    var canvas = root.querySelector("canvas");
    var srcEl = root.querySelector('script[type="x-shader/x-fragment"]');
    var objUrl = root.dataset.obj;
    if (!canvas || !srcEl || !objUrl) return;

    var wrap = document.createElement("div");
    wrap.className = "shader-canvas-wrap";
    canvas.parentNode.insertBefore(wrap, canvas);
    wrap.appendChild(canvas);

    var gl = canvas.getContext("webgl2", { antialias: true, alpha: false, depth: true });
    if (!gl) {
      showError(root, "This browser doesn't support WebGL2, so the demo can't run here.");
      return;
    }
    gl.enable(gl.DEPTH_TEST);

    var vs;
    try {
      vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    } catch (e) {
      showError(root, "Vertex shader (fixed, not user-editable) failed to compile:\n\n" + e.message);
      return;
    }

    // -- geometry: fetch + parse the .obj, fill a VAO once it's ready ----
    var vao = gl.createVertexArray();
    var vertexCount = 0;
    var meshReady = false;
    fetch(objUrl)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + objUrl);
        return r.text();
      })
      .then(function (text) {
        var mesh = parseObj(text);
        vertexCount = mesh.count;
        var interleaved = new Float32Array(mesh.count * 6);
        for (var i = 0; i < mesh.count; i++) {
          interleaved[i * 6 + 0] = mesh.positions[i * 3 + 0];
          interleaved[i * 6 + 1] = mesh.positions[i * 3 + 1];
          interleaved[i * 6 + 2] = mesh.positions[i * 3 + 2];
          interleaved[i * 6 + 3] = mesh.normals[i * 3 + 0];
          interleaved[i * 6 + 4] = mesh.normals[i * 3 + 1];
          interleaved[i * 6 + 5] = mesh.normals[i * 3 + 2];
        }
        var buf = gl.createBuffer();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        meshReady = true;
      })
      .catch(function (e) {
        showError(root, "Couldn't load " + objUrl + ":\n\n" + e.message);
      });

    // -- program state (recompilable) --------------------------------------
    var program = null;
    var locs = null;
    var params = [];

    function buildProgram(fragBody) {
      var newParams = parseParams(fragBody);
      var full = FRAGMENT_PRELUDE + uniformDecls(newParams) + fragBody;
      var fs = compile(gl, gl.FRAGMENT_SHADER, full);
      var prog = link(gl, vs, fs);
      return { prog: prog, params: newParams };
    }

    function applyProgram(built) {
      // preserve existing values for params that still exist (same name+kind)
      var old = {};
      params.forEach(function (p) { old[p.kind + ":" + p.name] = p.value; });
      built.params.forEach(function (p) {
        var key = p.kind + ":" + p.name;
        if (old.hasOwnProperty(key)) p.value = old[key];
      });
      program = built.prog;
      params = built.params;
      locs = {
        uView: gl.getUniformLocation(program, "uView"),
        uProj: gl.getUniformLocation(program, "uProj"),
        iResolution: gl.getUniformLocation(program, "iResolution"),
        iTime: gl.getUniformLocation(program, "iTime"),
        iMouse: gl.getUniformLocation(program, "iMouse"),
        uCameraPos: gl.getUniformLocation(program, "uCameraPos"),
        uLightDir: gl.getUniformLocation(program, "uLightDir"),
        params: {},
      };
      params.forEach(function (p) { locs.params[p.name] = gl.getUniformLocation(program, p.name); });
      renderParamPanel();
    }

    // -- pointer / camera state (declared before listeners use them) -----
    var mouse = [0, 0, 0, 0];
    var yaw = 0.5, pitch = -0.3, dist = 3.4;
    var dragging = false, lastX = 0, lastY = 0;

    canvas.addEventListener("pointerdown", function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY; mouse[2] = 1;
      canvas.setPointerCapture(e.pointerId);
    });
    window.addEventListener("pointerup", function () { dragging = false; mouse[2] = 0; });
    canvas.addEventListener("pointercancel", function () { dragging = false; });
    canvas.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      mouse[0] = (e.clientX - r.left) * (canvas.width / r.width);
      mouse[1] = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      yaw += dx * 0.008;
      pitch = Math.max(-1.4, Math.min(1.4, pitch - dy * 0.008));
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      dist = Math.max(1.6, Math.min(9.0, dist * Math.pow(1.001, e.deltaY)));
    }, { passive: false });

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    // -- clock: pause freezes iTime cleanly --------------------------------
    var startTime = performance.now();
    var totalPausedMs = 0, pauseStart = 0, paused = false;
    function elapsedSeconds(now) {
      var pausedMs = totalPausedMs + (paused ? now - pauseStart : 0);
      return (now - startTime - pausedMs) / 1000;
    }

    function drawFrame(now) {
      resize();
      if (!dragging) yaw += 0.0015; // gentle idle spin when the user isn't steering
      var t = elapsedSeconds(now);

      var eye = [
        dist * Math.cos(pitch) * Math.sin(yaw),
        dist * Math.sin(pitch),
        dist * Math.cos(pitch) * Math.cos(yaw),
      ];
      var view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
      var proj = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 50.0);
      var lightAngle = t * 0.15;
      var lightDir = normalize3([Math.sin(lightAngle) * 0.6 + 0.3, 0.8, Math.cos(lightAngle) * 0.6 + 0.2]);

      gl.clearColor(0.03, 0.03, 0.045, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      if (meshReady && program) {
        gl.useProgram(program);
        gl.uniformMatrix4fv(locs.uView, false, view);
        gl.uniformMatrix4fv(locs.uProj, false, proj);
        gl.uniform3f(locs.iResolution, canvas.width, canvas.height, 1.0);
        gl.uniform1f(locs.iTime, t);
        gl.uniform4f(locs.iMouse, mouse[0], mouse[1], mouse[2], mouse[3]);
        gl.uniform3f(locs.uCameraPos, eye[0], eye[1], eye[2]);
        gl.uniform3f(locs.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
        params.forEach(function (p) {
          var loc = locs.params[p.name];
          if (!loc) return;
          if (p.type === "vec3") gl.uniform3f(loc, p.value[0], p.value[1], p.value[2]);
          else gl.uniform1f(loc, p.value);
        });
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      }
      timeEl.textContent = t.toFixed(1) + "s";
    }

    var visible = true;
    function loop(now) {
      if (!visible || paused) return;
      drawFrame(now);
      requestAnimationFrame(loop);
    }
    new IntersectionObserver(function (entries) {
      var was = visible;
      visible = entries[0].isIntersecting;
      if (visible && !was && !paused) requestAnimationFrame(loop);
    }, { threshold: 0.01 }).observe(canvas);

    // -- toolbar ------------------------------------------------------------
    var bar = document.createElement("div");
    bar.className = "shader-toolbar";
    var playBtn = makeButton("⏸", "Pause");
    var resetBtn = makeButton("⟲", "Restart");
    var timeEl = document.createElement("span");
    timeEl.className = "shader-time";
    timeEl.textContent = "0.0s";
    var paramsBtn = makeButton("⚙", "Toggle parameters", "shader-btn-toggle");
    var codeBtn = makeButton("</>", "Toggle code editor", "shader-btn-toggle");
    var fsBtn = makeButton("⛶", "Fullscreen");
    [playBtn, resetBtn, timeEl, paramsBtn, codeBtn, fsBtn].forEach(function (el) { bar.appendChild(el); });
    wrap.appendChild(bar);

    playBtn.addEventListener("click", function () {
      var now = performance.now();
      paused = !paused;
      playBtn.textContent = paused ? "▶" : "⏸";
      playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
      if (paused) { pauseStart = now; } else { totalPausedMs += now - pauseStart; requestAnimationFrame(loop); }
    });
    resetBtn.addEventListener("click", function () {
      var now = performance.now();
      startTime = now; totalPausedMs = 0;
      if (paused) { pauseStart = now; drawFrame(now); }
    });
    fsBtn.addEventListener("click", function () {
      if (document.fullscreenElement === wrap) document.exitFullscreen();
      else if (wrap.requestFullscreen) wrap.requestFullscreen();
    });

    // -- parameter panel (created before the first compile, which populates it) --
    var paramPanel = document.createElement("div");
    paramPanel.className = "shader-panel shader-params";
    paramPanel.hidden = true;
    root.appendChild(paramPanel);

    function renderParamPanel() {
      paramPanel.innerHTML = "";
      if (params.length === 0) {
        var empty = document.createElement("p");
        empty.className = "shader-panel-empty";
        empty.textContent = "No // @param lines in this shader yet.";
        paramPanel.appendChild(empty);
        return;
      }
      params.forEach(function (p) {
        var row = document.createElement("label");
        row.className = "shader-param-row";
        var name = document.createElement("span");
        name.className = "shader-param-name";
        name.textContent = p.name;
        row.appendChild(name);

        if (p.kind === "color") {
          var input = document.createElement("input");
          input.type = "color";
          input.value = rgbToHex(p.value);
          input.addEventListener("input", function () { p.value = hexToRgb(input.value); });
          row.appendChild(input);
        } else if (p.kind === "slider") {
          var range = document.createElement("input");
          range.type = "range";
          range.min = p.min; range.max = p.max; range.step = (p.max - p.min) / 200 || 0.01;
          range.value = p.value;
          var readout = document.createElement("span");
          readout.className = "shader-param-value";
          readout.textContent = Number(p.value).toFixed(2);
          range.addEventListener("input", function () {
            p.value = parseFloat(range.value);
            readout.textContent = p.value.toFixed(2);
          });
          row.appendChild(range);
          row.appendChild(readout);
        } else if (p.kind === "toggle") {
          var check = document.createElement("input");
          check.type = "checkbox";
          check.checked = !!p.value;
          check.addEventListener("change", function () { p.value = check.checked ? 1 : 0; });
          row.appendChild(check);
        }
        paramPanel.appendChild(row);
      });
    }

    paramsBtn.addEventListener("click", function () {
      paramPanel.hidden = !paramPanel.hidden;
      paramsBtn.classList.toggle("shader-btn-active", !paramPanel.hidden);
    });

    // -- code editor panel --------------------------------------------------
    var codePanel = document.createElement("div");
    codePanel.className = "shader-panel shader-code";
    codePanel.hidden = true;

    var textarea = document.createElement("textarea");
    textarea.className = "shader-editor";
    textarea.spellcheck = false;
    textarea.value = srcEl.textContent.replace(/^\n/, "");

    var editorRow = document.createElement("div");
    editorRow.className = "shader-editor-row";
    var runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "shader-run-btn";
    runBtn.textContent = "Run ▶ (Ctrl+Enter)";
    var errorBox = document.createElement("pre");
    errorBox.className = "shader-editor-error";
    errorBox.hidden = true;

    editorRow.appendChild(runBtn);
    codePanel.appendChild(textarea);
    codePanel.appendChild(editorRow);
    codePanel.appendChild(errorBox);
    root.appendChild(codePanel);

    function runEditor() {
      try {
        var built = buildProgram(textarea.value);
        applyProgram(built);
        errorBox.hidden = true;
        errorBox.textContent = "";
      } catch (e) {
        errorBox.hidden = false;
        errorBox.textContent = e.message;
      }
    }
    runBtn.addEventListener("click", runEditor);
    textarea.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runEditor(); }
      if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "  "); }
    });

    codeBtn.addEventListener("click", function () {
      codePanel.hidden = !codePanel.hidden;
      codeBtn.classList.toggle("shader-btn-active", !codePanel.hidden);
    });

    // -- now that every panel exists, compile the shader authored in the post --
    try {
      applyProgram(buildProgram(srcEl.textContent));
    } catch (e) {
      showError(root, "Shader compile/link error:\n\n" + e.message);
      return;
    }

    requestAnimationFrame(loop);
  }

  function init() {
    document.querySelectorAll(".mesh-shader-embed").forEach(mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
