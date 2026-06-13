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


## Retention

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


## Flow Control

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
