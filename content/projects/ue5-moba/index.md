---
title: "UE5 MOBA"
date: 2026-07-01
weight: 20
draft: false
description: "A MOBA combat prototype built on Unreal Engine 5's Gameplay Ability System"
summary: "A MOBA combat prototype built on GAS"
featured: true
tags:
  - UE5
  - GAS
categories:
  - Games
cover: "resources/cover.svg"
status: "in_progress"
---

## Overview

| Team | Duration | Stack |
|:-----------|:------------|:------------|
| Solo  | Jul 2026 ~  | UE5, C++, Gameplay Ability System |

A **MOBA combat prototype** built on Unreal Engine 5's **Gameplay Ability System (GAS)**, covering skillshots, a non-targeted ultimate, leveling, an item shop, and lane minions.


## Combat System

- Four distinct ability types built on GAS: basic attacks, montage-section-driven **combos**, a **line skillshot**, and a **non-targeted AoE ultimate**
- The combo chains into different montage sections and GameplayEffects depending on input timing, mapping each combo stage to its own damage table
- The **non-targeted ultimate (Blackhole)** runs a 4-stage casting sequence: an aiming montage → placement confirmed via `AbilityTask_WaitTargetData` → a pull-aura active for its duration → an area-of-effect finishing blow on end
- The skillshot's dedicated `TargetActor` reads the caster's `GenericTeamId` to automatically ignore its own team
- The camera is an **over-the-shoulder action camera** rather than a top-down MOBA view — aiming interpolates a separate spring-arm offset on entering/exiting aim mode


## Stats & Progression

- A GAS `AttributeSet` manages Health, Mana, Damage, Armor, Speed, Strength, and Intelligence as fully replicated attributes
- Strength and Intelligence each carry a separate **GrowthRate**, so stats scale automatically on level-up — the classic MOBA growth curve
- `ModifierMagnitudeCalculation` splits "based on base attack" vs. "based on level" damage formulas out of ability code, so balance changes only require swapping the calculation, not touching abilities
- Base stats and the per-level experience curve live in **data tables / curve tables**, so numbers can be tuned without recompiling


## Item Shop & Inventory

- A gold-based shop UI backed by an inventory component that applies gameplay effects to the ability system the moment a purchase completes
- Purchases go through a **Server RPC with `WithValidation`**, so the server has final say and client-side manipulation can't force an illegitimate purchase


## Lane Minions & AI

- A `Barrack` actor spawns minions per team on a timer, using object pooling and cycling through multiple spawn points to keep spawn cost bounded
- Minions perceive enemies autonomously via Behavior Tree + AI Perception (sight), writing detected targets to the blackboard and driving ability use from there
- Team affiliation (`GenericTeamId`) distinguishes friend from foe, and the same team data is reused for skillshot target filtering


## UI/HUD

- Hand-built MOBA-style HUD widgets: ability cooldown gauges, a level gauge, an overhead health bar, a crosshair, and stat gauges


## Current Status

Still a prototype — actively working through:

- Minion avoidance behavior not yet implemented
- Combo feel needs work
- Ragdoll response needs improvement
- Minions following the player too aggressively
- Texture flicker, likely a streaming/LOD issue
