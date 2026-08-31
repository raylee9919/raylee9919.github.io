---
title: "CDT"
date: 2025-08-01
draft: false
description: "Constrained Delaunay Triangulation library in C"
summary: "Constrained Delaunay Triangulation library in C"
featured: true
tags:
  - C
  - Computational Geometry
categories:
  - Tools & Libraries
cover: resources/cover.png
status: "completed"
---

{{< icon name="github" size="lg" >}} [GitHub](https://github.com/raylee9919/cdt)
{{< icon name="youtube" size="lg" >}} [YouTube](https://youtu.be/rr2v8cLD8So)

![GitHub Banner](resources/github.png "100+ stars on GitHub")

## Overview

| Team | Duration | Stack |
|:-----------|:------------|:------------|
| Solo  | Aug 2025 ~ Nov 2025 | C |

- Incremental Constrained Delaunay Triangulation
- Single-header C library


## Data Structures & Algorithms

#### Quad-Edge

Built on Guibas and Stolfi's quad-edge structure. A single geometric edge is
represented as one bundle of 4 records (`e[0..3]`): `e[0]`/`e[2]` are the
edge itself (forward and reverse), and `e[1]`/`e[3]` are its **dual** — the
edges corresponding to its left and right faces.

Each record carries exactly one thing: a pointer (`onext_ptr`) to the next
edge around its origin vertex. Every other operator — `rot` (rotate to the
dual), `sym` (reverse), `onext`/`oprev` (around the origin), `lnext`/`lprev`
(around the left face), `dnext`/`dprev` (around the destination) — is
derived purely from that one pointer plus an `idx` (0–3), via index
arithmetic. No extra pointers to carry around, and "flipping an edge" ends
up reducing to a handful of `splice` calls.

```c
struct cdt_quad_edge {
    cdt_vertex    *org;
    cdt_quad_edge *onext_ptr;
    uint8_t        idx;       // [0,3]
};
```

#### Geometric Predicates

Two predicates carry the whole algorithm.

- **`orientation(a, b, c)`**: twice the signed area of a triangle — tells
  you whether three points wind clockwise or counterclockwise, and by
  extension, which side of a line a point falls on.
- **`in_circumcircle(p, a, b, c)`**: whether point `p` lies inside triangle
  `abc`'s circumcircle — true means that triangle violates the Delaunay
  condition.

Both are implemented as plain determinants, and the source carries Kallmann's
warning verbatim: *"we have faced never-ending loops during the flipping
process when using only a simple determinant evaluation."* Shewchuk's robust
predicates are the real fix, but that's still an open `@Todo` — floating-point
robustness here is an ongoing fight, not a solved one.

#### Point Location

Inserting a point first requires finding which triangle contains it. Rather
than scanning everything, the library **walks** the triangulation: starting
from an arbitrary edge, it checks the current triangle's three edges for the
one the target point is *right of* (i.e. outside), crosses over it via `sym`
into the neighboring triangle, and repeats — terminating the moment the
target is *left of* all three edges.

#### Incremental Insertion & Delaunay Recovery

Inserting a point is a two-step process.

1. **Subdivide**: fan-triangulate the triangle found by point location (or,
   if the point lands exactly on an edge, the two triangles sharing it) around
   the new vertex — one triangle becomes three, or two become four.
2. **Recover**: push the newly-created outer edges onto a stack, and pop
   them one at a time until the stack is empty. Whenever the opposite
   vertex of a popped edge's neighboring triangle lies inside that edge's
   circumcircle — a Delaunay violation — flip it and push the two edges
   that border the resulting quadrilateral back onto the stack. This is the
   classic **Lawson flip** algorithm. Constrained edges are never flipped,
   full stop.

#### Constraint Recovery

The most interesting part. Inserting a constrained segment **never
allocates a new edge.** Instead, the library walks along the segment's path
collecting the existing edges that cross it, and flips each crossing edge
whenever the quadrilateral around it is convex — every flip removes one
crossing, until none remain and the segment's path is simply a chain of
edges that already exist. By Euler's formula (V − E + F = 2), a
triangulation's edge count never changes, so there's nothing new to
allocate. Once the chain is complete, those edges get tagged with the
constraint's ID, and every flip from then on checks that tag and leaves
constrained edges alone. This is the same approach described in Sloan's
paper (see references).


<details markdown="1">
<summary>References</summary>

- Anglada, M. V. *An Improved Incremental Algorithm for Constructing Restricted Delaunay Triangulations*.
- Bern, M. *Edge Insertion for Optimal Triangulations*.
- Chew, L. P. *Constrained Delaunay Triangulations*.
- Eberly, D. H. *Triangulation by Ear Clipping*.
- Devillers, O. *Walking in a Triangulation*.
- Deymen, M. *Efficient Triangulation-Based Pathfinding*.
- Guibas, L. J., & Stolfi, J. *Primitives for the Manipulation of General Subdivisions and the Computation of Voronoi Diagrams*.
- Kallmann, M. *Fully Dynamic Constrained Delaunay Triangulations*.
- Kallmann, M. *Path Planning in Triangulations*.
- Kallmann, M. *Star Vertices: A Simple Approach for Fast Point Location in Triangulations*.
- Knuth, D. E. *The Art of Computer Programming, Volume 1: Fundamental Algorithms*.
- Lawson, C. L. *Software for C1 Surface Interpolation*.
- Held, M. *An Engineering Approach to the Reliable and Efficient Computation of Voronoi Diagrams of Points and Line Segments*.
- Mäntylä, M. *An Introduction to Solid Modeling*.
- Mücke, E. P., Saias, I., & Zhu, B. *Fast Randomized Point Location Without Preprocessing in Two- and Three-Dimensional Delaunay Triangulations*.
- Devillers, O. *On Deletion in Delaunay Triangulations*.
- Shewchuk, J. R. *Adaptive Precision Floating-Point Arithmetic and Fast Robust Geometric Predicates*.
- Shewchuk, J. R. *Engineering a 2D Quality Mesh Generator and Delaunay Triangulator*.
- Shewchuk, J. R. *Fast Segment Insertion and Incremental Construction of Constrained Delaunay Triangulations*.
- Sloan, S. W. *A Fast Algorithm for Constructing Delaunay Triangulations in the Plane*.
- Sloan, S. W. *A Fast Algorithm for Generating Constrained Delaunay Triangulations*.
- Goodman, J. E., O'Rourke, J., & Tóth, C. D. (Eds.). *Handbook of Discrete and Computational Geometry* (3rd ed.).

</details>
