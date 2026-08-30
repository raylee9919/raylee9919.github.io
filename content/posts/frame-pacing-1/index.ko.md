---
title: "타임스텝과 프레임 페이싱 1"
date: 2026-08-14
description: "시간 문제다."
tags: ["시스템", "게임 엔진"]
categories: []
series: ["타임스텝과 프레임 페이싱"]
cover: "resources/cover.webp"
---


## 타임스텝

물리의 tick 주기를 프레임레이트와 무관하게 만들어야 하는 이유와 구현은 [이
링크들](#링크)에서 훌륭하게 설명하고 있으니, 구현 세부 사항은 건너뛰도록 하자 :)

### 고정 타임스텝

적어도 물리 시뮬레이션만큼은 타임스텝을 고정하는 것이 좋다. 예를 들어 가변 
타임스텝을 사용하다가 어떤 이유로든 지난 업데이트 이후 경과한 시간이 갑자기
크게 늘어나면, 총알이 벽을 뚫고 지나가 버릴 수 있다.

![bullet penetrating wall](resources/bullet.svg)

경과된 시간을 커버하기 위해 고정 타임스텝만큼 여러 번 tick을 반복하면 충돌을 감지할 수 있다.

![bullet no more penetrates](resources/bullet_1.svg)

물론 이렇게 해도 종잇장처럼 얇은 벽은 여전히 총알이 뚫고 지나갈 수 있다. 하지만
적어도 지금은 이 *tunneling* 문제까지 다루지는 않겠다. 타임스텝을 고정하는
더 중요한 이유가 있기 때문이다. 바로 *determinism*이다. 같은 조건이라면
시뮬레이션 결과가 일관되어야 한다.

위치 함수가 $p_1 = p_0 + \Delta t^2$라고 하자. 첫 번째 게임 실행에서는
타임스텝이 10ms와 30ms 두 번 주어지고, 두 번째 실행에서는 20ms가 두 번
주어진다고 하자. 총 경과 시간은 같지만 결과는 달라진다.

![Differ](resources/integration.svg)

다음으로 넘어가, 예를 들어보자. 마지막 업데이트 이후 $34.89ms$가 경과했고, 고정
타임스텝은 $16.67ms$라고 하자. 즉, 게임의 tick rate는 사실상 $60Hz$다. 따라서
update 절차를 두 번 실행하게 된다. 그런데 $1.55ms$가 남는다. 이 나머지는 어떻게
처리해야 할까?

![Semi-fixed timestep](resources/semifixed_timestep.svg)

앞에서 이야기했듯이 $1.55ms$를 타임스텝으로 삼아 한 번 더 tick을 실행해서는 안
된다. 대신 이 나머지를 다음 프레임으로 넘겨야 한다. 이를 위해 일종의 전역
accumulator에 나머지를 더해 둔다.

그렇다면 렌더링은 어떻게 해야 할까? 나머지를 다음 프레임까지 그냥 무시하면,
렌더링된 프레임이 실제로 경과한 시간을 반영하지 못하기 때문에 떨림이 발생할 
수 있다.

![timestep_1](resources/timestep_1.svg)

### 보간

보간(interpolation) 등장! 렌더링할 때 두 상태 사이를 보간하자. 먼저
$[0,1]$ 사이의 $\alpha$를 계산한다.

![timestep_2](resources/timestep_2.svg)

그 다음, 현재 상태와 이전 상태 사이를 보간하고, 그 결과를 렌더링한다.

![timestep_3](resources/timestep_3.svg)

잠깐, 왜 현재 상태와 **이전 상태** 사이를 보간하지? 한 프레임 뒤처지는
것 아닌가? 현재 상태와 **다음 상태** 사이를 보간해야 하는 것 아닌가?

![timestep_4](resources/timestep_4.svg)

그렇게 하면 좋지 않은 일이 발생할 수 있다.

예를 들어 어떤 바위가 당신을 향해 날아오고 있고, 맞으면 죽는다고 하자.
플레이어가 공격 버튼을 눌러 바위를 파괴하려 했지만, 입력이 렌더링을 시작한
직후에 도착했다고 하자. 미래의 입력을 고려하지 않은 채 다음 상태를 계산하고 두
상태 사이를 보간하여 프레임을 출력한다면, 캐릭터가 이미 죽은 것처럼 보일 수
있다. 그리고 다음 프레임에서 공격 입력이 처리되면, 캐릭터가 갑자기 다시
살아난다.

![timestep_5](resources/timestep_5.svg)

보간의 문제는 여기서 끝나지 않는다. 현재 상태와 이전 게임 상태 사이에서
핵폭탄을 떨어뜨려 몇몇 개체들의 존재를 지워버렸다 하자. 그렇다면 그 개체들의
위치를 어떻게 보간해야 할까?

또, 두 유효한 게임 상태 사이를 보간한 결과가 반드시 유효한 상태라는 보장도
없다. 아래 그림처럼 말이다.

![Invalid Interpolation](resources/invalid.svg)

두 플레이어가 *Q*를 눌러 순간이동한다고 하자. State1과 State2는 각각 순간이동
전후의 상태를 나타낸다. 그런데 이 두 상태 사이를 선형 보간하여 렌더링하면
어떻게 될까? 실제 게임에서는 두 플레이어가 충돌하지 않았지만, 화면에서는 서로
충돌한 것처럼 보인다!

### 마지막 Tick

생각보다 꽤 복잡해진다. 그런데 사실 보간을 아예 버릴 수도 있다. 그냥 tick을 한
번 더 하면 된다.

다만 이번에는 나머지 $t$를 타임스텝으로 사용해 임시 게임 상태를 계산한다. 이
상태는 오직 렌더링을 위해서만 사용하며, 이후 버린다. 즉, "진짜" 게임 상태가
아니다.

![timestep_6](resources/timestep_6.svg)

그리고 다음 tick을 실행할 때가 되면, 임시 게임 상태가 아니라 이전의 **실제 게임
상태**에서 고정 타임스텝만큼 진행하여 새로운 실제 게임 상태를 계산한다.

![timestep_7](resources/timestep_7.svg)

하지만 짐작할 수 있듯이, 물리나 시뮬레이션 연산이 많은 게임에서는 이 방법이
현실적으로 불가능할 수도 있다.

### Unity 엔진 물리

2026년 현재도 Unity의 기본 물리 타임스텝은 $50Hz$다. 기묘한 수이다. 또,
물리에는 기본적으로 보간이 적용되지 않는다. 아래 그림처럼 물리와 렌더링의
주기가 서로 맞지 않으면 $60Hz$ 모니터에서 눈에 띄는 버벅임이 발생할 수 있다.
안정적인 50 FPS가 끊기는 120 FPS보다 더 좋은 경험이다.

![Unity Physics](resources/Unity.svg "C missed the deadline, so B had to be
presented twice.")

따라서 기본 물리 타임스텝을 $60Hz$나 그에 준하는 "상식적인" 값으로 조정하는
것을 권장한다. 또는 [이
옵션](https://docs.unity3d.com/ScriptReference/Rigidbody-interpolation.html)을
고려해 볼 수도 있다.

다만 이제는 알다시피, 이는 이전 상태와 현재 상태 사이를 보간하니 주의해서
사용하도록 하자.

## 마치며

여기서는 [Phillip Trudeau](https://philliptrudeau.com/)의 말을 빌리고 싶다.
멋진 세 줄 요약이다.

> **Naive display**는 부드럽지 않다.  
> **Interpolation**은 최신 상태가 아니다.  
> **Extrapolation**은 정직하지 않다.

본인이 하나 덧붙이면,

**마지막 tick은 공짜가 아니다.**

물론 tick이 240Hz로 *brrrr* 하고 빠르게 돌아간다면, naive display도 아마 충분히
괜찮을 것이다.

## 링크

[Glenn Fiedler. "Fix Your Timestep!"](https://www.gafferongames.com/post/fix_your_timestep/)  
[Jonathan Blow. "Q&A: frame-rate-independence"](https://www.youtube.com/watch?v=fdAOPHgW7qM)  
[Jakub Tomšů. "Fixed timestep without interpolation"](https://jakubtomsu.github.io/posts/fixed_timestep_without_interpolation/)  
[Taha Torabpour. "Upgrade Your Timestep"](https://lotusspring.substack.com/p/upgrade-your-timestep)  
[Tyler Glaiel. "How to make your game run at 60fps"](https://medium.com/@tglaiel/how-to-make-your-game-run-at-60fps-24c61210fe75)  
