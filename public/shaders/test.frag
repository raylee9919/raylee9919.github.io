precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

void main()
{
    vec2 uv = gl_FragCoord.xy / u_resolution;

    gl_FragColor = vec4(
        uv.x,
        uv.y,
        abs(sin(u_time)),
        1.0
    );
}
