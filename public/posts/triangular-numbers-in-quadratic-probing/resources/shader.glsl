// #ifdef GL_ES
// precision mediump float;
// #endif
// 
// uniform float u_time;
// uniform vec2 u_resolution;
// 
// void main()
// {
//     vec2 uv = gl_FragCoord.xy / u_resolution.xy;
// 
//     float t = u_time;
// 
//     vec3 color = 0.5 + 0.5*cos(
//         t + uv.xyx + vec3(0,2,4)
//     );
// 
//     gl_FragColor = vec4(color,1.0);
// }

#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

void main()
{
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = u_time;

    vec3 color = 0.5 + 0.5*cos(
        t + uv.xyx + vec3(0,2,4)
    );

    gl_FragColor = vec4(color,1.0);
}
