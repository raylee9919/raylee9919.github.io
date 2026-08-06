precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

void main()
{
    // Normalize coordinates
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // Center coordinates
    uv -= 0.5;

    // Fix aspect ratio
    uv.x *= u_resolution.x / u_resolution.y;


    // Mouse coordinates
    vec2 mouse = u_mouse / u_resolution.xy;

    mouse -= 0.5;
    mouse.x *= u_resolution.x / u_resolution.y;


    // Animated circle
    vec2 pos = vec2(
        sin(u_time * 0.8) * 0.25,
        cos(u_time * 0.6) * 0.25
    );

    float dist = length(uv - pos);


    // Mouse glow
    float mouseDist = length(uv - mouse);


    float circle =
        0.02 / max(dist, 0.001);

    float mouseGlow =
        0.03 / max(mouseDist, 0.001);


    vec3 color = vec3(0.0);

    color += vec3(
        0.2,
        0.5,
        1.0
    ) * circle;

    color += vec3(
        1.0,
        0.3,
        0.1
    ) * mouseGlow;


    // subtle background
    color += vec3(
        0.01,
        0.01,
        0.02
    );


    gl_FragColor = vec4(color, 1.0);
}
