---
title: "CDT"
date: 1900-01-01
draft: false
description: "제약 들루네 삼각분할 기하 라이브러리"
summary: "제약 들루네 삼각분할 기하 라이브러리"
featured: true
tags:
  - C
  - 계산 기하학
categories:
  - projects
cover: resources/cover.png
status: "completed"
link: "https://github.com/raylee9919/cdt"
---

{{< icon name="github" size="lg" >}} [GitHub](https://github.com/raylee9919/cdt)
{{< icon name="youtube" size="lg" >}} [YouTube](https://youtu.be/rr2v8cLD8So)

![GitHub Banner](resources/github.png "깃허브 스타 100개 달성")

## 개요

| 인원 | 기간 | 사용 기술 |
|:-----------|:------------|:------------|
| 1인  | 2025년 8월 ~ 2025년 11월 | C |

- 점진적 제약 들루네 삼각분할 (Incremental Constrained Delaunay Triangulation)  
- 단일 헤더 파일 C 라이브러리

## 자료구조 및 알고리즘

- **Quad-edge:** 정점, 엣지, 면의 인접 관계를 하나의 구조로 표현하여 효율적인 위상 순회를 지원
- **점진적 삽입:** 점을 하나씩 추가하며 포함된 삼각형을 분할하고 삼각분할을 갱신
- **엣지 플립:** 삽입으로 인해 들루네 조건이 깨진 엣지를 뒤집어 국소적으로 들루네 삼각분할을 복원


<details>
<summary>참고 문헌</summary>

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