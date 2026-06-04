---
title: "Sky Rendering 1"
date: 2026-06-01
description: "Covers the basic math and scattering phenomena in the atmosphere."
tags: ["Graphics", "Rendering", "Environment"]
categories: []
series: ["Sky Rendering"]
series_order: 1
cover: "/images/result-1.png"
---

{{< figure src="/images/skyrim-nightsky.webp" attr="The Elder Scrolls V: Skyrim" width="900">}}
</br>
{{< figure src="/images/mordor-cloud.jpg" attr="The Lord of the Rings: The Return of the King" width="900">}}
</br>
{{< figure src="/images/sunset-rdr2.jpg" attr="Red Dead Redemption 2" width="900">}}
</br>

<p>
A starry night sky can intoxicate those who gaze upon it, approaching storm clouds can embody great evil,
and a blazing sunset can linger in the heart. Weather shapes emotion and atmosphere, and the sky is indispensable
in expressing it. This post walks through the process of <b>physically-based sky rendering</b>.
</p>

<h1>Ⅰ. The Math</h1>
<p>
How can we describe the journey of sunlight as it travels to the camera?

{{< figure src="/images/RTE1.svg" width="600">}}
Sunlight reaching Earth scatters, and only a fraction of it reaches the camera.

{{< figure src="/images/RTE2.svg" width="600">}}
Along the light's path, energy decreases due to scattering and absorption.

{{< figure src="/images/RTE3.svg" width="600">}}
Along the light's path, energy increases as light is scattered in from other directions.
</p>

<p>
This can be expressed using the Volume Rendering Equation (VRE), which describes light traveling through a medium:
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D T(t)\,\Big[\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega}) + \sigma_a(\mathbf{x}_t)\,L_e(\mathbf{x}_t, \boldsymbol{\omega})\Big]\,dt + T(D)\,L_0
$$
By simplifying the light source to the sun alone and removing the emission term:
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D \textcolor{#419BF9}{T(t)}\,\Big[\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}\Big]\,dt + \color{orange}T(D)\,L_0
$$
Let's walk through this equation carefully.
</br></br>
$T(d)$ is the <i>ratio of remaining light to incoming light</i> ($\frac{L_{\text{out}}}{L_{\text{in}}}$). For distance $d$, it is expressed as follows (Beer-Lambert law):
$$T(d) = e^{-\sigma_t d}$$
However, this holds only for a homogeneous medium. The atmosphere is a heterogeneous medium where particle size varies with altitude. In this case, we must integrate the extinction function $\sigma_t(\mathbf{x})$ at every point over distance $d$:
$$
T(d) = \exp\!\left(-\int_0^d \sigma_t(\mathbf{x_s})\,ds\right)
$$
</br>
With this in mind, how do we interpret $\color{orange}T(D)\,L_0$ in the VRE?
{{< figure src="/images/VRE1.svg" width="400">}}
This is the amount of light ($L_0$) that enters the atmosphere and, after being attenuated by scattering and absorption, reaches the camera.
</br></br>
Now let's look at $\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}$ inside the integral.
{{< figure src="/images/VRE2.svg" width="350">}}
As mentioned earlier, in-scattered light from outside increases the radiance over distance $D$. This incoming light must scatter again toward the camera to be visible. How much of it scatters toward the camera? That is what we get by multiplying the added radiance $\textcolor{#00CC66}{L_{\text{scat}}}$ by the scattering probability density function $\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)}$ and integrating over $\int_0^D$. That light will then be attenuated by scattering and absorption over the remaining distance to the camera, which is why we multiply by $\textcolor{#419BF9}{T(t)}$.
</br></br>
So how is $\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}$ expressed?
$$
\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = \int_{S^2} p(\boldsymbol{\omega}', \boldsymbol{\omega})\,L(\mathbf{x}, \boldsymbol{\omega}')\,d\boldsymbol{\omega}'
$$
What is this? Let's break it down.
</br>
{{< figure src="/images/VRE3.svg" width="400">}}
Until now, light at $\mathbf{x}_t$ was drawn as coming from a single direction — that was a simplification. Light actually arrives from all directions, as shown above.
Therefore we integrate over all incoming directions with $\int_{S^2}$.

{{< figure src="/images/VRE4.svg" width="400">}}
The problem is that this process is recursive. Light arriving from all directions is itself light scattered from yet other directions, which in turn was scattered from even more directions. An integral is already unwelcome, and now recursion is added on top.
{{< figure src="/images/VRE5.svg" width="450">}}
We therefore simplify to a single scattering model as shown above — which is why the earlier diagrams were drawn that way.
$$
\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega}) L_\text{sun}T(D)
$$
We can rewrite $L_{\text{scat}}$ as above. Doesn't $L_\text{sun}T(D)$ look familiar? It is the amount of sunlight attenuated over distance $D$.
</p>

<p>
What is $p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega})$? Light arriving at $\mathbf{x}_t$ scatters in all directions. What we want is the fraction of that light that scatters toward the camera — that is, how much of the light coming from direction $\omega^{\prime}$ goes toward direction $\omega$. This is represented by $p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega})$, which takes the incoming and outgoing directions as arguments. In code, the cosine of the angle between the two directions is typically used as the argument.
</p>

<p>
$p$ is called the phase function. It is a probability density function, meaning its integral over the full sphere equals 1.
For example, what would the phase function look like for a medium that scatters uniformly in all directions regardless of $\omega$ and $\omega^{\prime}$? Calling this constant $c$:
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
Coming back to our equation, using what we've learned, $\textcolor{#00CC66}{\sigma_s(\mathbf{x})L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = \sigma_s(\mathbf{x}) p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega}) L_\text{sun}T(D)$ can be summarized in one sentence:</br>
<b>The amount of sunlight that has entered and been attenuated through the atmosphere, then scattered toward the camera.</b>
</p>

<p>
We have now walked through the following equation step by step. Hopefully, the amount of light reaching the camera through a medium is starting to make sense.
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D \textcolor{#419BF9}{T(t)}\,\Big[\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}\Big]\,dt + \color{orange}T(D)\,L_0
$$
In the next section, we will look at how these values are determined in the sky rendering model.
</p>

<h1>Ⅱ. Rayleigh and Mie</h1>

<p>
    The average size of particles in the atmosphere changes with altitude, which in turn affects the nature of scattering. Rayleigh scattering dominates at higher altitudes where particles are relatively small, while Mie scattering dominates at lower altitudes where particles are relatively large.
</p>

<p>
    The phase function, scattering coefficient, and density distribution differ between the two types of scattering, so we will focus on those. The density distribution can be understood as how many particles causing that type of scattering exist at a given altitude.
</p>

<h2>Rayleigh Scattering</h2>

<p>
{{< figure src="/images/why-sky-is-blue.svg" width="400">}}
As altitude increases, particle size decreases, and photons with shorter wavelengths are affected more strongly.
In other words, "blue" light with shorter wavelengths scatters more. Blue-wavelength photons reach our eyes from all directions, and we perceive that "all around us" as a blue sky.
This is called Rayleigh scattering.
</p>

<p>
	The <b>phase function</b> for Rayleigh scattering we will use is:
	$$
		p(\mu) = \frac{3(1 + \mu^2)}{16\pi}
	$$
	$\mu$ is the cosine of the angle between the incoming and outgoing light directions.
</p>

<p>
	The <b>scattering coefficient</b> for Rayleigh scattering is expressed as a vector: $\sigma_s^r = \begin{bmatrix} 5.802 \\ 13.558 \\ 33.1 \end{bmatrix}\times10^{-6}$.<br>
	The <b>density distribution</b> for Rayleigh scattering with respect to altitude $h$ is $d^r(h) = e^{\frac{-h}{8.0km}}$.
</p>

<p>Translated to HLSL:</p>

```hlsl
float phase_rayleigh(float mu) {
    return 0.05968310365 * (1 + mu*mu);
}

float3 Sr = float3(5.802e-6, 13.558e-6, 33.1e-6); // Rayleigh scattering coefficient
float Dr = exp(-altitude / 8.0km); // 8.0km
```

<h2>Mie Scattering</h2>

<p>
{{< figure src="/images/mie-scattering.svg" width="600">}}
Mie scattering describes how light scatters more strongly in directions close to the original direction of travel. This becomes more pronounced at lower altitudes where particles are larger. It produces the halo effect around the sun, and unlike Rayleigh scattering, it does not depend on the wavelength of light.
</p>

<p>The <b>phase function</b> for Mie scattering is expressed using the Cornette-Shanks phase function:</p>
$$
	p(\mu, g) = {\frac{3}{8\pi}}{\frac{(1 - g^2)(1 + \mu^2)}{(2 + g^2){(1 + g^2 - 2g\mu)}^{3/2}}}
$$
<p>
	$g$ is the asymmetry parameter, representing how strongly the scattered light tends to maintain its original direction of travel.<br> When $g>0$, light scatters more in the forward direction, and when $g<0$, it scatters more in the backward direction.</br> We will set $g=0.8$.
</p>

<p>
	We will use $2.1\times10^{-5}$ for the Mie <b>scattering coefficient</b> $\sigma_s^m$. This can vary depending on weather conditions, atmospheric pollution, and so on.<br>
	The <b>density distribution</b> for Mie scattering with respect to altitude $h$ is $d^m(h) = e^{\frac{-h}{1.2km}}$.
</p>

<p>Translated to HLSL:</p>

```hlsl
float phase_mie(float mu, float g) {
    // Cornette-Shanks
    float g2 = g*g;
    return 0.11936620731 * (((1 - g2)*(1 + mu*mu)) / ((2 + g2) * pow(1 + g2 - 2*g*mu, 1.5)));
}

float3 Sm = 2.1e-5; // Mie scattering coefficient
float Dm = exp(-altitude / 1.2e3); // 1.2km
```

<h2>Summary</h2>
<p>A summary table:</p>

<table>
<tr>
<th></th>
<th>Rayleigh</th>
<th>Mie</th>
</tr>

<tr>
<td>Phase function</td>
<td>\(p(\mu)=\frac{3(1+\mu^2)}{16\pi}\)</td>
<td>\(p(\mu,g)=\frac{3}{8\pi}\frac{(1-g^2)(1+\mu^2)}{(2+g^2)(1+g^2-2g\mu)^{3/2}}\)</td>
</tr>

<tr>
<td>Scattering coefficient</td>
<td>\(\sigma_s^r=[5.802,13.558,33.1]\times10^{-6}\)</td>
<td>\(\sigma_s^m=2.1\times10^{-5}\)</td>
</tr>

<tr>
<td>Density distribution</td>
<td>\(d^r(h)=e^{-h/(8.0\text{ km})}\)</td>
<td>\(d^m(h)=e^{-h/(1.2\text{ km})}\)</td>
</tr>
</table>

<p>
    Below are rendering results with Rayleigh only, Mie only, and both combined.
    {{< figure src="/images/rayleigh-only.png" width="600" attr="Blue sky from Rayleigh scattering">}}
    </br>
    {{< figure src="/images/mie-only.png" width="600" attr="Halo from Mie scattering">}}
    </br>
    {{< figure src="/images/rayleigh-and-mie.png" width="600" attr="Rayleigh + Mie: blue sky with halo">}}
</p>

# Ⅲ. Result
<p>The following video shows the implementation in C++ and D3D12.</p>
{{< youtube KMlMLBRS_BI>}}
{{< figure src="/images/result-1.png">}}

## Reference
[Sébastien Hillaire — A Scalable and Production Ready Sky and Atmosphere Rendering Technique](https://sebh.github.io/publications/egsr2020.pdf)
[Sébastien Hillaire — Physically Based Sky, Atmosphere
and Cloud Rendering in Frostbite](https://www.ea.com/news/physically-based-sky-atmosphere-and-cloud-rendering)
[Tomoyuki Nishita et al. — Display of The Earth Taking in Account Atmospheric Scattering](http://nishitalab.org/user/nis/cdrom/sig93_nis.pdf)
[Epic — Sky Atmosphere Component in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/sky-atmosphere-component-in-unreal-engine?lang=en-US)