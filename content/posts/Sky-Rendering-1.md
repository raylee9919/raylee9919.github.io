+++
date = 2026-06-01T17:35:25+09:00
title = "Sky Rendering 1"
description = ""
slug = ""
authors = []
tags = ["Graphics", "Rendering", "Environment", "Game Engine"]
categories = []
externalLink = ""
series = []
math = "true"
+++

{{< figure src="/images/skyrim-nightsky.webp" attr="The Elder Scrolls V: Skyrim" width="900">}}
</br>
{{< figure src="/images/mordor-cloud.jpg" attr="The Lord of the Rings: The Return of the King" width="900">}}
</br>
{{< figure src="/images/sunset-rdr2.jpg" attr="Red Dead Redemption 2" width="900">}}
</br>

<p>
A star-filled night sky can captivate those who gaze upon it. Approaching storm clouds may embody a looming evil, while a brilliant sunset can leave a lasting impression. Weather shapes emotion and atmosphere, and the sky is an indispensable part of portraying it. In this article, we will explore the process of <b>physically based sky rendering</b>.
</p>

<h1>I. The Equations</h1>

<p>
How can we describe the journey of sunlight until it reaches the camera?
</p>

{{< figure src="/images/RTE1.svg" width="600">}}

A portion of the sunlight that reaches Earth is scattered, and only some of it eventually arrives at the camera.

{{< figure src="/images/RTE2.svg" width="600">}}

Along its path, light loses energy due to scattering and absorption.

{{< figure src="/images/RTE3.svg" width="600">}}

Along its path, light also gains energy from light scattered into the viewing ray.

{{< notice note >}}
For simplicity, the illustrations show only a few scattering and absorption events. In reality, these processes occur continuously at countless points along the path. Furthermore, absorption will be ignored in the atmospheric model discussed in this article.
{{< /notice >}}

<p>
This process can be expressed using the Volume Rendering Equation (VRE):
</p>
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D T(t)\,\Big[\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega}) + \sigma_a(\mathbf{x}_t)\,L_e(\mathbf{x}_t, \boldsymbol{\omega})\Big]\,dt + T(D)\,L_0
$$

<p>
If we simplify the scene by considering the Sun as the only light source, the emission term can be removed:
</p>
$$
L(\mathbf{x}, \boldsymbol{\omega}) = \int_0^D \textcolor{#419BF9}{T(t)}\,\Big[\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)\,L_{\text{scat}}(\mathbf{x}_t, \boldsymbol{\omega})}\Big]\,dt + \color{orange}T(D)\,L_0
$$

<p>
Let us examine the equation piece by piece.
</p>

<p>
$T(d)$ represents the <i>fraction of light that remains</i> ($\frac{L_{\text{out}}}{L_{\text{in}}}$) after traveling a distance $d$. It is given by the Beer–Lambert law:
</p>
$$
T(d) = e^{-\sigma_t d}
$$

<p>
However, this form is only valid for a homogeneous medium. The atmosphere is a heterogeneous medium whose particle density varies with altitude. In this case, the extinction coefficient must be integrated along the path:
</p>

$$
T(d) = \exp\left(-\int_0^d \sigma_t(\mathbf{x_s})\,ds\right)
$$

<p>
The term $T(D)L_0$ therefore represents the amount of incoming sunlight that survives attenuation and eventually reaches the camera.
</p>

<p>
Now let us examine
$\textcolor{#00CC66}{\sigma_s(\mathbf{x}_t)L_{\text{scat}}(\mathbf{x}_t,\boldsymbol{\omega})}$.
</p>

<p>
As mentioned earlier, radiance increases because light is scattered into the viewing ray. Once this incoming light reaches a point along the ray, it must scatter again toward the camera to become visible. The amount of light redirected toward the camera is determined by the scattering coefficient and the incoming radiance. The resulting contribution is then attenuated on its way to the camera, which is why it is multiplied by $T(t)$.
</p>

$$
\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = \int_{S^2} p(\boldsymbol{\omega}', \boldsymbol{\omega})\,L(\mathbf{x}, \boldsymbol{\omega}')\,d\boldsymbol{\omega}'
$$

<p>
What does this equation mean?
</p>

<p>
Until now, we have illustrated light arriving at $\mathbf{x}_t$ from a single direction. That was a simplification. In reality, light arrives from every direction. Therefore, we must integrate the incoming radiance over the entire sphere of directions, represented by $\int_{S^2}$.
</p>

<p>
The problem is that this process is recursive. The light arriving from one direction was itself scattered from another direction, which in turn was scattered from yet another direction. The equation quickly becomes difficult to solve.
</p>

<p>
For this reason, we will simplify the problem by considering only <b>single scattering</b>.
</p>

$$
\textcolor{#00CC66}{L_{\text{scat}}(\mathbf{x}, \boldsymbol{\omega})} = p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega}) L_\text{sun}T(D)
$$

<p>
The term $L_\text{sun}T(D)$ should look familiar: it is simply the amount of sunlight that remains after attenuation along the path from the Sun.
</p>

<p>
What about $p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega})$? Light arriving at $\mathbf{x}_t$ is scattered in many directions, but we are only interested in the fraction that is redirected toward the camera. In other words, given light arriving from $\omega'$, how much of it is scattered into direction $\omega$? This is described by $p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega})$, which depends on both the incoming and outgoing directions.
</p>

<p>
The function $p$ is called a <b>phase function</b>. It is a probability density function whose integral over all directions equals one.
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
This corresponds to perfectly isotropic scattering, where light is scattered equally in all directions.
</p>

<p>
Putting everything together, the term
$\sigma_s(\mathbf{x}) p(\boldsymbol{\omega}^{\prime}, \boldsymbol{\omega}) L_\text{sun}T(D)$
can be summarized as:
</p>

<p>
<b>The amount of sunlight that enters the atmosphere, survives attenuation, and is scattered toward the camera.</b>
</p>

<h1>II. Rayleigh and Mie</h1>

<h2>Rayleigh Scattering</h2>

<p>
As altitude increases, particle sizes become smaller. Smaller particles scatter shorter wavelengths more strongly. Consequently, blue light is scattered more than red light. Photons carrying blue wavelengths reach our eyes from many directions, and we perceive the sky as blue.
</p>

<p>
This phenomenon is known as Rayleigh scattering. In rendering systems, it is typically represented using RGB scattering coefficients and an altitude-dependent density distribution.
</p>

{{< notice info >}}
Although light energy is distributed continuously across wavelengths, RGB renderers typically operate on only three channels. The coefficients used by Sébastien Hillaire and Eric Bruneton are based on specific wavelengths (440 nm, 550 nm, and 680 nm) rather than a fully spectral integration.
{{< /notice >}}

<h2>Mie Scattering</h2>

<p>
Mie scattering preferentially scatters light in directions close to the original direction of travel. This effect becomes more pronounced for larger particles and is therefore strongest at lower altitudes. Unlike Rayleigh scattering, Mie scattering is largely independent of wavelength.
</p>

<p>
The images below show the combined effect of Rayleigh and Mie scattering, as well as each component individually.
</p>

{{< notice note >}}
Another important atmospheric effect, ozone absorption/scattering, will not be covered in this article.
{{< /notice >}}

<h1>III. Ray Marching</h1>

WIP
