import * as THREE from "three";

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = m * p; a *= 0.5; }
    return s;
  }
`;

/**
 * A sea of cloud below the cliffs: a big flat plane whose shader paints
 * drifting fbm cloud, lit warm on the sun side and fading into the haze.
 */
export function createCloudSea({ y, opacity, floor = 0, scale, wind, sunDir, sunColor, shadeColor, fogColor }) {
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir.clone().normalize() },
    uSunColor: { value: sunColor.clone() },
    uShade: { value: shadeColor.clone() },
    uFog: { value: fogColor.clone() },
    uOpacity: { value: opacity },
    uFloor: { value: floor },
    uScale: { value: scale },
    uWind: { value: wind.clone() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uScale, uFloor;
      uniform vec3 uSunDir, uSunColor, uShade, uFog;
      uniform vec2 uWind;
      varying vec3 vWorld;
      ${NOISE}
      void main() {
        vec2 p = vWorld.xz * uScale;
        float n = fbm(p + uWind * uTime);
        float n2 = fbm(p * 2.1 - uWind * uTime * 1.6 + n * 1.8);
        float dens = smoothstep(0.34, 0.78, n * 0.62 + n2 * 0.5);

        vec3 V = normalize(vWorld - cameraPosition);
        float toSun = pow(max(dot(V, uSunDir), 0.0), 5.0);
        vec3 col = mix(uShade, uSunColor, smoothstep(0.25, 0.95, n2) * 0.75 + toSun * 0.5);
        col += uSunColor * toSun * 1.4 * dens;

        float dist = length(vWorld.xz - cameraPosition.xz);
        float haze = 1.0 - exp(-pow(dist * 0.0042, 1.5));
        col = mix(col, uFog, haze * 0.9);
        float a = mix(max(dens, uFloor), 1.0, haze) * uOpacity;
        a *= 1.0 - smoothstep(900.0, 1150.0, dist);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = -1;
  mesh.update = (t) => (uniforms.uTime.value = t);
  return mesh;
}

/** Soft mist billboards that drift slowly across the cliff edge. */
export function createMist({ count, fogColor, center }) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  for (let i = 0; i < 26; i++) {
    const x = 128 + (Math.random() - 0.5) * 120;
    const y = 128 + (Math.random() - 0.5) * 50;
    const r = 30 + Math.random() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.22)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: fogColor.clone().multiplyScalar(1.35),
      transparent: true,
      depthWrite: false,
      opacity: 0.32 + Math.random() * 0.28,
    });
    const s = new THREE.Sprite(mat);
    const ang = Math.random() * Math.PI * 2;
    const r = 12 + Math.random() * 22;
    s.position.set(center.x + Math.cos(ang) * r, center.y - 4 + Math.random() * 3.5, center.z + Math.sin(ang) * r - 6);
    s.scale.set(26 + Math.random() * 22, 8 + Math.random() * 5, 1);
    s.userData.speed = 0.25 + Math.random() * 0.45;
    group.add(s);
    puffs.push(s);
  }
  group.update = (dt) => {
    for (const s of puffs) {
      s.position.x += s.userData.speed * dt;
      if (s.position.x > center.x + 40) s.position.x = center.x - 40;
    }
  };
  return group;
}
