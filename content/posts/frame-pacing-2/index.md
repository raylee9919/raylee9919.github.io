---
title: "Timestep and Frame Pacing 2"
date: 2026-08-16
description: "It's a matter of time."
tags: ["System", "Game Engine"]
categories: []
series: ["Timestep and Frame Pacing"]
cover: "resources/cover.webp"
---

> I'm Working on it. DO NOT READ IT. DO NOT BELIEVE IT.

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

```C
float TimeOld = Now();
while (GameRunning) {
    float TimeNew = Now();
    float DeltaTime = TimeNew - TimeOld;
    TimeOld = TimeNew;

    State = Update(DeltaTime);
    Render(State);
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
had no idea when the previous frame was displayed.**

![Croteam_7](resources/croteam_7.svg)

Wait, isn't the interval just a constant 16.67ms? Why don't we just plug that 
in instead of computing `DeltaTime` every frame?




## Asynchrony and Middleman

### Old Days

In good old days, things were fixed. Graphics hardware was either thin or 
nonexistent, and there were no pipelines. Things were synchronous, and there 
was no middleman between your game and the display. The game simply wrote into 
the buffer, which was then presented to you immediately. So, you could just 
plug in 16.67ms, or whatever the display's refresh interval happened to be. 

![Modern Stack 1](resources/modern_1.svg)

### GPU

Here comes every gamer's favorite hardware: GPU.

![Modern Stack 2](resources/modern_2.svg)

This was what we were seeing before, and my question is still unanswered: why
not use fixed 16.67ms? But, let's continue.














It's a tradeoff. Present queue filling up entirely causes the delay to stack up.

So, how do I get the timestamp of when the frame is actually displayed?

## Hello, Windows Devs

D3DKMTGetScanLine and friends are kind of useless nowadays.

DwmGetCompositionTimingInfo

Nowadays I suggest to not do any manual sleeping but instead use all those
fancy new swapchain timing APIs.

Convert SyncQPC units to seconds for rdtsc ticks, add refresh interval, and 
now you known when the current frame will be displayed more accurately than 
sampling the time after WaitForSingleObject(waitable_timer).

You can round it to nearest multiple of monitor framerate and that will give 
you "perfect" frame pacing.

OpenGL's `SwapBuffers()` queues presentation and buffer swapping command to 
driver queue. Whether it will actually wait or not depens on driver. Often 
drivers block on next gl call, not always in `SwapBuffers()`. What you really 
want is frame latency waitable object, which OpenGL doesn't have.

You would want "present frame at timestamp X" kind of present call, which 
Direct3D doesn't have. Vulkan has extension for that, which is only available 
on Android, AFAIK.

So, use `IDXGISwapChain2::GetFrameLatencyWaitableObject` instead of sleeping
manually.

On Windows, you can call
[IDXGISwapChain::GetFrameStatistics()](https://learn.microsoft.com/en-us/windows/win32/api/dxgi/nf-dxgi-idxgiswapchain-getframestatistics),
which fills in
[DXGI_FRAME_STATISTICS](https://learn.microsoft.com/en-us/windows/win32/api/dxgi/ns-dxgi-dxgi_frame_statistics).






## Links

Why naively sampling the CPU clock causes jitter  
[Alen Ladavac. "The Elusive Frame Timing"](https://medium.com/@alen.ladavac/the-elusive-frame-timing-168f899aec92)  
[Croteam. "The Elusive Frame Timing". GDC 2018](https://www.gdcvault.com/play/1025031/Advanced-Graphics-Techniques-Tutorial-The)  
[Croteam. "Myths and Misconceptions of Frame Pacing". Reboot Devlop Blue 2019](https://www.youtube.com/watch?v=_zpS1p0_L_o)  

How *Unity* restructured its code to tackle jitter  
[Unity. "Fixing Time.deltaTime in Unity 2020.2 for smoother gameplay: What did it take?."](https://unity.com/blog/engine-platform/fixing-time-deltatime-in-unity-2020-2-for-smoother-gameplay)  

[Android. "Frame Pacing Libary"](https://developer.android.com/games/sdk/frame-pacing)  

[Akimitsu Hogge. Activision Central Technology. "Controller to display latency in Call of Duty"](https://www.gdcvault.com/play/1026327/)  

Explanation of *DXGI_FRAME_STATICS* fields  
[John-Paul Ownby. "Syncing without VSync"](https://www.jpownby.com/index.php/2024/11/27/syncing-without-vsync/)  




[Raph Levien. "Swapchains and frame pacing"](https://raphlinus.github.io/ui/graphics/gpu/2021/10/22/swapchain-frame-pacing.html)  

[Intel. Sample Application for Direct3D 12 Flip Model Swap Chains](https://www.intel.com/content/www/us/en/developer/articles/code-sample/sample-application-for-direct3d-12-flip-model-swap-chains.html)

[James Darpinian. "Techniques to Reduce Latency in Your Apps"](https://james.darpinian.com/blog/latency-techniques/)  

[NVIDIA Reflex](https://developer.nvidia.com/performance-rendering-tools/reflex)  



## Questions

How do I know if VSync is on/off programmatically?
