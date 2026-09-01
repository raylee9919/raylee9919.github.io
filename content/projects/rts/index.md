---
title: "RTS"
date: 2024-03-01
weight: 10
draft: false
description: "RTS game/engine built from scratch"
summary: "RTS game/engine built from scratch."
featured: true
tags:
  - C++17
  - OpenGL
categories:
  - Games
cover: "resources/cover.webp"
status: "in_progress"
link: "https://github.com/raylee9919/rts"
---

{{< youtube YSqlu97es8s >}}

---

{{< icon name="github" size="lg" >}} [GitHub](https://github.com/raylee9919/rts)
{{< icon name="youtube" size="lg" >}} [YouTube](https://www.youtube.com/playlist?list=PL4taYk3t6-W82PICQ04Ep9R1qkEBrM0Ol)

## Overview

| Team | Duration | Stack |
|:-----------|:------------|:------------|
| 1  | Mar 2024 ~ | C++17, OpenGL, GLSL |

A game engine written in C++17, featuring systems and functionalities focused on the RTS genre.

#pitch {
## Problem
General-purpose engines like Unity and Unreal abstract away the low-level
control a large-scale RTS needs — custom memory layout, deterministic collision
and pathfinding for hundreds of units, and a render pipeline built for
instanced battles rather than a handful of hero characters.

![RTS engine thumbnail](resources/cover.webp)

## Solution
Built the engine from scratch in C++17: a custom arena allocator and
SIMD-optimized math library at the core, Minkowski sum-based collision
detection with Delaunay-triangulation navmesh generation for movement, and a
PBR renderer (Cook-Torrance BRDF) with cascaded shadow mapping, instancing, and
multithreaded skeletal animation.

## Result
Still in progress — platform, asset, rendering, simulation, and UI systems are
up and running end-to-end. Follow along on
[GitHub](https://github.com/raylee9919/rts) or the [devlog
playlist](https://www.youtube.com/playlist?list=PL4taYk3t6-W82PICQ04Ep9R1qkEBrM0Ol).
}

## Key Features

#### Core

- Windows platform layer
- Custom memory management (arena allocator)
- SIMD-optimized math library

#### Asset System

- 3D asset import pipeline (FBX, glTF, ...)
- Texture import pipeline (PNG, JPG, ...)

#### Rendering

- Physically Based Rendering (Cook-Torrance BRDF)
- Multithreaded skeletal animation system
- Cascaded Shadow Mapping
- Instancing

#### Simulation

- Minkowski sum-based collision detection
- Navigation mesh generation based on Delaunay triangulation

#### UI

- Subpixel font rendering (ClearType)
- Multilingual support

## Dependencies

- stb-library
- ufbx
- meshoptimizer
- xxHash3
- Tracy
