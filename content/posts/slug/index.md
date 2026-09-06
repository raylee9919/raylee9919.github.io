---
title: "Making UE5 Slug Plugin"
date: 2026-09-01
description: "Slug for 3D text rendering"
tags: ["Unreal Engine", "Graphics", "Text Rendering"]
categories: []
cover: "resources/cover.png "
---

![Draft](resources/construction.png)
This is a draft.

# Problem

There are basically two ways to render 3D text in Unreal.

The first is placing a `UTextRenderActor` in the world. Under the hood, the actual rendering is handled by `UTextRenderComponent`, which generates text geometry from a font asset. One of the available font workflows uses offline-cached glyphs, meaning the glyphs are pre-rasterized into onto font atlases textures ahead of time. Here's the problem: the quality sucks.

![0](resources/0.png)

Just look at the emissive texts on the wall. Details are lost, and thin glyphs don't render correctly. It's intolerable. To get decent results, one must fight through a cryptic collection of options in the font asset, reimporting the font, check the result, and repeat until it looks "fine". It's an ad-hoc, time-consuming process, and it's especially annoying when you're trying to maintain a high visual standard while designing a level. 

Alternatively, you can draw `UWidgetComponent` in the world. It's crisp, but that has its own problem. A `UWidgetComponent` renders a Slate/UMG widget into a render target, which is then disdplayed as a surface in the world. Depending on its redraw settings, that widget may be rendered every frame. That's overkill, in my opinion, for a simple non-interactable piece of text. I don't want to pay the overhead of rendering every simple text element into a render target just to display it in the 3D world. If you have many pieces of text, maintaining a separate render target for each widget can make the approach even less attractive. 

![2](resources/2.png)

See the problem? There is no in-between. So, I decied to roll my own 3D text plugin. First, let's set the goals:

1. Preserve the detail of the original font
2. Render thin glyphs correctly
3. Faster than `UWidgetComponent`


# Slug

I learned about *Slug* at the *Better Software Conference 2026*. *Slug* is a GPU-based text-rendering technique that evaluates glyph outlines directly from Bézier curves at render time rather than relying on pre-rasterized glyph textures. This allows it to preserve fine details even when text is viewed at large sizes or from oblique angles.

Slug has been used commercially by major game studios, including *Ubisoft* and *Blizzard*. Its licensing status changed in 2026, making it possible for me to use the technology for this project. Instead of baking a glyph atlas ahead of time and hoping it survives whatever size and angle the text happens to be viewed at, I can evaluate the original vector outlines directly during rendering. Perfect.

<img src="resources/tunnel.jpg" style="width: 50%;">


# Where do I start?

Unreal Engine is indeed one gigantic codebase, and I had never really dug into its rendering pipeline before. I felt like it was finally time to step up and get a better grasp of Unreal's source code, and I found LLMs to be surprisingly helpful in getting me started. Because of their non-deterministic and speculative nature, I generally try to avoid relying on LLMs for programming. But in this case, all I needed was a starting point. For that, it turned out to be useful, and I've got to give credit to LLMs this time.