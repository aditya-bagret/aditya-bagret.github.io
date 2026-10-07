import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createCloudSea, createMist } from "./clouds.js";
import { createEmbers, createDust } from "./particles.js";
import { GradeShader } from "./grade.js";
import { Ambience } from "./audio.js";

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lowTier = matchMedia("(pointer: coarse)").matches || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;

// ── small UI bits that work even without WebGL ─────────────────────────
$("year").textContent = new Date().getFullYear();
const tickClock = () => {
  const d = new Date();
  $("clock").textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
tickClock();
setInterval(tickClock, 15000);

const ambience = new Ambience();
$("sound").addEventListener("click", () => {
  const on = ambience.toggle();
  $("sound").setAttribute("aria-pressed", String(on));
  $("sound").querySelector(".sound-label").textContent = on ? "Sound on" : "Sound off";
});

const tips = [
  "Tip · Press 1 to jump straight to the portfolio",
  "Tip · Press 2 to browse every project",
  "Tip · Move your mouse to look around",
  "Tip · Turn the sound on for the full atmosphere",
];
let tipIndex = 0;
const tipTimer = setInterval(() => {
  const el = $("loader-tip");
  el.style.opacity = 0;
  setTimeout(() => {
    tipIndex = (tipIndex + 1) % tips.length;
    el.textContent = tips[tipIndex];
    el.style.opacity = 1;
  }, 400);
}, 3200);

// ── renderer ───────────────────────────────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("scene"), antialias: false, powerPreference: "high-performance" });
} catch (err) {
  console.warn("WebGL unavailable, showing the static page", err);
}

if (!renderer) {
  document.body.classList.add("no-webgl");
  $("loader").classList.add("gone");
  $("ui").classList.add("on");
  clearInterval(tipTimer);
} else {
  start(renderer);
}

function start(renderer) {
  let pixelRatio = Math.min(devicePixelRatio, lowTier ? 1.25 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.74;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the world is static: draw shadows once

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 3000);

  // ── sky, sun, haze ───────────────────────────────────────────────────
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 2.4), THREE.MathUtils.degToRad(186));
  const makeSky = () => {
    const sky = new Sky();
    sky.scale.setScalar(2500);
    const u = sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 3.0;
    u.mieCoefficient.value = 0.0022;
    u.mieDirectionalG.value = 0.9;
    u.sunPosition.value.copy(sunDir);
    return sky;
  };
  scene.add(makeSky());

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeSky());
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.55;

  const fogColor = new THREE.Color("#5a4a55");
  scene.fog = new THREE.FogExp2(fogColor, 0.0072);

  const sunColor = new THREE.Color("#ffb27c");
  const sun = new THREE.DirectionalLight(sunColor, 3.4);
  sun.position.copy(sunDir).multiplyScalar(60).add(new THREE.Vector3(0, 6, 0));
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(lowTier ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  scene.add(new THREE.HemisphereLight("#8fa6d8", "#3b2a20", 0.55));

  const runeLight = new THREE.PointLight("#ff7a2a", 14, 16, 1.6);
  scene.add(runeLight);

  // ── cloud sea + mist ─────────────────────────────────────────────────
  const cloudLow = createCloudSea({
    y: -9, opacity: 1, floor: 0.82, scale: 0.012, wind: new THREE.Vector2(0.018, 0.006),
    sunDir, sunColor: new THREE.Color("#ffb88a").multiplyScalar(1.1),
    shadeColor: new THREE.Color("#3a3240"), fogColor,
  });
  const cloudHigh = createCloudSea({
    y: -6.2, opacity: 0.5, floor: 0, scale: 0.02, wind: new THREE.Vector2(0.03, 0.012),
    sunDir, sunColor: new THREE.Color("#ffc9a0").multiplyScalar(1.2),
    shadeColor: new THREE.Color("#4a4050"), fogColor,
  });
  scene.add(cloudLow, cloudHigh);

  // ── post-processing ──────────────────────────────────────────────────
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
    type: THREE.HalfFloatType,
    samples: lowTier ? 0 : 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.55, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // ── world (exported from Blender) ────────────────────────────────────
  const world = { shards: [], runeMat: null, ringMat: null, base: new THREE.Vector3(), top: 7.4 };
  let embers, dust, mist;

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => setProgress(loaded / total);
  const loader = new GLTFLoader(manager);
  loader.load(
    `${import.meta.env.BASE_URL}models/world.glb`,
    (gltf) => {
      setupWorld(gltf.scene);
      onLoaded();
    },
    (ev) => ev.total && setProgress(ev.loaded / ev.total),
    (err) => {
      console.error("Could not load world.glb", err);
      onLoaded();
    }
  );

  function setupWorld(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.name;
      o.castShadow = !/Mountains|Grid\.001|Runes|Torus|RuneRing|Shard_/.test(name);
      o.receiveShadow = !/Mountains|Grid\.001/.test(name);
      const m = o.material;
      if (m.normalMap) m.normalScale.set(1.4, 1.4);
      if (m.name === "Basalt") { m.envMapIntensity = 1.6; m.roughness = 0.42; }
      if (m.name === "Terrain" || m.name === "WeatheredStone") m.envMapIntensity = 0.7;
      if (m.name === "Mountains") { m.envMapIntensity = 0.4; }
    });

    // Flatter, further range so the peaks read as distant, rising out of the clouds.
    const range = root.getObjectByName("Mountains");
    if (range) {
      range.scale.set(1.25, 0.62, 1.3);
      range.position.y = -4;
    }

    const monolith = root.getObjectByName("Monolith");
    const box = new THREE.Box3().setFromObject(monolith);
    world.base.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    world.top = box.max.y - box.min.y;

    const runes = root.getObjectByName("Runes");
    if (runes) {
      world.runeMat = runes.material;
      world.runeMat.userData.base = world.runeMat.emissiveIntensity;
    }
    const ring = root.getObjectByName("RuneRing");
    if (ring) {
      ring.material = ring.material.clone();
      world.ringMat = ring.material;
      world.ringMat.userData.base = world.ringMat.emissiveIntensity;
    }

    root.traverse((o) => {
      if (!o.name.startsWith("Shard_")) return;
      const dx = o.position.x - world.base.x, dz = o.position.z - world.base.z;
      world.shards.push({
        obj: o,
        r: Math.hypot(dx, dz),
        ang: Math.atan2(dz, dx),
        y: o.position.y,
        phase: Math.random() * 6.28,
        speed: 0.05 + Math.random() * 0.06,
        spin: (Math.random() - 0.5) * 0.4,
      });
    });

    scene.add(root);
    renderer.shadowMap.needsUpdate = true;

    runeLight.position.set(world.base.x, world.base.y + 2.2, world.base.z + 1.6);
    sun.target.position.copy(world.base);

    embers = createEmbers({ count: lowTier ? 140 : 320, origin: world.base, radius: 2.0 });
    dust = createDust({
      count: lowTier ? 260 : 650,
      center: new THREE.Vector3(world.base.x, world.base.y - 1, world.base.z + 2),
      size: new THREE.Vector3(30, 11, 26),
    });
    mist = createMist({ count: lowTier ? 7 : 12, fogColor, center: world.base });
    scene.add(embers, dust, mist);
    resize();
  }

  // ── loading screen → title → intro ───────────────────────────────────
  let shownProgress = 0;
  function setProgress(p) {
    shownProgress = Math.max(shownProgress, Math.min(1, p));
    $("bar-fill").style.width = `${shownProgress * 100}%`;
    $("loader-pct").textContent = `${Math.round(shownProgress * 100)}%`;
  }

  let state = "loading";
  function onLoaded() {
    setProgress(1);
    // compile shaders now so the first real frame doesn't hitch
    renderer.compile(scene, camera);
    state = "ready";
    $("loader").classList.add("ready");
    $("loader-status").hidden = true;
    $("loader-start").hidden = false;
    $("loader-start").textContent = matchMedia("(pointer: coarse)").matches ? "Tap to begin" : "Press any key to begin";
    const begin = (ev) => {
      if (ev.type === "keydown" && (ev.metaKey || ev.ctrlKey || ev.altKey)) return;
      removeEventListener("keydown", begin);
      $("loader").removeEventListener("pointerdown", begin);
      startIntro();
    };
    addEventListener("keydown", begin);
    $("loader").addEventListener("pointerdown", begin);
  }

  function startIntro() {
    state = "intro";
    clearInterval(tipTimer);
    $("loader").classList.add("gone");
    introT = reduceMotion ? 1 : 0;
    setTimeout(() => {
      $("ui").classList.add("on");
      state = "menu";
    }, reduceMotion ? 0 : 2600);
  }

  // ── camera rig ───────────────────────────────────────────────────────
  const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 36 };
  function heroPose() {
    const b = world.base;
    const portrait = innerWidth / innerHeight < 0.9;
    if (portrait) {
      pose.pos.set(b.x + 1.5, b.y + 4.5, b.z + 30);
      pose.look.set(b.x, b.y - 1.5, b.z);
      pose.fov = 52;
    } else {
      pose.pos.set(b.x + 2.2, b.y + 5.4, b.z + 25);
      pose.look.set(b.x - 4.8, b.y + 3.4, b.z);
      pose.fov = 36;
    }
    return pose;
  }
  const introFrom = { pos: new THREE.Vector3(14, 22, 52), look: new THREE.Vector3(0, 1, 0) };
  let introT = 0;
  const camPos = new THREE.Vector3().copy(introFrom.pos);
  const camLook = new THREE.Vector3().copy(introFrom.look);
  const mouse = new THREE.Vector2(), mouseSmooth = new THREE.Vector2();
  let hover = null;              // "portfolio" | "projects" | null
  let warp = null;               // { t, href }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  addEventListener("pointermove", (e) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  });

  // ── menu: hover feedback + warp-out on click ─────────────────────────
  document.querySelectorAll("[data-warp]").forEach((a) => {
    a.addEventListener("pointerenter", () => (hover = a.dataset.warp));
    a.addEventListener("pointerleave", () => (hover = null));
    a.addEventListener("focus", () => (hover = a.dataset.warp));
    a.addEventListener("blur", () => (hover = null));
    a.addEventListener("click", (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
      ev.preventDefault();
      beginWarp(a.dataset.warp, a.href);
    });
  });
  addEventListener("keydown", (ev) => {
    if (state !== "menu" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const key = { 1: "portfolio", 2: "projects" }[ev.key];
    if (!key) return;
    const a = document.querySelector(`.cta [data-warp="${key}"]`);
    beginWarp(key, a.href);
  });

  function beginWarp(kind, href) {
    if (warp) return;
    if (reduceMotion || state !== "menu") { location.href = href; return; }
    hover = kind;
    warp = { t: 0, href, from: camPos.clone(), look: camLook.clone() };
    $("ui").classList.remove("on");
    setTimeout(() => $("fade").classList.add("on"), 750);
    setTimeout(() => (location.href = href), 1450);
  }

  addEventListener("pageshow", (ev) => {
    if (!ev.persisted) return;
    warp = null;
    $("fade").classList.remove("on");
    $("ui").classList.add("on");
  });

  // ── resize ───────────────────────────────────────────────────────────
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    heroPose();
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    composer.setPixelRatio(pixelRatio);
    const px = pixelRatio;
    grade.uniforms.uRes.value = [w * px, h * px];
    const scale = (h * px) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    if (embers) embers.uniforms.uScale.value = scale;
    if (dust) dust.uniforms.uScale.value = scale;
  }
  addEventListener("resize", resize);
  resize();

  // ── frame loop ───────────────────────────────────────────────────────
  const timer = new THREE.Timer();
  let boost = 0, push = 0, t = 0;
  // Adaptive resolution: if frames are slow, render fewer pixels.
  let slow = 0, sampled = 0;
  function frame(now) {
    timer.update(now);
    const raw = timer.getDelta();
    if (state === "menu" && raw < 0.5) {
      sampled++;
      if (raw > 1 / 40) slow++;
      if (sampled >= 90) {
        if (slow > 45 && pixelRatio > 0.85) { pixelRatio = Math.max(0.85, pixelRatio - 0.2); resize(); }
        slow = sampled = 0;
      }
    }
    step(Math.min(raw, 0.05));
  }
  function step(dt) {
    t += dt;
    heroPose();

    // hover / warp energy
    const wantBoost = warp ? 3 : hover === "portfolio" ? 1.4 : hover === "projects" ? 0.7 : 0;
    boost += (wantBoost - boost) * Math.min(1, dt * 3);
    push += ((hover === "portfolio" ? 1 : 0) - push) * Math.min(1, dt * 2);

    // camera
    const target = new THREE.Vector3().copy(pose.pos);
    const look = new THREE.Vector3().copy(pose.look);
    mouseSmooth.lerp(mouse, Math.min(1, dt * 2.5));
    if (!reduceMotion) {
      target.x += Math.sin(t * 0.13) * 0.55 + mouseSmooth.x * 1.3;
      target.y += Math.sin(t * 0.21) * 0.22 - mouseSmooth.y * 0.55;
      look.x += mouseSmooth.x * 0.35;
    }
    target.lerp(look, push * 0.08);

    if (state === "loading" || state === "ready") {
      camPos.copy(introFrom.pos);
      camLook.copy(introFrom.look);
    } else if (warp) {
      warp.t = Math.min(1, warp.t + dt / 1.4);
      const k = ease(warp.t);
      const end = new THREE.Vector3(world.base.x + 0.4, world.base.y + 3.6, world.base.z + 3.4);
      const endLook = new THREE.Vector3(world.base.x, world.base.y + 3.8, world.base.z);
      camPos.lerpVectors(warp.from, end, k);
      camLook.lerpVectors(warp.look, endLook, k);
      camera.fov = pose.fov - 10 * k;
      camera.updateProjectionMatrix();
      grade.uniforms.uFade.value = Math.max(0, (warp.t - 0.55) * 2);
    } else if (introT < 1) {
      introT = Math.min(1, introT + dt / 4.2);
      const k = ease(introT);
      camPos.lerpVectors(introFrom.pos, target, k);
      camLook.lerpVectors(introFrom.look, look, k);
    } else {
      camPos.lerp(target, Math.min(1, dt * 2));
      camLook.lerp(look, Math.min(1, dt * 2));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // world motion
    const flicker = 0.86 + 0.08 * Math.sin(t * 2.3) + 0.06 * Math.sin(t * 7.7 + Math.sin(t * 1.3) * 3);
    if (world.runeMat) world.runeMat.emissiveIntensity = world.runeMat.userData.base * flicker * (1 + boost * 0.9);
    if (world.ringMat) world.ringMat.emissiveIntensity = world.ringMat.userData.base * (0.7 + 0.3 * Math.sin(t * 1.4)) * (1 + boost);
    runeLight.intensity = 14 * flicker * (1 + boost * 0.8);
    bloom.strength = 0.5 + boost * 0.2;

    const orbit = 1 + (hover === "projects" ? 4 : 0) + (warp ? 6 : 0);
    for (const s of world.shards) {
      s.ang += dt * s.speed * orbit;
      s.obj.position.set(
        world.base.x + Math.cos(s.ang) * s.r,
        s.y + Math.sin(t * 0.6 + s.phase) * 0.3,
        world.base.z + Math.sin(s.ang) * s.r
      );
      s.obj.rotation.y += dt * s.spin * orbit;
      s.obj.rotation.x = Math.sin(t * 0.3 + s.phase) * 0.2;
    }

    cloudLow.update(t);
    cloudHigh.update(t);
    if (embers) { embers.uniforms.uTime.value = t; embers.uniforms.uBoost.value = boost; }
    if (dust) dust.uniforms.uTime.value = t;
    if (mist) mist.update(dt);
    grade.uniforms.uTime.value = t;

    composer.render(dt);
  }

  renderer.setAnimationLoop(frame);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else { timer.reset(); renderer.setAnimationLoop(frame); }
  });

  // Dev-only hooks for stepping frames and timing the GPU by hand.
  if (import.meta.env.DEV) {
    window.__dev = {
      camera, world, scene, bloom, composer, renderer,
      start: () => state === "ready" && startIntro(),
      step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); },
      bench(n = 30) {
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        const t0 = performance.now();
        for (let i = 0; i < n; i++) { step(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
        return ((performance.now() - t0) / n).toFixed(2) + " ms/frame";
      },
    };
  }
}
