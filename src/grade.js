// Final screen pass: subtle chromatic fringing, vignette, a cool-shadow /
// warm-highlight grade and animated film grain. Runs after tone mapping.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: [1, 1] },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uFade;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c);
      vec2 off = c * d * 0.006;
      vec3 col = vec3(
        texture2D(tDiffuse, vUv - off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv + off).b
      );
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col += mix(vec3(-0.012, 0.004, 0.022), vec3(0.025, 0.008, -0.02), smoothstep(0.2, 0.8, luma));
      col *= mix(1.0, smoothstep(0.95, 0.2, d), 0.72);
      col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.04;
      col = mix(col, vec3(0.0), uFade);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
