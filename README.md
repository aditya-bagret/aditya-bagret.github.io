# aditya-bagret.github.io

A game-style 3D landing page: a glowing rune monolith on a cliff above a sea of clouds,
built with **Three.js** and **Vite**. The 3D world is modelled in **Blender** with a Python
script and exported as **glTF (`.glb`)**, which Three.js loads directly.

```
blender/build_scene.py   → Blender script that models the world
blender/world.blend      → the editable Blender scene it produces
public/models/world.glb  → the exported glTF that the site loads
src/main.js              → renderer, camera, lighting, loading screen, menu
src/clouds.js            → shader cloud sea + drifting mist
src/particles.js         → embers and dust
src/grade.js             → film grain / vignette / colour grade pass
src/audio.js             → generated ambient wind + drone (off by default)
```

## Develop

```bash
npm install
npm run dev
```

## Rebuild the 3D world

Needs [uv](https://docs.astral.sh/uv/) only — Blender runs as a Python module (`bpy`):

```bash
npm run models
```

Or open `blender/world.blend` in Blender, edit, and export **File → Export → glTF 2.0 (.glb)**
to `public/models/world.glb`. Keep the object names (`Monolith`, `Runes`, `RuneRing`,
`Shard_0`…) — the page animates them by name.

## Links

The two menu links live in `index.html` (search for `data-warp`).

## Deploy

Every push to `main` builds and publishes through GitHub Actions
(`.github/workflows/deploy.yml`). In the repo's **Settings → Pages**, **Source** must be
**GitHub Actions**.
