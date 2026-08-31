---
title: "CDT"
date: 2025-08-01
draft: false
description: "제약 들루네 삼각분할 기하 라이브러리"
summary: "제약 들루네 삼각분할 기하 라이브러리"
featured: true
tags:
  - C
  - 계산 기하학
categories:
  - 도구 & 라이브러리
cover: resources/cover.png
status: "completed"
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

#### Quad-Edge

Guibas와 Stolfi의 quad-edge 구조를 사용한다. 하나의 기하학적 엣지를 4개의 레코드
(`e[0..3]`) 묶음 하나로 표현하는데, `e[0]`/`e[2]`는 그 엣지 자체(정방향·역방향),
`e[1]`/`e[3]`은 그 엣지의 **쌍대(dual)** — 즉 왼쪽·오른쪽 면에 대응하는 엣지다.

각 레코드가 들고 있는 건 딱 하나, 정점 주위를 도는 다음 엣지를 가리키는
`onext_ptr` 뿐이다. `rot`(쌍대로 회전), `sym`(반대 방향), `onext`/`oprev`(정점
기준 다음/이전), `lnext`/`lprev`(왼쪽 면 기준), `dnext`/`dprev`(도착점 기준) 같은
연산자들은 전부 이 하나의 포인터와 `idx`(0~3) 값의 산술 연산만으로 유도된다 —
포인터를 여러 개 들고 다니지 않고도 위상 관계 전체를 순회할 수 있는 이 구조 덕분에,
"엣지를 뒤집는다"는 것도 결국 몇 개의 `splice` 호출로 환원된다.

```c
struct cdt_quad_edge {
    cdt_vertex    *org;
    cdt_quad_edge *onext_ptr;
    uint8_t        idx;       // [0,3]
};
```

#### 기하 판정

두 가지 술어(predicate)가 알고리즘 전체를 떠받친다.

- **`orientation(a, b, c)`**: 삼각형의 부호 있는 넓이의 2배 — 세 점이 시계/반시계
  중 어느 방향으로 도는지, 그리고 한 점이 한 엣지의 좌/우 어느 쪽에 있는지를 이
  하나로 판별한다.
- **`in_circumcircle(p, a, b, c)`**: 점 `p`가 삼각형 `abc`의 외접원 안에 있는지 —
  이게 참이면 그 삼각형은 들루네 조건을 어긴 것이다.

두 판정 모두 단순 행렬식으로 구현했는데, 소스에는 Kallmann의 경고를 그대로 옮겨
적어 뒀다: "단순한 행렬식 평가만으로는 플립 과정에서 무한 루프에 빠지는 경우를
겪었다." Shewchuk의 강건한(robust) 술어를 쓰는 게 정답이지만, 아직은 `@Todo`로
남겨둔 상태 — 부동소수점 강건성은 계속 씨름 중인 문제다.

#### 점 위치 탐색

새 점을 삽입하려면 먼저 그 점을 포함한 삼각형을 찾아야 한다. 전체를 훑는 대신,
임의의 한 엣지에서 시작해 목표 지점 방향으로 삼각형을 하나씩 걸어서 넘어가는
"walking" 전략을 쓴다 — 현재 삼각형의 세 엣지 중 목표점이 바깥쪽(right-of)에
있는 엣지를 찾아 `sym`으로 건너편 삼각형으로 넘어가는 과정을 반복하고, 세 엣지
모두의 안쪽(left-of)에 들어오는 순간 종료한다.

#### 점진적 삽입과 들루네 복원

점을 하나 삽입하는 절차는 두 단계다.

1. **분할**: 점 위치 탐색으로 찾은 삼각형(혹은 엣지 위에 정확히 놓인 경우 그
   엣지)을 새 점 기준으로 부채꼴 모양으로 분할 — 삼각형 하나는 세 개로,
   엣지 위의 점이면 인접한 두 삼각형이 네 개로 나뉜다.
2. **복원**: 분할로 생긴 바깥쪽 엣지들을 스택에 넣고, 스택이 빌 때까지
   하나씩 꺼내며 반대편 정점이 그 엣지의 외접원 안에 들어오면(=들루네 조건
   위반) 뒤집고, 새로 생긴 두 엣지를 다시 스택에 넣는다 — 고전적인 **Lawson
   flip** 알고리즘. 단, 제약 엣지는 이 과정에서 절대 뒤집지 않는다.

#### 제약 선분 삽입

가장 흥미로운 부분. 제약 선분을 넣을 때 **새 엣지를 실제로 만들지 않는다.**
대신 그 가상의 선분과 교차하는 기존 엣지들을 순서대로 수집한 뒤, 각 교차
엣지를 감싸는 사각형이 볼록(convex)일 때마다 뒤집는다 — 뒤집을 때마다 교차
지점이 하나씩 사라지고, 결국 교차하는 엣지가 하나도 남지 않는 순간 그 선분의
경로는 이미 존재하는 엣지들의 사슬이 된다. 오일러 공식(V - E + F = 2)에 따르면
삼각분할의 엣지 개수는 변하지 않으므로, 새 메모리를 할당할 필요가 아예 없다.
경로가 완성되면 그 엣지들에 제약 ID를 매겨 표시하고, 이후의 모든 플립 연산은
이 ID를 확인해 제약 엣지를 건드리지 않는다. Sloan의 논문(참고문헌 참조)에
기술된 방식과 같은 접근이다.


<details markdown="1">
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
