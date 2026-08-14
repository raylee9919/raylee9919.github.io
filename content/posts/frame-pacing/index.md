---
title: "Frame Pacing"
date: 2026-08-14
description: "VSync, frame pacing, .."
tags: ["System", "Graphics", "Game Engine"]
categories: []
series: []
---

This post is still being written.







                                Frame Pacing





It is no longer possible to match display's refresh rate precisely.

GPUs became more and more asynchronous. 

Frame pacing is the synchronization of a game’s logic and rendering loop with an OS’s display subsystem and the underlying display hardware
                                                                                                                        - Android


There was no process separation.
In early days, all processes wrote into a single framebuffer.
Apps should have make sure it didn't write into the occludede area.
The system notified the apps that they should repaint (WM_PAINT on Windows).
A single process could take down the whole system. No surprise.

Starting from early 2000s, systems began to let each process to write to its own 
framebuffer and those were composited afterwards. OS X's Quartz Compositor and 
Windows DWM (Desktop Windows Manager) are the example.

What's the downside? Well, it adds latency and is hungry for bandwidth.

-------------------------------------------------------------------------------
[App_0]

[App_1]

[App_2]

[Compositor]     Row_1 Row_2 Row_3 ..           Row1 Row2 ..

[Display 60Hz]         Row_1 Row_2 Row_3 .. Row_1080 Row1 Row2 ..
                       |         16.667ms          | 
-------------------------------------------------------------------------> time


Latency differs depending on when your input occurred, and where your mouse is at.
For example, mouse at the bottom of the screen has higher latency than that on 
the top of the screen.







                                Smooth Resizing

(Search for 'smooth resize' on HMN)

The prominent employee on Windows who's working on rendering said that they can't 
figure out how smooth resizing could be done. So, it is what it is, and just give 
up the smooth resizing. 









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

[1] The term VSync is kind of misunderstood. It is a signal sent through the 
video cable to inform the display to begin the scanout process. Yes, it is a 
real thing.

[2] The diagrams are kind of simplified in that the CPU pushes work to the GPU's 
queue, and they run asynchronously, but you get the idea.


// @Todo
So... why not just turn off VSync and call it a day? I can live with screen 
tearing.







1. If you delay the rendering carefully, you can incorporate fresher input 
into the frame, resulting in lower latency. For example, you can change this:


                     Input    Render                              
                     │   │              │                         
                     │◄─►│◄────────────►│                         
                  │  │   │              │              │          
                  ┼──┴───┴──────────────┴──────────────┼─────►time
                  │                                    │          
                VSync                                VSync        


                                into this:

                                                   
                                  Input    Render                  
                                  │   │              │             
                                  │◄─►│◄────────────►│             
                  │               │   │              │ │           
                  ┼───────────────┴───┴──────────────┴─┼─────►time 
                  │                                    │           
                VSync                                VSync         


But you are playing with fire, so to speak. What if your prediction is wrong, 
and you miss the deadline by a single bit? Something like this:


                                       Input    Render              
                                       │   │              │         
                                       │◄─►│◄───────────┬►│         
                   │                   │   │            │ │         
                   ┼───────────────────┴───┴────────────┼─┴───►time 
                   │                                    │           
                 VSync                                VSync         


Too bad! The train has left, so you'll have to wait for the next one. There are 
plenty of variables that determine how long rendering takes, and hitches are 
inevitable. So, it is really hard to predict the timing accurately.


2. Variable refresh rate (VRR) technology came to rescue! It effectively 
defers VSync until rendering is complete. However, many systems don't support it, 
and it can potentially disrupt other components, such as physics and audio.


3. Operating system's mouse cursor is often updated at the very last instant before 
VSync. Because of this, it can feel like the cursor is operating independently 
of the application's latency. To hide this effect, you might want to draw your 
own cursor instead. You can enable it only during interactive drag operations.

                                             
                                              OS overlays  
                                              its cursor.  
                                                   │       
                                                   │       
                  │  Render  │                     ▼ │     
          ────────┼──────────┼─────────────────────X─┤──────►time
                  │          │                       │     
                VSync                              VSync   




4. You can predict user input ahead of time. For drawing tools, I could see that 
being useful. But for games? I don't know about that.




                            Fullscreen vs Windowed


Windowed fullscreen is considered as fullscreen by compositors on modern OSes. 
So there's no point in providing 'fullscreen' option to the users.




'Windowed Flip' model was introduced in Windowws 7, and was available in DXGI 
starting from Windows 8. It is useful over "true" exclusive fullscreen. The 
compositor detects if your window covers the whole screen and if that's the 
case, it will decide not to compose, that is, additional copies skipped.

'Independent Flip' took one step further.
They basically gave the users more control of whether they want their windows
to skip the composition and write directly to the frame buffer. Downsides? I 
dunno. Maybe your window doesn't get frostglass effect behind other process's 
window, or you don't get softshadow, but who cares when you are playing a game?







                                    References

https://www.gafferongames.com/post/fix_your_timestep/
https://james.darpinian.com/blog/latency/
https://james.darpinian.com/blog/latency-techniques/
https://raphlinus.github.io/ui/graphics/gpu/2021/10/22/swapchain-frame-pacing.html
