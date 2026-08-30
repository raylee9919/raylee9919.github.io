---
title: "Shader Lab: Parameters, Live Code, a Real Mesh"
date: 2026-08-31
description: "A real .obj mesh, a fragment shader you can rewrite in the browser, and sliders wired straight to uniforms."
tags: ["Graphics", "WebGL", "Shaders"]
categories: []
series: []
cover: "resources/cover.svg"
---

[Last time](/posts/webgl-raymarching/) everything on screen was implicit —
spheres that only ever existed as a `length(p) - r` some fragment shader
evaluated per pixel. That's a fine trick, but it isn't how you'd actually
put a *model* on screen. This one loads a real mesh from a plain `.obj`
file and rasterizes it — genuine vertex buffers, genuine triangles — and
wraps it in three things I wanted last time and didn't have: a parameter
panel, a live code editor, and a camera you can actually grab.

<div class="mesh-shader-embed" data-obj="resources/torus.obj">
  <canvas></canvas>
  <script type="x-shader/x-fragment">
// @param uAlbedo      color  0.85 0.45 0.20
// @param uRoughness   slider 0.05 1.0 0.35
// @param uRim         slider 0.0  4.0  1.40
// @param uShowNormals toggle 0

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(uLightDir);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), mix(4.0, 128.0, 1.0 - uRoughness));
    float rim  = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uRim;

    vec3 col = uAlbedo * (0.12 + diff) + vec3(spec) * 0.6 + rim * vec3(0.5, 0.7, 1.0) * 0.3;

    if (uShowNormals > 0.5) {
        col = N * 0.5 + 0.5;
    }

    col = pow(col, vec3(0.4545));
    fragColor = vec4(col, 1.0);
}
  </script>
  <p class="shader-caption">Drag to orbit, scroll to zoom. ⚙ opens the parameter sliders, &lt;/&gt; opens the code — try flipping uShowNormals, or just breaking something and hitting Run.</p>
</div>

## A real mesh this time

The `.obj` this loads (`resources/torus.obj`) is a low-poly torus I generated
— 162 vertices, 324 triangles, plain text. Nothing about the viewer knows
it's a torus, though: the loader just reads `v` (positions), `vn`
(normals), and `f` (faces, fan-triangulated if they're not already
triangles) — swap the file for any other `.obj` with per-vertex normals and
it draws that instead. That's the "arbitrary" part; the torus is just what
happens to be sitting in `resources/`.

Rasterizing it needs a stage raymarching never did: a **vertex shader**,
run once per vertex instead of once per pixel, whose only job is turning a
3D point into a clip-space one:

```glsl
uniform mat4 uView;
uniform mat4 uProj;
out vec3 vNormal;
out vec3 vWorldPos;

void main() {
    vWorldPos = aPosition;
    vNormal = aNormal;
    gl_Position = uProj * uView * vec4(aPosition, 1.0);
}
```

That stays fixed — not editable from the page. Live-patching the vertex
stage means live-patching what attributes exist and how the pipeline is
wired together, which is a much easier way to end up staring at a black
canvas than tweaking a fragment shader's math ever is. So the split is:
vertex stage fixed, geometry fixed, camera and lighting rig fixed — and the
*fragment* shader, the part that actually decides what the surface looks
like, is entirely yours.

## Parameters without a rebuild

Editing GLSL and hitting Run is one kind of iteration. Dragging a slider
while the frame keeps rendering is a faster one, and it needs the shader to
expose *something* to drag. I didn't want a separate config file or a
second language for that, so it's a comment pragma, parsed straight out of
the shader source on every compile:

```glsl
// @param uAlbedo    color  0.85 0.45 0.20
// @param uRoughness slider 0.05 1.0 0.35
// @param uShowNormals toggle 0
```

Each line does two things at once: declares a uniform (`uniform vec3
uAlbedo;`, spliced in above your code automatically — you never write the
`uniform` line yourself) and generates its control — a color swatch, a
range input, or a checkbox. Dragging a slider only touches a
`gl.uniform*` call each frame; it doesn't recompile anything. Adding or
renaming a `@param` line *does* need a Run, at which point the panel
rebuilds itself from whatever pragmas are left — and if a parameter's name
and kind survived the edit, its value survives too, so reworking the shader
around a slider doesn't reset it back to its default.

## Editing live, without losing the frame

Run (or `Ctrl`/`Cmd`+`Enter` in the editor) rebuilds the fragment shader
from the textarea and swaps it in — but only if it actually compiles and
links. A broken edit prints the GLSL compiler's own error into the panel
and leaves the *previous, working* program right where it was, still
rendering. Nothing here ever goes to a black screen because of a typo.

## Links

[Wavefront .obj format](https://en.wikipedia.org/wiki/Wavefront_.obj_file) — the loader here handles exactly the `v` / `vn` / `f` subset described there.
[Part 1: raymarching](/posts/webgl-raymarching/)
