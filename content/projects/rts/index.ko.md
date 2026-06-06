---
title: "RTS"
date: 2023-12-01
draft: false
description: "RTS 게임 엔진"
summary: "RTS 장르에 초점을 둔 게임 및 엔진"
featured: true
tags:
  - C++17
  - OpenGL
categories:
  - projects
cover: images/project-rts.png
status: "in_progress"
link: "https://github.com/raylee9919/rts"
---

{{< youtube YSqlu97es8s >}}

---

{{< icon name="github" size="lg" >}} [GitHub](https://github.com/raylee9919/rts)
{{< icon name="youtube" size="lg" >}} [YouTube](https://www.youtube.com/playlist?list=PL4taYk3t6-W82PICQ04Ep9R1qkEBrM0Ol)

## 개요

| 인원 | 기간 | 사용 기술 |
|:-----------|:------------|:------------|
| 1인  | 2023년 12월 ~  | C++17, OpenGL, GLSL |

RTS 게임 및 이를 위한 기능을 구현한 엔진


## 주요 기능

#### 코어

- Windows 레이어
- 커스텀 메모리 관리 (아레나 할당자)
- SIMD 최적화 수학 라이브러리

#### 에셋 시스템

- 3D 에셋 임포트 파이프라인 (FBX, glTF, …)
- 텍스처 임포트 파이프라인 (PNG, JPG, …)

#### 렌더링

- Cook-Torrance BRDF
- 멀티스레드 스켈레탈 애니메이션
- 캐스케이디드 섀도 맵
- 인스턴싱

#### 시뮬레이션

- 민코프스키 합 기반 충돌 감지
- 들루네 삼각분할 기법 기반 내비메시 생성

#### UI

- 서브픽셀 폰트 렌더링 (ClearType)
- 다국어 지원


## 의존성

- stb-library
- ufbx
- meshoptimizer
- xxHash-3
- tracy