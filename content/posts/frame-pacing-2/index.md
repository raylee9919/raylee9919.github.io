---
title: "Timestep and Frame Pacing 2"
date: 2026-08-16
description: "It's a matter of time."
tags: ["System", "Game Engine"]
categories: []
series: ["Timestep and Frame Pacing"]
cover: "resources/cover.webp"
---

> This is a draft. Please take it with a grain of salt.

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

Let's say the system's scheduler was in a bad mood, and as a result,
`DeltaTime` comes out to 24.8ms. That's fine. We can simply move the character
forward by 24.8ms to keep the motion feeling natural. Let's integrate
`DeltaTime` into `Update`:

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
in instead of computing `DeltaTime` every frame? Genius! But there's a catch.


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
was, why not simply round it to fixed 16.67ms for a 60Hz monitor?

It helps, but doesn't fully solve the smoothness problem. We still can't know 
exactly when a frame will actually hit the screen, or how long it will stay 
there, in a thick-modern-pipelined stack:

![Modern_4](resources/modern_4.svg "It's a simplified diagram, actually.")

Your character moved for 16.67ms worth of distance, but by the time that frame
is displayed, 33.33ms have already elapsed. And what if this keeps happening?
You keep rendering as if 16.67ms have passed, but every frame you see is
already 33.33ms old. That's bad. 

All you have at hand is the display's refresh rate. What you additionally want
are these two:

1. Query past frames.
2. Schedule future frames.

With those two, you can build your own heuristic to smooth out the display
rate. Here's a rough sketch:

Start with a target framerate, say 60Hz. If a single frame misses its schedule,
lower the framerate to match that frame's actual display duration. For example,
if a frame was displayed across 2 VSync intervals on a 60Hz monitor, drop the 
framerate to 30Hz. Then, if $N$ successive frames could have been displayed 
earlier by a certain margin, adaptively bump the framerate back up. 

In *Vulkan*, there's the `VK_GOOGLE_display_timing` extension for exactly these
capabilities. Unfortunately, for some reason, it appears to be limited to
[certain
platforms](https://vulkan.gpuinfo.org/displayextensiondetail.php?extension=VK_GOOGLE_display_timing)
, and in *Direct3D*, there's no way to schedule frames. So the current
landscape remains unpleasant, especially considering that *Croteam*'s talk was
given 8 years ago.


## Updating Our Game Loop

Assuming everything is at out disposal, combined with our fixed-timestep
approach and "render tick", what would the updated game loop look like? I
assume it would look something like this:

```Pseudocode
while running {
    elapsed_time := compute_elapsed_time();
    accumulator  += elapsed_time;

    process_input();

    // Iterate with fixed-timestep dt
    while accumulator >= dt {
        // Ping-pong between indices 0 and 1.
        game_state[(i + 1) % 2] = tick(game_state[i], dt);
        i = (i + 1) % 2;

        accumulator -= dt;
    }

    // Compute 'framestep' and 'new_schedule' with our heuristic.
    query_frame_infos(pending_frames, frame_history);
    new_schedule := frame_timing_heuristics(pending_frames, frame_history);
    frame_step   := new_schedule - last_schedule;

    // 'game_state[2]' is reserved exclusively for rendering.
    new_render_state_timestamp := game_state[2].timestamp + frame_step;

    // How long should we tick more.
    render_tick_dt := new_render_state_timestamp - game_state[i].timestamp;

    // Tick state, render frame, and schedule display.
    if render_tick_dt > 0.0 {
        game_state[2] = tick(game_state[i], render_tick_dt);

        render_frame(game_state[2], new_schedule);

        frame_id := schedule_display(new_schedule);
        queue_add(pending_frames, frame_id);
        last_schedule = new_schedule;
    }
}
```

![Loop_1](resources/loop_1.svg "Hope this makes sense.")


### ...

So we're no longer using the remainder to "render tick". It's all theoretical
talk for now, so I should implement a proof of concept afterward. How far could
I go with *Direct3D*, though, I dunno.


## Links

[Alen Ladavac. "The Elusive Frame Timing"](https://medium.com/@alen.ladavac/the-elusive-frame-timing-168f899aec92)  
[Croteam. "The Elusive Frame Timing". GDC 2018](https://www.gdcvault.com/play/1025031/Advanced-Graphics-Techniques-Tutorial-The)  
[Croteam. "Myths and Misconceptions of Frame Pacing". Reboot Devlop Blue 2019](https://www.youtube.com/watch?v=_zpS1p0_L_o)  
[Intel. "Sample Application for Direct3D 12 Flip Model Swap Chains"](https://www.intel.com/content/www/us/en/developer/articles/code-sample/sample-application-for-direct3d-12-flip-model-swap-chains.html)  
[Android. "Frame Pacing Libary"](https://developer.android.com/games/sdk/frame-pacing)  
[Unity. "Fixing Time.deltaTime in Unity 2020.2 for smoother gameplay: What did it take?."](https://unity.com/blog/engine-platform/fixing-time-deltatime-in-unity-2020-2-for-smoother-gameplay)  
