---
title: "Timestep and Frame Pacing 2"
date: 2026-08-16
description: "It's a matter of time."
tags: ["System", "Game Engine"]
categories: []
series: ["Timestep and Frame Pacing"]
cover: "resources/cover.webp"
---

> Working on it.

# Frame Pacing

> Frame pacing is the synchronization of a game’s logic and rendering loop 
with an OS’s display subsystem and the underlying display hardware - Android

## Smoothness Isn't in the Eye of Your Game

We decoupled our simulation from rendering and fixed its timestep last time. 
But is your rendering delta time "correct"?

Back in 2018, *Croteam* (creators of *Serious Sam* and *The Talos Principle*) 
gave a [talk](https://www.gdcvault.com/play/1025031/Advanced-Graphics-Techniques-Tutorial-The) 
at GDC about a strange phenomenon surrounding frame stuttering. 

Surely there must have been a performance hitch somewhere, and the frame 
simply missed its presentation deadline, right? We'd expect to see something 
like this:

![Croteam_1](resources/croteam_1.svg "Blue frame had to be shown twice because the green fame missed its deadline.")

But here's the **elusive** part: no frame was ever shown twice. In fact, some 
frames were actually "faster" than expected.

Let's break it down. Here's a simple game loop:

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

Suppose there's a hitch, and `DeltaTime` comes out to 24.8ms. That's fine. We 
can simply move the character forward by 24.8ms to keep the motion feeling 
natural. Let's integrate `DeltaTime` into `Update`:

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
had no idea when the previous frame was displayed and when the current frame 
will be displayed**.

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

This was what we were seeing before, so my point still stands: we can just 
use a fixed 16.67ms.

### Throughput and Latency

Good news. your hardware just got 2x faster. Technology! 

![Modern Stack 3](resources/modern_3.svg)

Time to talk about input latency. How long does it take for my mouse input to 
be reflected in a frame and shown on my monitor? it depends on where your mouse 
it on your screen, as the display scans the buffer line by line, but it would 
be something like this:

![Modern Stack 4](resources/modern_4.svg)

As we extra powerful machinery and more leeway, can't we make use of it? What 
if we render one more time? Like this:

![Modern Stack 5](resources/modern_5.svg)

And as it incorporates more hot inputs, if we present it instead, the input 
latency would improve:

![Modern Stack 6](resources/modern_6.svg)

What we're doing here is *triple buffering*:

![Modern Stack 7](resources/modern_7.svg "Three buffers are colored red, blue, and green.")

During the first VSync interval, the green and blue buffers are *back buffers*, 
while the red buffer is the *front buffer*. During this interval, while the 
GPU renders into the back buffers, the display scans out the front buffer line 
by line, allowing you to see it. 

Beginning of the second interval, the buffers are "flipped". Since the blue 
buffer contains an older frame than the green buffer, the green buffer now 
becomes the front buffer, which again, scanned out by the display.

> This is what Windows DXGI flip discard mode is. It queues "flips" and discards 
old ones.



Game ticks on the CPU and submits draw commands to the GPU through driver. 
Then, the GPU gets gets to work and renders to the app's render target. We 
aren't halfway through it yet. Let's say your monitor is running at 60Hz. Then, 
for 16.67ms, operating system's compositor composites all the windows on your 
screen. Who doesn't love liquid glass and shadow effects? Finally, at VSync, 
the composited frame is presented to the monitor, which scans it out line by 
line.

![Drop Shadow](resources/shadow.png "Look at that sleek shadow!")





## Acknowledgements

[Croteam. "The Elusive Frame Timing". GDC 2018](https://www.gdcvault.com/play/1025031/Advanced-Graphics-Techniques-Tutorial-The)  
[Unity. "Fixing Time.deltaTime in Unity 2020.2 for smoother gameplay: What did it take?."](https://unity.com/blog/engine-platform/fixing-time-deltatime-in-unity-2020-2-for-smoother-gameplay)  
[Android. "Frame Pacing Libary"](https://developer.android.com/games/sdk/frame-pacing)  
[Raph Levien. "Swapchains and frame pacing"](https://raphlinus.github.io/ui/graphics/gpu/2021/10/22/swapchain-frame-pacing.html)  
[Intel. Sample Application for Direct3D 12 Flip Model Swap Chains](https://www.intel.com/content/www/us/en/developer/articles/code-sample/sample-application-for-direct3d-12-flip-model-swap-chains.html)
[James Darpinian. "Techniques to Reduce Latency in Your Apps"](https://james.darpinian.com/blog/latency-techniques/)  




# Temporary

In Windows, there's something called *exclusive fullscreen mode*. This mode 
allows your app to  bypass the compositor. If your app is in fullscreen, there's 
nothing else to composite, right? So the timeline becomes something like this:

![Frame Pacing 3](resources/fp3.svg)

> Compositor, swap chain and flip modes are yet another rabbit hole, 
and we'll get into them later.



We can do some statistical voodoo and somehow predict how long rendering 
will take, then defer rendering and complete just before VSync. That'll give us 
the best latency without wasting resources.

![Buffering 4](resources/4.svg)

