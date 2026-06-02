+++ 
date = 2026-06-01T17:35:25+09:00
title = "하늘 렌더링 1"
description = ""
slug = ""
authors = []
tags = ["그래픽스"]
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
아련한 노을은 여운을 두고 가기도 한다. 이렇듯, 날씨는 감정과 분위기를 좌지우지한다. 그리고, 
날씨를 표현하는 데 있어 하늘은 필수 불가결하다. 본 글에서는 <b>물리 기반 하늘 렌더링</b>의 과정을 다루어본다.
</p>

<h2>Ⅰ. 개요</h1>
<p>
태양의 빛이 카메라에 도달하기까지의 과정을 어떻게 표현할 수 있을까?

{{< figure src="/images/RTE1.svg" width="600">}}
지구에 도달한 태양의 빛은 산란하여 그 중 일부만 카메라에 도달하게 된다. 
다만, 추가로 고려해야할 세 가지가 있다.

{{< figure src="/images/RTE2.svg" width="600">}}
첫 번째, 경로 내내 산란과 흡수로 인해 에너지가 감소한다.

{{< figure src="/images/RTE3.svg" width="600">}}
두 번째, 경로 내내 산란으로 인해 빛이 들어옴으로써 에너지가 증가한다.

세 번째, 고도(高度, altitude)에 따라 대기 중 입자들의 크기가 달라지고, 이에 따라 산란이 달라진다.

{{< notice note >}} 
그림의 한계로 세 부분만 나타냈지만, 실제로는 경로 내 무수히 많은 "점"들에서 산란과 흡수가 일어난다. 또, 흡수는 무시하도록 하겠다.{{< /notice >}}
</p>

<p>
다음은 입자의 크기에 따른 산란을 좀 더 살펴보겠다. 이 부분이 하늘 렌더링을 매력적으로 만든다.
</p>

<h2>Ⅱ. 대기(大氣, atmosphere)<h3>
<h3>Rayleigh 산란</h3>
<p>
{{< figure src="/images/why-sky-is-blue.svg" width="400">}}
고도가 높아질수록, 입자의 크기가 작아지고, 이에 따라 파장(波長, wavelength)이 짧은 광자(光子, photon)가 더 큰 영향을 받게 된다. 
즉, 파장이 짧은 "푸른" 빛이 더 크게 산란한다. 여기저기서 푸른 파장을 지닌 광자들이 내 눈에 도달하게 되고, 나는 "여기저기"를 푸른 하늘로 인식하는 것이다. 
이러한 산란을 Rayleigh 산란이라 하고, float3 RGB 계수와 고도에 따른 분포 함수로 이를 구현하고는 한다.

{{< notice info >}} 
빛의 에너지는 연속적인 파장에 걸쳐 분포하지만, 보통 RGB 렌더러에서는 R, G, B 세 값만을 쓴다. 이는 연속적인 모든 파장을 다 염두할 수 없으므로, 
사람이 가장 민감한 세 파장 주위로 근사한 것이다. 그리고 Sébastien Hillaire 및 Eric Bruneton이 사용하였고 우리도 사용할 계수는, 
적분으로써 얻은 값이 아닌, 특정 세 파장에 대한 계수 (440nm, 550nm, 680nm)이다. {{< /notice >}}
</p>

<h3>Mie 산란</h3>
<p>
{{< figure src="/images/mie-scattering.svg" width="600">}}
빛의 진행 방향과 "비슷한" 방향으로 더 많이 산란한다는 것이 Mie 산란이고, 이는 보다 입자가 클 때 도드라진다. 
</p>
</br>

<h3>정리</h3>
<p>
아래는 Rayleigh와 Mie가 합쳐졌을 때와 각각만 있을 때의 렌더링 결과이다.
{{< figure src="/images/rayleigh-and-mie.png" width="600" attr="Rayleigh + Mie: 푸른 하늘과 밝은 태양 주변">}}
{{< figure src="/images/rayleigh-only.png" width="600" attr="Rayleigh: 푸른 하늘은 있지만 태양 주위가 밝지 않다.">}}
{{< figure src="/images/mie-only.png" width="600" attr="Mie: 하늘이 하얗고, 태양 주위가 밝다.">}}
</p>

{{< notice note >}} 또 다른 중요한 산란인, 오존(Ozone) 산란은 본문에서 다루지 않겠다. {{< /notice >}}