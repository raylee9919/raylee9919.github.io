---
title: "Space Fork"
date: 2025-05-11
draft: false
description: "A VR escape room where the puzzles are solved by writing real Python"
summary: "A VR escape room where you code your way out"
featured: true
tags:
  - Unity
  - VR
categories:
  - Games
link: "https://github.com/raylee9919/Space-Fork"
cover: "resources/cover.webp"
status: "completed"
---

## Overview

| Team | Duration | Stack |
|:-----------|:------------|:------------|
| 2  | May 2025 ~ Jun 2025 | Unity 2022.3 LTS, XR Interaction Toolkit, C# |

A **VR escape room** where the only tool you're given is a keyboard: every
puzzle is solved by typing real Python-flavored code into an in-world
terminal. You wake up on a malfunctioning spaceship with a chatty alien
companion, and have to `print`, `if`, and `for`-loop your way through five
systems before the ship — or the alien — runs out of patience.


## The Puzzle Progression

Each stage of the escape maps to one programming concept, evaluated by
matching against the code actually typed into the terminal:

- **Power On** — type `print("Hello World!")` to log in and bring the ship's
  lights back online
- **Oxygen Fix** — write a conditional (`if oxygen < 18` / `> 21`) to catch
  the ship's oxygen mix drifting out of a safe range
- **Dock Release** — a `for ... in range(5):` or `while` loop calling
  `release_bolt()` to cycle through the docking clamps
- **Fly Away** — call `navigate()` with a destination (Earth, Mars, or
  Jupiter) to set the ship's course
- **Escape** — brute-force the exit door's code with a `for i in
  range(10000): unlock(...)` loop, since guessing one number at a time won't
  cut it

The checker (`CodeEvaluator`) doesn't run the code — it's a lightweight
parser (`MiniPythonParser`) that validates brackets and required keywords
per stage, then pattern-matches the input against what that puzzle expects.
Good enough for a game, and it means the "interpreter" never has to sandbox
arbitrary code execution.


## An In-VR Keyboard That Behaves Like One

Typing in VR is normally miserable, so the terminal is built around MRTK's
non-native keyboard rather than the OS keyboard: selecting the `TMP_InputField`
pops the keyboard automatically and keeps it synced, a mirrored display
echoes keystrokes onto the ship's monitor prop in real time, and a dedicated
newline handler and Send button (with haptic feedback on press) round out
the loop of "type code → hit send → see the result."


## The Alien Companion

A `Rigidbody`-driven alien follows the player around the cabin — turning to
face them, closing distance when they wander off, and reacting (with sound
and a controller haptic pulse) if bumped into. Its dialogue is driven by a
small speech-bubble system (`DialogueManager`) that a `StepManager` state
machine cues at each stage transition, so the alien narrates the story beat
for beat instead of the escape room being puzzles in a vacuum.


## VR Comfort & Interaction

- Built on **XR Interaction Toolkit**'s action-based input, with snap-turn
  and continuous-turn both wired up and switchable from an in-game options
  menu (persisted via `PlayerPrefs`)
- Grab-and-throw physics interactions, a scene-transition fade, and a
  contextual hint system that pops instructions when the player lingers near
  a terminal
- Ships with **XR Device Simulator** support, so the whole escape room is
  playable — and testable — with just a mouse and keyboard, no headset
  required
- Built and tested standalone on an Android-based VR headset


## Team

A two-person project — level design, dialogue, and the puzzle/keyboard
systems were split and merged stage by stage, escape-room-style, right down
to the commit log (`"merge two keyboard files"`, `"Merge Sungwoo's
Dialogue"`).
