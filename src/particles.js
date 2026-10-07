import * as THREE from "three";

// Points sized in world units: uScale is (canvas height / 2) / tan(fov / 2).
const sizeAttenuation = /* glsl */ `
  uniform float uScale;
  float pointSize(float worldSize, vec4 mv) { return worldSize * uScale / -mv.z; }
`;

/** Embers that spiral up from the rune ring at the monolith's base. */
export function createEmbers({ count, origin, radius }) {
  const seeds = new Float32Array(count);
  const bases = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random();
    const a = Math.random() * Math.PI * 2;
    const r = radius * (0.25 + Math.random() * 0.85);
    bases.set([origin.x + Math.cos(a) * r, origin.y + Math.random() * 0.4, origin.z + Math.sin(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(bases, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const uniforms = { uTime: { value: 0 }, uScale: { value: 600 }, uBoost: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uBoost;
      varying float vAlpha, vHeat;
      ${sizeAttenuation}
      void main() {
        float speed = (0.05 + fract(aSeed * 7.13) * 0.07) * (0.7 + 0.6 * uBoost);
        float life = fract(uTime * speed + aSeed);
        vec3 p = position;
        float ang = aSeed * 6.283 + uTime * 0.35 + life * 4.0;
        float swirl = 0.4 + life * 1.4;
        p.x += sin(ang) * swirl;
        p.z += cos(ang) * swirl;
        p.y += life * (6.0 + fract(aSeed * 3.7) * 4.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = (0.035 + fract(aSeed * 13.7) * 0.05) * (1.0 - life * 0.5);
        gl_PointSize = pointSize(s, mv);
        float flicker = 0.55 + 0.45 * sin(uTime * 11.0 + aSeed * 50.0);
        vAlpha = smoothstep(0.0, 0.06, life) * (1.0 - life) * flicker;
        vHeat = 1.0 - life;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBoost;
      varying float vAlpha, vHeat;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(1.0, 0.18, 0.03), vec3(1.0, 0.72, 0.32), vHeat) * (5.0 + 3.0 * uBoost);
        gl_FragColor = vec4(col, a * vAlpha);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.uniforms = uniforms;
  return pts;
}

/** Fine dust drifting through the air, catching the low sun. */
export function createDust({ count, center, size }) {
  const seeds = new Float32Array(count);
  const bases = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random();
    bases.set([
      center.x + (Math.random() - 0.5) * size.x,
      center.y + Math.random() * size.y,
      center.z + (Math.random() - 0.5) * size.z,
    ], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(bases, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const uniforms = { uTime: { value: 0 }, uScale: { value: 600 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vAlpha;
      ${sizeAttenuation}
      void main() {
        vec3 p = position;
        float t = uTime * (0.08 + aSeed * 0.08);
        p += vec3(sin(t + aSeed * 40.0), sin(t * 1.3 + aSeed * 17.0) * 0.4, cos(t * 0.9 + aSeed * 23.0)) * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = pointSize(0.018 + aSeed * 0.02, mv);
        vAlpha = (0.25 + 0.35 * sin(uTime * 1.5 + aSeed * 30.0)) * smoothstep(40.0, 6.0, -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(1.6, 1.3, 1.0), a * max(vAlpha, 0.0));
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.uniforms = uniforms;
  return pts;
}
