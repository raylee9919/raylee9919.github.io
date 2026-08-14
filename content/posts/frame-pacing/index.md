---
title: "Frame Pacing"
date: 2026-08-14
description: "VSync, frame pacing, .."
tags: ["System", "Graphics", "Game Engine"]
categories: []
series: []
---

                            Swap Chain and VSync

If you were to scan out during the 3D rendering process of an app, you'd see a 
flickering half-drawn mess. This was acceptable when the workload was lighter 
as the main usage was 2D UI rendering.

That's when double buffering rose above the horizon. The display scans out the 
"front" buffer and the app scribbles on the "back" buffer. As the painting is 
done, app 'swaps' the buffers.

But what if the buffers get swapped during the scan out process? You'll see 
horizontal bands of different frames, which is known as 'tearing'. So there's 
an 'Vsync' option in regard to synchronization. The swap is deferred until 
the end of current scanout. 

Vsync adds latency of your input to be visually perceived by your eyes as the 
monitor completes the current scanout even if the game's frame conveying the 
input information is available.

At the same time, as there's no back buffer to which the app can write, incoming 
operations must be blocked. During this time, the app might want to do other 
useful stuffs, like simulating physics for the next timestep as the simultation 
would be frame rate independent for most of the games.

What would happen if the hardware runs twice as fast? One would think the latency 
would improve, which is wrong.

(prefixed with frame number)

                     Input2                                  Input3
                       |                                       |
          |            v                          |            v
          |----------|---|------------------------|----------|---|------------------------| 
          |  Render1                Slop1         |  Render2                Slop2
        Vsync                                   

 Back     |                Frame1                 |----------------Scanout1---------------|                Frame3                 |

Front     |----------------Scanout0---------------|                Frame2                 |----------------Scanout2----X----------|
                                                                                                                       ^
                                                                                                                       |
                                                                                                        Input2 appears somewhere near here.
                       |------------------------------------- Latency of Input2 ---------------------------------------|


Even if the hardware gets faster, interval between Vsyncs stays the same. The 
latency would actually get worse. Let's see a diagaram of where the hardware 
gets twice as fast to prove the point:


               Input2                                  Input3
                 |                                       |
          |      v                                |      v
          |-----|-|-------------------------------|-----|-|-------------------------------| 
          |Render1           Slop1                |Render2           Slop2
        Vsync                                   

 Back     |                Frame1                 |----------------Scanout1---------------|                Frame3                 |

Front     |----------------Scanout0---------------|                Frame2                 |----------------Scanout2----X----------|
                                                                                                                       ^
                                                                                                                       |
                                                                                                        Input2 appears somewhere near here.
                 |---------------------------------------- Latency of Input2 ------------------------------------------|
                       |------------------------------------- Latency Before ------------------------------------------|


One approach to this problem is 'triple buffering', which adds one more back buffer.


               Input2  Input3
                 |       |
          |      v       v                        |
          |-----|-|-----|-|-----------------------|-----|-|-----|-|-----------------------| 
          |Render1 Render2          Slop1         |Render3 Render4          Slop2
        Vsync                                   

 Back     |                Frame1                 |                Frame3                 |
 Back     |                Frame2                 |----------------Scanout2----x----------|
 Front    |----------------Scanout0---------------|                Frame4      ^          |
                                                                               |
                                                             Input2,3 appears somewhere near here.
                 |-------------------------------------------------------------|
                         |-----------------------------------------------------|
                                                Latency


If the monitor is running at 60Hz, then the latency is more or less 16.67ms, 
which is still a lot, given that humans can perceive differences in latency 
all the way down to much smaller numbers, like 1ms.

Nevertheless, the latency has been cut down significantly. Our machine does 
the work in advance, and the display simply scans out the newly rendered frame. 

The problem is, there's some waste. In the backbuffer, 'Frame1' gets overwritten 
by 'Frame3' because it's already outdated by the time 'Frame2' is scanned out 
by the display. In the context of gaming, where the GPU is busy anyway, ths is 
somewhat acceptable, but that's about as far as it goes.


Little bit of tangent: 

[1] VSync often refers to two "different" things: the option 
you can turn on and off in a GPU or game's settings, and the timing event when 
scanout starts/ends. My hatred streak against terminology continues.

[2] The diagrams are kind of simplified in that the CPU pushes work to the GPU's 
queue, and they run asynchronously, but you get the idea.
