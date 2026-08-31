---
title: "WebGL Shader Playground"
date: 2026-08-31
description: "Two tiny live WebGL demos: a raymarched SDF, and a real mesh with a fragment shader you can rewrite in the browser."
tags: ["Graphics", "WebGL", "Shaders"]
categories: []
series: []
cover: "resources/cover.svg"
---

Two minimal, live WebGL2 demos.

No mesh, no triangles — a *signed distance function* marched one step at a
time until it hits something:

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
  <p class="shader-caption">A unit sphere, raymarched — no vertices anywhere.</p>
</div>

And a real mesh — an actual `.obj`, actual vertex buffers — rasterized, with
a fragment shader you can rewrite live and sliders wired straight to its
uniforms:

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
  <p class="shader-caption">Drag to orbit, scroll to zoom. ⚙ opens the sliders, &lt;/&gt; opens the code.</p>
</div>

Everything else — soft shadows, ambient occlusion, cosine palettes, live
parameter pragmas, orbiting cameras — is just iteration on these same two
ideas: march a distance field, or rasterize real geometry.
