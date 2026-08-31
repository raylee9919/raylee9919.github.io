---
title: "WebGL 셰이더 놀이터"
date: 2026-08-31
description: "두 개의 작은 라이브 WebGL 데모: 레이마칭 SDF, 그리고 브라우저에서 바로 고쳐 쓰는 프래그먼트 셰이더가 달린 실제 메시."
tags: ["Graphics", "WebGL", "Shaders"]
categories: []
series: []
cover: "resources/cover.svg"
---

작고 살아있는 WebGL2 데모 두 개.

메시도, 삼각형도 없다 — 무언가에 닿을 때까지 한 걸음씩 행진하는 **signed distance function** 뿐:

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
  <p class="shader-caption">단위 구를 레이마칭한 것 — 정점은 어디에도 없다.</p>
</div>

그리고 실제 메시 — 진짜 `.obj`, 진짜 버텍스 버퍼 — 를 래스터화하고, 프래그먼트 셰이더는 브라우저에서 바로 고쳐 쓸 수 있으며, 슬라이더는 uniform에 곧바로 연결된다:

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
  <p class="shader-caption">드래그로 회전, 스크롤로 줌. ⚙ 는 슬라이더 패널을, &lt;/&gt; 는 코드 에디터를 연다.</p>
</div>

나머지 — 소프트 섀도우, 앰비언트 오클루전, 코사인 팔레트, 실시간 파라미터 프래그마, 궤도 카메라 — 는 전부 이 두 아이디어 위에서의 반복일 뿐이다: 거리장을 행진시키거나, 실제 지오메트리를 래스터화하거나.
