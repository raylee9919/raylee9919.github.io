+++ 
date = 2026-06-01T17:35:25+09:00
title = "하늘 렌더링 1"
description = ""
slug = ""
authors = []
tags = ["그래픽스", "렌더링", "환경", "게임 엔진"]
categories = []
externalLink = ""
series = []
math = "true"
+++

{{< figure src="/images/skyrim-nightsky.webp" attr="엘더스크롤 5: 스카이림" width="900">}}
</br>
{{< figure src="/images/mordor-cloud.jpg" attr="반지의 제왕 Ⅲ: 왕의 귀환" width="900">}}
</br>
{{< figure src="/images/sunset-rdr2.jpg" attr="레드 데드 리뎀션 2" width="900">}}
</br>

<p>
수놓인 밤하늘은 보는 이를 취하게 만들기도, 다가오는 먹구름은 거악(巨惡)을 형용하기도,
휘황한 노을은 여운을 남기기도 한다. 이렇듯, 날씨는 감정과 분위기를 좌지우지한다. 그리고 
날씨를 표현하는 데 있어 하늘은 필수 불가결하다. 본 글에서는 <b>물리 기반 하늘 렌더링</b>의 과정을 다루어본다.
</p>

<h1>Ⅰ. 수식</h1>
<p>
태양의 빛이 카메라에 도달하기까지의 과정을 어떻게 나타낼 수 있을까?

{{< figure src="/images/RTE1.svg" width="600">}}
지구에 도달한 태양의 빛은 산란하여 그 중 일부만 카메라에 도달하게 된다.

{{< figure src="/images/RTE2.svg" width="600">}}
빛의 경로 내내 산란과 흡수로 인해 에너지가 감소한다.

{{< figure src="/images/RTE3.svg" width="600">}}
빛의 경로 내내 산란으로 인해 빛이 들어옴으로써 에너지가 증가한다.

{{< notice note >}} 
그림의 한계로 세 부분만 나타냈지만, 실제로는 경로 내 무수히 많은 "점"들에서 산란과 흡수가 일어난다. 또한, 본문의 모델에서 흡수는 무시한다.{{< /notice >}}
</p>

<p>
이를 빛이 매질을 통과하는 식인 VRE(Volume Rendering Equation)로 나타내면 다음과 같다.
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D T(t)\,\Big[\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega}) + \sigma_a(\mathbf{x}_t)\,L_e(\mathbf{x}_t, \boldsymbol{\omega})\Big]\,dt + T(D)\,L_0
$$
광원을 오직 태양으로 단순화함으로써, 발광(emission)에 관한 항을 제거하면, 
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D \textcolor{#419BF9}{T(t)}\,\Big[\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}\Big]\,dt + \color{orange}T(D)\,L_0
$$
위 식을 천천히 살펴보도록 하겠다.
</br></br>
$T(d)$는 <i>들어온 빛에 대한 남은 빛의 비율</i> ($\frac{L_{\text{out}}}{L_{\text{in}}}$)이다. 거리 $d$에 대해 다음과 같이 표현한다 (Beer-Lambert 법칙).
$$T(d) = e^{-\sigma_t d}$$
하지만 위 식은 균일(homogeneous) 매질의 경우에만 성립한다. 대기(atmosphere)는 고도(altitude)에 따라 입자의 크기가 달라지는 불균일(heterogeneous) 매질이다. 이 경우, 
거리 $d$ 동안 매 지점의 상쇄 함수 $\sigma_t(\mathbf{x})$를 적분해주어야 한다. 즉,
$$
T(d) = \exp\!\left(-\int_0^d \sigma_t(\mathbf{x_s})\,ds\right)
$$
</br>
이를 통해 기존 VRE에서 $\color{orange}T(D)\,L_0$는 어떻게 해석할 수 있을까?
{{< figure src="/images/VRE1.svg" width="400">}}
이는 대기에 도달한 빛($L_0$)이 산란과 흡수를 거쳐 상쇄되어 카메라에 도달하는 빛의 양이다.
</br></br>
이제, $\int$ 안의 $\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}$를 살펴보자.
{{< figure src="/images/VRE2.svg" width="350">}}
이전에 언급했듯이, 거리 $D$ 동안 외부로부터 산란(in-scattering)으로 오는 빛에 의해 광량이 증가한다. 이렇게 들어온 빛은 다시 산란하여 카메라를 향해야 비로소 보일 것이다. 들어온 빛 중 얼마나 다시 산란하여 카메라를 향할까? 추가된 광량 $\textcolor{#00CC66}{L_{\text{scat}}}$에 산란에 대한 확률 밀도 함수인 $\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)}$를 곱하여 $\int_0^D$동안 적분한 것이 그것이다. 그리고 그 빛은 다시 카메라까지 남은 거리 동안 산란과 흡수를 통해 상쇄될 것이다. 이에 따라 $\textcolor{#419BF9}{T(t)}$를 곱해준 것이다.
</br></br>
그렇다면 $\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}$는 어떻게 표현될까?
$$
\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = \int_{S^2} p(\boldsymbol{\omega}', \boldsymbol{\omega})\,L(\mathbf{x}, \boldsymbol{\omega}')\,d\boldsymbol{\omega}'
$$
이 수식은 또 무엇인가. 차근히 살펴보자. </br>
{{< figure src="/images/VRE3.svg" width="400">}}
지금까지 $\mathbf{x}_t$로 빛이 단방향에서 들어오는 것처럼 그렸다. 거짓말이었다. 빛은 위 그림처럼 사방에서 들어온다.
따라서 사방에서 들어오는 빛을 $\int_{S^2}$로 적분해아한다.

{{< figure src="/images/VRE4.svg" width="400">}}
문제는 이 과정이 재귀적이라는 것이다. 사방에서 들어온 빛은 또 다른 방향에서 산란된 빛이며, 그 빛 또한 다시 다른 방향에서 산란된 빛이다. $\int$도 달갑지 않은데, 재귀까지 들어오니 복잡해진다.
{{< figure src="/images/VRE5.svg" width="450">}}
따라서 우리는 위 그림처럼 단일 산란(single scattering) 모델로 단순화할 것이다. 이전에 저렇게 그렸던 이유가 있었다.
$$
\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega}) L_\text{sun}T(D)
$$
$L_{\text{scat}}$을 위처럼 다시 쓸 수 있다. 뒤의 $L_\text{sun}(D)$는 이전에 봤던 것 같지 않은가? 거리 $D$동안 상쇄된 햇빛의 양이다.
</p>

<p>
앞의 $p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega})$는 무엇일까? $\mathbf{x}_t$로 들어온 빛은 
산란되어 사방으로 흩어진다. 하지만 우리가 원하는 것은, 카메라 방향으로 산란된 빛의 비율이다. 다시 말해, $\omega^{\prime}$에서 온 빛이 $\omega$로 얼마나 
향했냐는 것이다. 이를 나타낸 것이 $p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega})$이고, 보다시피 
들어오고 나가는 방향을 인자로 갖는다. 보통 코드에서는 두 방향의 $\cos$값을 인자로 갖는다.
</p>

<p>
$p$는 위상 함수(phase function)라고 불린다. 이는 확률 밀도 함수(probability density function)이며, 전 구간에 걸친 적분 값이 1이 된다는 의미이다. 
예를 들어, $\omega$와 $\omega^{\prime}$에 관계 없이 모든 방향으로 균일하게 산란하는 위상 함수는 어떻게 될까? 이를 상수 $c$라고 하면,
</p>

$$
p(\omega, \omega^{\prime}) = c
$$
$$
\int_0^{2\pi}\int_0^{\pi}c\sin(\theta){d\theta}{d\phi} = 1
$$
$$
c4\pi = 1
$$
$$
c = \frac{1}{4\pi}
$$

<p>
다시 돌아와서, 배운 것을 토대로 $\textcolor{#00CC66}{\sigma_s(\mathbf{x})L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = \sigma_s(\mathbf{x}) p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega}) L_\text{sun}T(D)$를 한 문장으로 정리하면?</br>
<b>대기로 들어와 상쇄되고 카메라 쪽으로 산란된 햇빛의 양</b>이다.
</p>

<p>
지금까지 아래 식을 차근차근 뜯어보았다. 매질을 거쳐 카메라에 도달하는 빛의 양을 어느 정도 이해했기를 바란다.
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D \textcolor{#419BF9}{T(t)}\,\Big[\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}\Big]\,dt + \color{orange}T(D)\,L_0
$$
다음 장에서는 하늘 렌더링 모델에서 이 수치들이 어떻게 결정되는지 알아보겠다.
</p>

<h1>Ⅱ. 레일리와 미 (Rayleigh and Mie)</h1>

<p>
    고도에 따라 대기 중 입자의 평균 크기가 달라진다. 이에 따라 산란의 특성이 달라진다. 입자가 비교적 작은 위쪽에는 레일리 산란(Rayleigh scattering)이 주로  
    일어나고, 입자가 비교적 큰 아래쪽에는 미 산란(Mie scattering)이 주를 이룬다.
</p>

<p>
    두 산란에 따라 위상 함수, 산란 계수, 밀도 분포가 달라지므로 이를 중심으로 살펴보도록 하겠다. 밀도 분포는 해당 고도에서 해당 산란을 일으키는 
    입자가 얼마나 존재하는지로 이해하면 되겠다.
</p>

<h2>레일리 산란</h2>

<p>
{{< figure src="/images/why-sky-is-blue.svg" width="400">}}
고도가 높아질수록, 입자의 크기가 작아지고, 이에 따라 파장(wavelength)이 짧은 광자(photon)가 더 큰 영향을 받게 된다. 
즉, 파장이 짧은 "푸른" 빛이 더 많이 산란한다. 여기저기서 푸른 파장을 지닌 광자들이 내 눈에 도달하게 되고, 나는 "여기저기"를 푸른 하늘로 인식하는 것이다. 
이러한 산란을 레일리 산란이라 한다.

{{< notice info >}} 
빛의 에너지는 연속적인 파장에 걸쳐 분포하지만, 보통 RGB 렌더러에서는 R, G, B 세 값만을 쓴다. 이는 연속적인 모든 파장을 다 고려할 수 없으므로, 
사람이 가장 민감한 세 파장 주위로 근사한 것이다. 그리고 Sébastien Hillaire 및 Eric Bruneton과 더불어 우리가 사용할 계수는, 
적분으로써 얻은 값이 아닌, 특정 세 파장에 대한 계수 (440nm, 550nm, 680nm)이다. {{< /notice >}}
</p>

<p>
	레일리 산란의 <b>위상 함수</b>는 다음을 사용하겠다.
	$$
		p(\mu) = \frac{3(1 + \mu^2)}{16\pi}
	$$
	$\mu$는 들어오는 빛의 방향과 산란되어 나가는 빛의 방향 사잇각의 $\cos$값이다.
</p>

<p>
	레일리 산란의 <b>산란 계수</b>는 벡터로 표현된다. $\sigma_s^r = \begin{bmatrix} 5.802 \\ 13.558 \\ 33.1 \end{bmatrix}\times10^{-6}$을 사용하겠다.<br>
	레일리 산란의 고도 $h$에 따른 <b>밀도 분포</b>는 $d^r(h) = e^{\frac{-h}{8.0km}}$ 를 사용하겠다.
</p>

<p>위 내용을 hlsl로 옮기면 다음과 같다.</p>

```hlsl
float phase_rayleigh(float mu) {
    return 0.05968310365 * (1 + mu*mu);
}

float3 Sr = float3(5.802e-6, 13.558e-6, 33.1e-6); // 레일리 산란 계수
float Dr = exp(-altitude / 8.0km); // 8.0km
```

<h2>미 산란</h2>

<p>
{{< figure src="/images/mie-scattering.svg" width="600">}}
빛의 진행 방향과 "비슷한" 방향으로 더 많이 산란한다는 것이 미 산란이고, 이는 입자의 크기가 클수록, 즉, 고도가 낮아질수록 도드라진다. 태양 주위의 햇무리 효과를 낼 수 있고, 레일리 산란과 달리 빛의 파장에 의존하지 않는다.
</p>

<p>미 산란의 <b>위상 함수</b>는 다음처럼 Cornette-Shanks 위상함수로 표현할 수 있다.</p>
$$
	p(\mu, g) = {\frac{3}{8\pi}}{\frac{(1 - g^2)(1 + \mu^2)}{(2 + g^2){(1 + g^2 - 2g\mu)}^{3/2}}}
$$
<p>
	$g$는 비대칭 계수(asymmetry parameter)로서, 산란된 빛이 원래 진행 방향으로 얼마나 유지하려는지를 나타낸다.<br> $g>0$의 경우, 빛이 원래 진행 방향으로 더 많이 산란되고, 
	$g<0$의 경우, 빛이 반대 방향으로 더 많이 산란된다. </br>우리는 $g=0.8$로 설정하겠다.
</p>

<p>
	미 산란의 <b>산란 계수</b> $\sigma_s^m$는 $2.1\times10^{-5}$를 사용하도록 하겠다. 이는 날씨, 대기의 오염도 등에 따라 달라질 수 있다.<br>
	미 산란의 고도 $h$에 따른 <b>밀도 분포</b>는 $d^m(h) = e^{\frac{-h}{1.2km}}$ 를 사용하겠다.
</p>

<p>위 내용을 hlsl로 옮기면 다음과 같다.</p>

```hlsl
float phase_mie(float mu, float g) {
    // Cornette-Shanks
    float g2 = g*g;
    return 0.11936620731 * (((1 - g2)*(1 + mu*mu)) / ((2 + g2) * pow(1 + g2 - 2*g*mu, 1.5)));
}

float3 Sm = 2.1e-5; // 미 산란 계수
float Dm = exp(-altitude / 1.2e3); // 1.2km
```

<h2>정리</h2>
<p>표로 정리하면 다음과 같다.</p>

| | 레일리 산란 | 미 산란 |
|---|---|---|
| **위상 함수** | $p(\mu) = \frac{3(1+\mu^2)}{16\pi}$ | $p(\mu,g) = \frac{3}{8\pi}\frac{(1-g^2)(1+\mu^2)}{(2+g^2)(1+g^2-2g\mu)^{3/2}}$ |
| **산란 계수** | $\sigma_s^r = [5.802,\ 13.558,\ 33.1]\times10^{-6}$ | $\sigma_s^m = 2.1\times10^{-5}$ |
| **밀도 분포** | $d^r(h) = e^{-h/8.0\text{km}}$ | $d^m(h) = e^{-h/1.2\text{km}}$ |

<p>
    아래는 레일리나 미 산란만 있을 때와 합쳐졌을 때의 렌더링 결과이다.    
    {{< figure src="/images/rayleigh-only.png" width="600" attr="레일리로 인한 푸른 하늘">}}
    </br>
    {{< figure src="/images/mie-only.png" width="600" attr="미로 인한 햇무리">}}
    </br>
    {{< figure src="/images/rayleigh-and-mie.png" width="600" attr="레일리+미: 푸른 하늘과 햇무리">}}
</p>

{{< notice note >}} 또 다른 중요한 산란인, 오존(Ozone) 산란은 본문에서 다루지 않겠다. {{< /notice >}}