---
title: "재사용 가능한 설계"
date: 2026-06-13
description: "API 디자인에 대한 기준 몇 가지를 다룬다."
tags: ["프로그래밍", "설계"]
categories: []
series: []
cover: "resources/cover.png"
---

코드를 "잘" 작성하고 싶은 욕망은 프로그래머라면 자연스럽게 생긴다. 이번 글에서는 필자가 코드를 "디자인"하면서, 늘 염두에 두는 몇 가지 사항을 담아보았다. 


## Granularity: A or BC

```C
UpdateHP(e);
```

위처럼 체력을 갱신하는 함수가 있다고 하자. 이는 아래처럼 쪼갤 수 있다:

```C
hp = GetHP(e);
heal = GetHeal(e);
damage = GetDamage(e);
SetHP(e, hp + heal - damage);
```

`UpdateHP`처럼 하이 레벨의 함수도, 좀 더 조밀한 (granular) 함수들도 같이 제공해주면 좋다. 
예를 들어, 회복량만큼 플레이어 점수를 더해주고 싶다고 하자:

```C {hl_lines=[3]}
hp = GetHP(e);
heal = GetHeal(e);
player_score += heal;
damage = GetDamage(e);
SetHP(e, hp + heal - damage);
```

유저는 위처럼 쉽게 로직 추가도 가능하다. `UpdateHP`처럼 큰 덩어리만 제공해주면 한계가 있다. 
물론 모든 걸 다 작게 쪼개서 제공하면 끝고 없을 것이다. 한 스텝을 어디까지 정할 것이냐가 관건이다.

## Redundancy: A or B

```C
Entity e;
SetRotation(e, matrix);
SetRotation(e, quaternion);
SetRotation(e, axis);
```

개체 (entity)의 회전을 행렬, 쿼터니언, 축으로 설정하는 함수 세 가지를 유저에게 제공한다. 이러한 redundancy는 API를 강력하게 만들어준다. 
다만 너무 많다면, 헷갈린다는 단점이 있다.

## Coupling: A implies B

```C
Entity* e = CreateMonster();
```

보통 이런 형태의 API는 **할당**과 **초기화**가 커플링되어 있다. 하지만, 유저는 자기 자신의 메모리 할당을 쓰고 싶은 경우가 많다. 
따라서 할당과 초기화를 아래처럼 나누어서 제공해주는 편이 좋다:

```C
Entity* e = Alloc();
InitMonster(e);
```

그랬을 때, 유저는 아래처럼 쉽게 자신의 할당 함수를 적용할 수도 있다:

```C {hl_lines=[1]}
Monster* e = MyAlloc();
InitMonster(e);
```

또 다른 예시를 보자:

``` C
Image img = LoadImage("logo.png");
```

위 경우는 무엇이 커플링되었을까? `파일 읽기`와 `파일 파싱`이 커플링되었다. 유저는 자신의 파일 읽기 함수를 사용하고 싶은 경우가 많다. 
따라서 파싱만 담당하는 함수만 제공해주면, 아래처럼 유저는 자기 자신의 파일 읽기 함수를 사용할 수 있다:

```C
void* ptr = MyReadFile("logo.png");
Image img = LoadFromMemory(ptr);
```

어떻게 보면 Granularity와도 관련이 있어보인다.



## Retention: A mirrors B

양쪽 모두 정보를 들고 있어야 하는지, 다른 말로, **A의 정보를 B에서 미러링**할 필요가 있는지 스스로에게 묻자. 무슨 말인지 UI 프로그래밍으로 살펴보자.

아래는 **Retained-Mode UI**의 형태이다:

```C++
if (!button.is_valid) {
	button = create_button("play");
}

if (button.is_clicked) {
	play_sound();
} else {
	destroy_button(button);
}
```

버튼이 존재하지 않으면 생성하고, 존재한다면 클릭이 됐는지 확인한다. 클릭이 됐다면 사운드를 재생한다. 이 때, UI 라이브러리를 사용하는 
유저의 입장에서 살펴보자. 유저는 버튼이 살아있는지 계속 확인을 해줘야 한다. UI 라이브러리와 유저가 **동기화**를 해줘야한다는 말이다. 이런 코드는 많아질수록 
동기화도 어려워지고, 플로우를 살펴보기도 어렵다. 

아래는 **Immediate-Mode UI**의 형태이다:

```C++
if (button("play")) {
	play_sound();
}
```

유저는 버튼의 "생명"을 신경쓰지 않아도 된다. 어떤 일이 일어나는지 훨씬 쉽게 보인다. 상태 (state)가 여기저기 흩어져셔 동기화에 대한 어려움을 겪지도 않아도 된다.

Immediate-Mode의 장점, 또는 retention이 적은 코드의 장점은 다음과 같다:

- 단일화, 단순화된 플로우
- 동기화에 대한 걱정 X
- 절차적인 코드 작성 가능


## Flow Control: A invokes B

콜 스택 (call stack)을 상상해보자. 유저와 라이브러리간의 코드에서 왔다갔다를 반복하면 어떤 일이 일어나는지 파악하기 어렵다.

아래 코드를 보자:

```C++
file = open_file("log.txt");
```

모두가 행복하다. 아래로 넘어가자:

```C++
set_callbacks(open, read, close);
file = open_file("log.txt");
```

API의 `open_file()` 도중, 유저가 설정한 함수로 콜백할 것이다. 플로우가 조금 더 복잡해진다. 다음을 보자:

```C++
class My_Handle : public File_Handle {
	public:
		virtual void open(char* file_name) override;
};
```

이 코드는 위에서 살펴본 **콜백과 동일**하다. 유저가 API에서 제공한 클래스를 상속하고 가상함수를 구현한다. vptr가 있을 뿐, 콜백 함수와 다를 바 없다.

요는, 최대한 플로우가 명확하게 하자는 것이다. 게임 쪽에서 컨트롤이 많을수록 더 좋다.



## 관련 링크

[Casey Muratori – Designing and Evaluating Reusable Components - 2004](https://youtu.be/ZQ5_u8Lgvyk)  
