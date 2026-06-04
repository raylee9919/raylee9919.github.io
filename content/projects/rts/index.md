---
title: "RTS"
date: 2023-12-01
draft: false
description: "RTS game/engine built from scratch"
summary: "RTS game/engine built from scratch."
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

{{< icon name="github" size="lg" >}} [GitHub](https://github.com/raylee9919/rts)
{{< icon name="youtube" size="lg" >}} [YouTube](https://www.youtube.com/playlist?list=PL4taYk3t6-W82PICQ04Ep9R1qkEBrM0Ol)

## Overview

A game engine written in C++17, featuring systems and functionalities focused on the RTS genre.

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