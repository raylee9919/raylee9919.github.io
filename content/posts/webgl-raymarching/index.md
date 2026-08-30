---
title: "Raymarching: A Tiny WebGL Playground"
date: 2026-08-31
description: "Signed distance fields, marched one step at a time, live in your browser."
tags: ["Graphics", "WebGL", "Shaders"]
categories: []
series: []
cover: "resources/cover.svg"
---

I finally wired up live WebGL demos on this site, so let's use them for something
I've wanted to write about anyway: *raymarching*.

Rasterization (what [RHI](/projects/rhi/) and most game engines do) turns
triangles into pixels. Raymarching turns a *distance function* into pixels
instead — no mesh, no triangles, just math you can iterate on in a text
editor and see immediately. It's the whole premise behind [Shadertoy](https://www.shadertoy.com/)
and most of Inigo Quilez's work, and it's a great way to build intuition
about normals, shadows, and lighting without a rasterizer's plumbing in the
way.

## The idea

A *signed distance function* (SDF) `map(p)` takes a point in space and
returns the distance to the nearest surface — negative if `p` is inside
something. A sphere centered at the origin is the simplest possible one:

```glsl
float map(vec3 p) {
    return length(p) - 1.0; // distance to a unit sphere
}
```

To render it, march a ray forward from the camera. At each step, ask the
distance field "how far to the nearest surface from here?" and — this is the
whole trick — advance the ray by *exactly that much*. You can never
overshoot, because nothing is closer than the reported distance. Get close
enough to zero and you've hit the surface; step past some maximum distance
and you've hit open sky.

```glsl
float t = 0.0;
for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) { /* hit */ break; }
    if (t > 10.0)  { /* miss */ break; }
    t += d;
}
```

That's it — that's the whole algorithm. Everything else is shading. Here's
the sphere above, actually running:

<div class="shader-embed">
  <canvas></canvas>
  <script type="x-shader/x-fragment">
float map(vec3 p) {
    return length(p) - 1.0;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3(uv, -1.6));

    vec3 col = vec3(0.03, 0.03, 0.05);

    float t = 0.0;
    for (int i = 0; i < 64; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) {
            vec3 n = calcNormal(p);
            vec3 lightDir = normalize(vec3(sin(iTime * 0.5) * 0.8, 0.7, cos(iTime * 0.5) * 0.8));
            float diff = clamp(dot(n, lightDir), 0.0, 1.0);
            col = vec3(0.9, 0.55, 0.25) * (0.15 + diff);
            break;
        }
        if (t > 10.0) break;
        t += d;
    }

    col = pow(col, vec3(0.4545));
    fragColor = vec4(col, 1.0);
}
  </script>
  <p class="shader-caption">A single sphere, raymarched. The light direction drifts over time so you can see the shading move.</p>
</div>

## Normals for free

Rasterizers carry normals as vertex attributes. A distance field doesn't have
vertices at all, so instead we take the *gradient* of `map` at the hit point
— the direction it grows fastest — via central differences:

```glsl
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}
```

Six extra `map` evaluations per shaded pixel. Not free, but simple, and it
works for *any* distance field, however gnarly.

## Combining shapes, and getting fancier

Distance fields compose with plain scalar math. `min(d1, d2)` is a union —
whichever surface is closer wins:

```glsl
float map(vec3 p) {
    float d = sdPlane(p);
    d = min(d, sdSphere(p - vec3( 0.9, 0.0,  0.0), 0.55));
    d = min(d, sdSphere(p - vec3(-0.7, 0.15, 0.5), 0.4));
    return d;
}
```

`max(d1, -d2)` carves `d2` out of `d1`; `max(d1, d2)` intersects them. [Inigo
Quilez's distance function catalog](https://iquilezles.org/articles/distfunctions/)
is the reference for shapes beyond spheres and planes.

Two more tricks make the render actually read as a *scene* rather than a
flat-shaded blob:

**Soft shadows**, by marching a second ray toward the light and tracking how
close it ever grazes a surface along the way — not just whether it hits one:

```glsl
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    for (float t = mint; t < maxt; ) {
        float h = map(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += h;
    }
    return clamp(res, 0.0, 1.0);
}
```

`k` controls the penumbra's softness — this is [Quilez's soft-shadow
trick](https://iquilezles.org/articles/rmshadows/), and it costs nothing
extra beyond the marches you're already doing.

**Ambient occlusion**, approximated by sampling the field a few steps out
along the normal and checking how much closer a surface is than "empty space
would predict":

```glsl
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        occ += (h - map(p + n * h)) * sca;
        sca *= 0.7;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}
```

And for color, [Quilez's cosine palette
trick](https://iquilezles.org/articles/palettes/) — four `vec3`s (a
base, an amplitude, a frequency, and a phase) generate a smooth gradient from
one `cos` per channel:

```glsl
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.45, 0.5), b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0),  d = vec3(0.0, 0.1, 0.2);
    return a + b * cos(6.28318 * (c * t + d));
}
```

Put the union, soft shadows, AO, and palette together with a proper camera
basis instead of a hardcoded ray direction, and the same 64-line loop turns
into this:

<div class="shader-embed">
  <canvas></canvas>
  <script type="x-shader/x-fragment">
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdPlane(vec3 p) { return p.y + 1.0; }

float map(vec3 p) {
    float d = sdPlane(p);
    vec3 q = p - vec3(0.0, -0.35, 0.0);
    float c = cos(iTime * 0.6), s = sin(iTime * 0.6);
    q.xz = mat2(c, s, -s, c) * q.xz;
    d = min(d, sdSphere(q - vec3( 0.9, 0.0,  0.0), 0.55));
    d = min(d, sdSphere(q - vec3(-0.7, 0.15, 0.5), 0.40));
    d = min(d, sdSphere(q - vec3( 0.0,-0.15,-0.8), 0.35));
    return d;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    for (float t = mint; t < maxt; ) {
        float h = map(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += h;
    }
    return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        occ += (h - map(p + n * h)) * sca;
        sca *= 0.7;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.45, 0.5), b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0),  d = vec3(0.0, 0.1, 0.2);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.6, 3.2);
    vec3 target = vec3(0.0, -0.1, 0.0);
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + 1.6 * fwd);

    vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
    vec3 col = mix(vec3(0.02, 0.02, 0.04), vec3(0.10, 0.12, 0.18), smoothstep(-0.2, 0.6, rd.y));

    float t = 0.0;
    bool hit = false;
    for (int i = 0; i < 96; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.0008) { hit = true; break; }
        if (t > 20.0) break;
        t += d;
    }

    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        float diff = clamp(dot(n, lightDir), 0.0, 1.0);
        float shadow = softShadow(p + n * 0.002, lightDir, 0.02, 6.0, 16.0);
        float ao = calcAO(p, n);
        float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);

        vec3 base = palette(p.y * 0.6 + iTime * 0.05 + 0.3);
        col = base * (0.15 * ao + diff * shadow) + fres * 0.25;
        col = mix(col, vec3(0.02, 0.02, 0.04), 1.0 - exp(-0.05 * t * t));
    }

    col = pow(col, vec3(0.4545));
    fragColor = vec4(col, 1.0);
}
  </script>
  <p class="shader-caption">Three spheres orbiting over a plane: soft shadows, cheap ambient occlusion, a cosine palette, distance fog.</p>
</div>

## Mouse and time, together

Every canvas above already gets `iTime`. The runtime also fills in `iMouse`
— `.xy` is the last pointer position in pixels, `.z` is 1.0 while you're
clicking, and `.w` eases toward 1 while you're hovering and back to 0 once
you leave, instead of snapping. That eased `.w` is the useful one: blend it
into a shader with `mix()` and a demo reacts to hover with no click required,
and settles cleanly rather than popping to a default pose when the pointer
wanders off.

Here, camera azimuth auto-orbits from `iTime`, and hovering blends in a
mouse-driven offset on top — move your pointer left/right and up/down over
the canvas:

```glsl
float autoAz  = iTime * 0.12;
float mouseAz = (iMouse.x / iResolution.x - 0.5) * 6.2831853; // ± full turn
float az      = autoAz + mouseAz * iMouse.w;

float mouseEl   = iMouse.y / iResolution.y - 0.5;
float camHeight = 0.9 + mouseEl * 1.6 * iMouse.w;

vec3 ro = target + vec3(radius * sin(az), camHeight, radius * cos(az));
```

<div class="shader-embed">
  <canvas></canvas>
  <script type="x-shader/x-fragment">
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdPlane(vec3 p) { return p.y + 1.0; }

float map(vec3 p) {
    float d = sdPlane(p);
    d = min(d, sdSphere(p - vec3( 0.9, 0.0,  0.0), 0.55));
    d = min(d, sdSphere(p - vec3(-0.7, 0.15, 0.5), 0.40));
    d = min(d, sdSphere(p - vec3( 0.0,-0.15,-0.8), 0.35));
    return d;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    for (float t = mint; t < maxt; ) {
        float h = map(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += h;
    }
    return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        occ += (h - map(p + n * h)) * sca;
        sca *= 0.7;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.45, 0.5), b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0),  d = vec3(0.0, 0.1, 0.2);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float autoAz = iTime * 0.12;
    float mouseAz = (iMouse.x / iResolution.x - 0.5) * 6.2831853;
    float az = autoAz + mouseAz * iMouse.w;

    float mouseEl = iMouse.y / iResolution.y - 0.5;
    float camHeight = 0.9 + mouseEl * 1.6 * iMouse.w;

    vec3 target = vec3(0.0, -0.1, 0.0);
    float radius = 3.4;
    vec3 ro = target + vec3(radius * sin(az), camHeight, radius * cos(az));

    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + 1.6 * fwd);

    vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
    vec3 col = mix(vec3(0.02, 0.02, 0.04), vec3(0.10, 0.12, 0.18), smoothstep(-0.2, 0.6, rd.y));

    float t = 0.0;
    bool hit = false;
    for (int i = 0; i < 96; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.0008) { hit = true; break; }
        if (t > 20.0) break;
        t += d;
    }

    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        float diff = clamp(dot(n, lightDir), 0.0, 1.0);
        float shadow = softShadow(p + n * 0.002, lightDir, 0.02, 6.0, 16.0);
        float ao = calcAO(p, n);
        float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);

        vec3 base = palette(p.y * 0.6 + iTime * 0.05 + 0.3);
        col = base * (0.15 * ao + diff * shadow) + fres * 0.25;
        col = mix(col, vec3(0.02, 0.02, 0.04), 1.0 - exp(-0.05 * t * t));
    }

    col = pow(col, vec3(0.4545));
    fragColor = vec4(col, 1.0);
}
  </script>
  <p class="shader-caption">Same scene, orbiting camera. Auto-orbits from iTime; hover and move your pointer to steer.</p>
</div>

Notice the camera rig itself: `az` only ever feeds a `sin`/`cos` pair, and
`camHeight` is a plain offset — never coupled together — so there's no
gimbal-lock pose to worry about, whatever the mouse does.

## What it costs

Every pixel walks the loop independently, and every step re-evaluates the
*entire* scene's distance field — there's no broad-phase culling like a
BVH gives a real raytracer. That's fine for a handful of primitives at
canvas resolution; it stops being fine well before you'd want to raymarch,
say, a Nanite-sized scene. Complex SDF scenes (think the classic "Rendering
Worlds With Two Triangles" showcases) lean hard on cheap primitives, tight
bounding volumes around expensive sub-scenes, and marching in a lower-res
buffer before upsampling. Worth its own post at some point.

## How the embed works

All three canvases above are plain WebGL2: one full-screen triangle, your
fragment shader, and `iResolution` / `iTime` / `iMouse` uniforms filled in
every frame — Shadertoy's convention, minus the backend. The runtime
([`shader-canvas.js`](/js/shader-canvas.js)) compiles and links, and if
either fails, prints the GLSL compiler's own error message into the page
instead of leaving you looking at a black box. It pauses via
`IntersectionObserver` once a canvas scrolls off-screen, so a post full of
these doesn't quietly burn your battery in a background tab.

Each canvas also gets a small toolbar for free — pause/resume, restart,
fullscreen, and a running clock — with no extra markup in the post. Pausing
doesn't just stop drawing; it freezes `iTime` at exactly the value it had,
via a paused-time accumulator, so resuming picks the animation back up
instead of jumping. Restart snaps `iTime` back to zero, and while paused,
repaints one frame immediately so the reset is visible without having to
press play first.

[Part 2](/posts/webgl-mesh-lab/) puts a real mesh (an actual `.obj`, actual
vertex buffers) in this same kind of embed, plus a parameter panel and a
live code editor over the fragment shader.

## Links

[Inigo Quilez. "Distance Functions"](https://iquilezles.org/articles/distfunctions/)  
[Inigo Quilez. "Soft Shadows"](https://iquilezles.org/articles/rmshadows/)  
[Inigo Quilez. "Ambient Occlusion"](https://iquilezles.org/articles/nvscene2008/rwwtt.pdf)  
[Inigo Quilez. "Palettes"](https://iquilezles.org/articles/palettes/)  
[Shadertoy](https://www.shadertoy.com/)  
