---
title: "RTS"
date: 2024-03-01
weight: 10
draft: false
description: "RTS 게임 엔진"
summary: "RTS 장르에 초점을 둔 게임 및 엔진"
featured: true
tags:
  - C++17
  - OpenGL
categories:
  - 게임
cover: "resources/cover.webp"
status: "in_progress"
link: "https://github.com/raylee9919/rts"
---

{{< youtube YSqlu97es8s >}}

---

{{< icon name="github" size="lg" >}} [GitHub](https://github.com/raylee9919/rts)
{{< icon name="youtube" size="lg" >}} [YouTube](https://www.youtube.com/playlist?list=PL4taYk3t6-W82PICQ04Ep9R1qkEBrM0Ol)

## 개요

| 인원 | 기간 | 사용 기술 |
|:-----------|:------------|:------------|
| 1인  | 2024년 3월 ~  | C++17, OpenGL |

RTS 장르에 초점을 둔 게임 엔진

## 문제 해결

#slideshow {
    : align = "cc" {
        # 메모리 관리
    };

    문제 {
        C++ 표준 라이브러리 사용 시 다음과 같은 문제 존재:

        - <span class="hl">수천~수만 개의 malloc·free 호출</span>로 인한 높은
          오버헤드
        - 스마트 포인터 레퍼런스 카운터 갱신 시 <span class="hl">캐시 라인 독점
          비용</span> 발생
        - 다수의 실패 가능 지점 및 OS의 개입으로 인한 <span class="hl">성능
          편차</span>

        따라서, 직접 메모리 자료구조 작성.
    };

    해결 {
        Windows `VirtualAlloc()`으로 페이지 단위 메모리를 예약하고, 스택
        포인터 이동만으로 주소를 반환하는 <span class="hl">Arena 할당자</span> 구현.

        ![memory_1](resources/memory_2.svg)
    };

    해결 {
        수명이 한 프레임으로 정해지는 객체들을 한데 묶어, 매 프레임 시작 시
        할당자를 통째로 초기화. 할당·해제 호출을 <span class="hl">N번 → 1번</span>으로 상수화.

        ![memory_2](resources/memory_1.svg)
    };

    해결 {
        할당했던 블록을 재사용할 수 있는 <span class="hl">Free List·Pool</span>을
        구현해 할당·해제 오버헤드 감소.

        ![memory_3](resources/memory_3.svg)
    };

    결과 {
        malloc·free 대비 <span class="hl">렌더링 데이터 처리</span>와
        <span class="hl">개체 관리</span> 모두 개선:

        | µs/frame | malloc·free | Arena·Pool |
        |:-----------|:------------|:------------|
        | 렌더링  | 106.12  | 14.88 |
        | 개체 관리  | 31.29  | 23.99 |
    };
};

#slideshow {
    : align = "cc" {
        # 대규모 렌더링
    };

    문제 {
        100 vs 100을 시작으로 전투 규모를 확장하며 프레임 드랍 발생.

        ![mass_1](resources/mass_1.svg)
    };

    해결 {
        CPU와 GPU 프로파일러로 원인 분석 후, <span class="hl">그래픽스 디버거</span>로
        Shadow Pass의 <span class="hl">지오메트리 셰이더</span> 단계의 낮은 병렬성
        확인. 단순한 반복 렌더링으로 전환해 <span class="hl">15ms → 9ms</span>로 개선.

        ![mass_3](resources/mass_3.png)
    };

    해결 {
        행렬 업데이트용 GPU 메모리를 게임 종료 시까지 CPU에 매핑해 매 프레임
        <span class="hl">Map/Unmap·Fence 동기화 비용 제거</span>.
        <span class="hl">4x4 → 3x4 행렬 압축</span>으로 업로드 대역폭도 개선.

        ![mass_2](resources/mass_2.svg)
    };

    해결 {
        CPU 애니메이션 업데이트는 단위 간 의존성이 없어 <span class="hl">parallel
        for</span>로 병렬 처리, 동기화 비용도 최소화.

        ```cpp
        template <typename F>
        void ParallelFor(Thread_Group& group, int64_t count, F&& func);
        ```

        ![mass_2](resources/mass_2.png)
    };

    결과 {
        1000 vs 1000에서 60 FPS 달성.

        |  | 전 | 후 |
        |:-----------|:------------|:------------|
        | 드로우 콜 수 | 10,000  | 30 |
        | Shadow Pass  | 15ms  | 9ms |
        | 600 vs 600 | 30 FPS  | 100 FPS |
        | 1000 vs 1000 | ---  | 60 FPS |
    };
};

#slideshow {
    : align = "cc" {
        # 경로탐색
    };

    문제 {
        RTS의 필수 요소인 <span class="hl">경로 탐색</span> 구현을 위해
        <span class="hl">삼각분할 알고리즘</span> 관련 코드 필요. 오픈 소스
        라이브러리 사용을 고민하여 다음과 같은 문제 발생:

        - 장애물 파괴를 위한 <span class="hl">삭제</span> 연산 미지원
        - 지진 시뮬레이션 등이 주 목적인 <span class="hl">무거운 코드</span>

        이에 따라 기하 라이브러리를 직접 작성.
    };

    해결 {
        다음과 같은 과정으로 알고리즘 구현.

        1. <span class="hl">들루네 삼각분할</span>(CDT)로 NavMesh 생성.
        2. <span class="hl">A*</span>을 통해 경로 산출.
        3. <span class="hl">Simple Stupid Funnel</span> 알고리즘으로 경로 단순화.

        ![navmesh_2](resources/navmesh_2.svg)
    };

    결과 {
        {{< youtube l7omM1djkAk width="640" >}}
    };

    결과 {
        타 유명 라이브러리들 대비 빠른 빌드 시간과 수행 시간, 삭제 연산 확보.

        |            |     자체개발        |    CGAL         | Triangle |
        |:-----------|:------------|:------------|-------------|
        | 빌드 시간 (ms) | <span class="hl">748</span>  | 17,805 |  3,894 |
        | 삭제 연산      |  <span class="hl">O</span>  |  O  |  X  |
        | 수행 시간 (ms) | <span class="hl">1.94</span>  | 1.82 | 3.84 |
    };

    결과 {
        코드를 [GitHub](https://github.com/raylee9919/cdt)에 배포하여 100여 개의 스타 획득.

        ![navmesh_1](resources/navmesh_1.png)
    };
};