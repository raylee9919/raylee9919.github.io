---
title: "Timestep and Frame Pacing 2"
date: 2026-08-16
description: "It's a matter of time."
tags: ["System", "Game Engine"]
categories: []
series: ["Timestep and Frame Pacing"]
cover: "resources/cover.webp"
---

> This is a draft. Take it with a grain of salt.

# Frame Pacing

> The synchronization of a game’s logic and rendering loop with an OS’s display
> subsystem and the underlying display hardware.


## Smoothness Isn't in the Eye of CPU

Last time, we decided to use a fixed simulation timestep to cover the entire
deltatime, decouple rendering from simulation, and use interpolation,
extrapolation, ticking, or whatever technique is appropriate. 

But is your delta time actually "correct"?

Back in 2018, *Croteam* (creators of *Serious Sam* and *The Talos Principle*) 
gave a [talk](https://www.gdcvault.com/play/1025031/Advanced-Graphics-Techniques-Tutorial-The) 
at GDC about a strange phenomenon surrounding frame stuttering. 

Surely there must have been a performance hitch somewhere, and the frame simply
missed its presentation deadline, right? We'd expect to see something like
this:

![Croteam_1](resources/croteam_1.svg "Blue frame had to be shown twice because the green fame missed its deadline.")

But here's the **elusive** part: no frame was ever shown twice. In fact, some 
frames were actually "faster" than expected.

Personally, I had a hard time understanding this, so for beginners like me,
let's break it down step by step. Here's a simple game loop:

```Pseudocode
while running {
    time_new   = now();
    delta_time = time_new - time_old;
    time_old   = time_new;

    state = update(delta_time);
    render(state);
}
```

Let's say the OS scheduler was in a bad mood, and as a result, `DeltaTime`
comes out to 24.8ms. That's fine. We can simply move the character forward by
24.8ms to keep the motion feeling natural. Let's integrate `DeltaTime` into
`Update`:

![Croteam_2](resources/croteam_2.svg)

Then the GPU renders to the buffer, and the display scans it out.

![Croteam_3](resources/croteam_3.svg)

So this is what wee see:

![Croteam_4](resources/croteam_4.svg)

Here's where the mismatch happens. What was the last frame we saw? This blue 
one:

![Croteam_5](resources/croteam_5.svg)

Given that the monitor runs at 60Hz, the interval between the times you see new 
frames is 16.67ms.

![Croteam_6](resources/croteam_6.svg)

Your brain expects the character in the green frame to have moved for 16.67ms 
since the previous one. But the game actually moved it by 24.8ms, because **it 
has no idea when the frames are displayed.**

![Croteam_7](resources/croteam_7.svg)

Wait, isn't the interval just a constant 16.67ms? Why don't we just plug that 
in instead of computing `DeltaTime` every frame?

Neat, but there's a catch.


## Modern Pipeline

OK, let's step up and face the *modern-asynchronously-pipelined-machinery*:

![Modern_1](resources/modern_1.svg "Imtimidating?")


Intimidating fo-sho. Let's focus on a single frame's lifetime:

![Modern_2](resources/modern_2.svg)


CPU submits work to the GPU and calls `Present()`, and the presentation is
queued. When the time comes to pop it at VSync, if the GPU workload has
finished, scanout begins and the frame is presented on your display. 

And we were looking at this part:

![Modern_3](resources/modern_3.svg)

The elapsed time between successive `Update()` calls measured 24.8ms, resulting 
in jitter due to its mismatch with the display refresh rate, and the question
was, why not simply align it down to fixed 16.67ms for a 60Hz monitor?

It helps, but doesn't fully solve the smoothness problem. We still can't know 
exactly when a frame will actually hit the screen, or how long it will stay 
there, in a thick stack like the one below:

![Modern_4](resources/modern_4.svg "It's a simplified diagram, actually.")

Your character moved for 16.67ms worth of distance, but by the time that frame
is displayed, 33.33ms have already elapsed. And what if this keeps happening?
You keep rendering as if 16.67ms have passed, but every frame you see is
already 33.33ms old. That's bad. 

All you have at hand is the display's refresh rate. What you want are these
two:

1. Query past frames.
2. Schedule future frames.








## Links

Why naively sampling the CPU clock causes jitter  
[Alen Ladavac. "The Elusive Frame Timing"](https://medium.com/@alen.ladavac/the-elusive-frame-timing-168f899aec92)  
[Croteam. "The Elusive Frame Timing". GDC 2018](https://www.gdcvault.com/play/1025031/Advanced-Graphics-Techniques-Tutorial-The)  
[Croteam. "Myths and Misconceptions of Frame Pacing". Reboot Devlop Blue 2019](https://www.youtube.com/watch?v=_zpS1p0_L_o)  

[Android. "Frame Pacing Libary"](https://developer.android.com/games/sdk/frame-pacing)  

[Unity. "Fixing Time.deltaTime in Unity 2020.2 for smoother gameplay: What did it take?."](https://unity.com/blog/engine-platform/fixing-time-deltatime-in-unity-2020-2-for-smoother-gameplay)  

[Akimitsu Hogge. Activision Central Technology. "Controller to display latency in Call of Duty"](https://www.gdcvault.com/play/1026327/)  

[Raph Levien. "Swapchains and frame pacing"](https://raphlinus.github.io/ui/graphics/gpu/2021/10/22/swapchain-frame-pacing.html)  

[Intel. Sample Application for Direct3D 12 Flip Model Swap Chains](https://www.intel.com/content/www/us/en/developer/articles/code-sample/sample-application-for-direct3d-12-flip-model-swap-chains.html)

[James Darpinian. "Techniques to Reduce Latency in Your Apps"](https://james.darpinian.com/blog/latency-techniques/)  

[John-Paul Ownby. "Syncing without VSync"](https://www.jpownby.com/index.php/2024/11/27/syncing-without-vsync/)  

[NVIDIA Reflex](https://developer.nvidia.com/performance-rendering-tools/reflex)  
