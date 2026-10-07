"""
Builds the landing-page world in Blender and exports it for the web.

Outputs
  blender/world.blend        – the editable Blender scene
  public/models/world.glb    – the same scene as glTF binary, loaded by Three.js

Run with uv (no Blender install needed — uses Blender's `bpy` module):
  npm run models
or directly:
  uv run --python 3.11 --with "bpy==4.5.*" blender/build_scene.py

Or from a regular Blender install:
  blender --background --python blender/build_scene.py

Object names matter: src/world.js looks up "Monolith", "Runes", "RuneRing",
"Shard_0" … by name to animate them.
"""

import math
import os
import random

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GLB_PATH = os.path.join(ROOT, "public", "models", "world.glb")
BLEND_PATH = os.path.join(HERE, "world.blend")

random.seed(11)
np.random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ── helpers ─────────────────────────────────────────────────────────────

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def fbm(p, octaves=5, lac=2.03, gain=0.5):
    s, a, f = 0.0, 0.5, 1.0
    for _ in range(octaves):
        s += a * noise.noise(p * f)
        a *= gain
        f *= lac
    return s


def ridged(p, octaves=6):
    s, a, f = 0.0, 0.5, 1.0
    for _ in range(octaves):
        n = 1.0 - abs(noise.noise(p * f))
        s += a * n * n
        a *= 0.5
        f *= 2.0
    return s


def link(obj):
    scene.collection.objects.link(obj)
    return obj


def mesh_object(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def apply_all(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def shade(obj, smooth=True):
    for p in obj.data.polygons:
        p.use_smooth = smooth


def tileable_normal_map(name, size=512, strength=2.2):
    """Tileable rock-grain normal map made from wrapped value noise."""
    h = np.zeros((size, size), dtype=np.float32)
    amp = 1.0
    for cells in (4, 8, 16, 32, 64, 128):
        grid = np.random.rand(cells, cells).astype(np.float32)
        coords = np.arange(size) * cells / size
        i0 = np.floor(coords).astype(int)
        t = coords - i0
        t = t * t * (3 - 2 * t)
        i1 = (i0 + 1) % cells
        rows0 = grid[i0][:, i0] * (1 - t)[None, :] + grid[i0][:, i1] * t[None, :]
        rows1 = grid[i1][:, i0] * (1 - t)[None, :] + grid[i1][:, i1] * t[None, :]
        h += amp * (rows0 * (1 - t)[:, None] + rows1 * t[:, None])
        amp *= 0.55
    h = (h - h.min()) / (h.max() - h.min())
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    n = np.stack([-dx, -dy, np.ones_like(h)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgba = np.concatenate([n * 0.5 + 0.5, np.ones((size, size, 1), np.float32)], axis=-1)
    img = bpy.data.images.new(name, size, size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = os.path.join(HERE, f"{name}.png")
    img.file_format = "PNG"
    img.save()
    return img


def material(name, color=(0.5, 0.5, 0.5), rough=0.8, metal=0.0,
             emission=None, strength=0.0, vertex_color=None, normal_img=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if vertex_color:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = vertex_color
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    if normal_img:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = normal_img
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 1.0
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def paint_vertices(obj, fn, name="Col"):
    me = obj.data
    attr = me.color_attributes.new(name=name, type="FLOAT_COLOR", domain="POINT")
    for i, v in enumerate(me.vertices):
        attr.data[i].color = (*fn(v), 1.0)
    me.color_attributes.active_color = attr


def cube_uvs(obj, size=0.6):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")


def scale_uvs(obj, k):
    for loop in obj.data.uv_layers.active.data:
        loop.uv = loop.uv * k


# ── materials ───────────────────────────────────────────────────────────

rock_n = tileable_normal_map("rock_normal")

M_TERRAIN = material("Terrain", rough=0.93, vertex_color="Col", normal_img=rock_n)
M_BASALT = material("Basalt", color=(0.028, 0.027, 0.03), rough=0.48, normal_img=rock_n)
M_STONE = material("WeatheredStone", color=(0.26, 0.235, 0.205), rough=0.9, normal_img=rock_n)
M_RUNE = material("RuneGlow", color=(1.0, 0.45, 0.1), rough=0.4,
                  emission=(1.0, 0.42, 0.08), strength=9.0)
M_MOUNTAIN = material("Mountains", rough=1.0, vertex_color="Col")


# ── terrain: a cliff-top plateau that drops into a sea of cloud ─────────

def plateau_height(x, y):
    r = math.hypot(x, y)
    edge = 9.5 + fbm(Vector((x * 0.07, y * 0.07, 1.3)), 3) * 4.5
    t = smoothstep(edge, edge + 4.5, r)
    top = fbm(Vector((x * 0.13, y * 0.13, 0.0)), 4) * 0.45
    rough = fbm(Vector((x * 0.32, y * 0.32, 4.0)), 5) * 2.2
    ledges = math.floor((-t * 26.0) / 3.0) * 3.0 * 0.35 + (-t * 26.0) * 0.65
    return top * (1 - t) + ledges + rough * t


bpy.ops.mesh.primitive_grid_add(x_subdivisions=170, y_subdivisions=170, size=64)
terrain = bpy.context.active_object
terrain.name = "Terrain"
for v in terrain.data.vertices:
    v.co.z = plateau_height(v.co.x, v.co.y)
terrain.data.update()
shade(terrain)


def terrain_color(v):
    up = v.normal.z
    h = v.co.z
    n = fbm(Vector((v.co.x * 0.4, v.co.y * 0.4, 7.0)), 3)
    rock = Vector((0.115, 0.105, 0.098)) * (0.85 + n * 0.6)
    moss = Vector((0.085, 0.082, 0.035)) * (0.9 + n * 0.8)
    dry = Vector((0.19, 0.14, 0.075)) * (0.9 + n * 0.5)
    ground = moss.lerp(dry, smoothstep(-0.2, 0.3, n))
    flat = smoothstep(0.72, 0.9, up) * smoothstep(-2.5, -0.8, h)
    c = rock.lerp(ground, flat)
    c *= 0.55 + 0.45 * smoothstep(-14.0, -1.0, h)   # darker deeper down
    return tuple(c)


paint_vertices(terrain, terrain_color)
scale_uvs(terrain, 22.0)
terrain.data.materials.append(M_TERRAIN)

ground_z = plateau_height(0.0, 0.0)


# ── the monolith ────────────────────────────────────────────────────────

H = 7.4
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    top = v.co.z > 0
    v.co.x *= 1.1 if top else 1.45
    v.co.y *= 0.62 if top else 0.9
    v.co.z = H if top else 0.0
# chipped, uneven crown
crown = [v for v in bm.verts if v.co.z > H - 0.01]
for v in crown:
    v.co.z -= random.uniform(0.0, 0.55)
monolith = mesh_object("Monolith", bm)
bev = monolith.modifiers.new("Bevel", "BEVEL")
bev.width = 0.05
bev.segments = 3
monolith.location = (0.0, 0.0, ground_z + 0.5)
monolith.rotation_euler = Euler((math.radians(2.5), math.radians(-3.0), math.radians(8.0)))
apply_all(monolith)
monolith.data.materials.append(M_BASALT)
shade(monolith, smooth=False)
cube_uvs(monolith)

# Runes: short glowing strokes in columns down the front (-Y) face.
STROKES = [((0, 0), (0, 3)), ((0, 3), (2, 3)), ((2, 3), (2, 1)), ((0, 1), (2, 1)),
           ((0, 0), (2, 2)), ((2, 0), (0, 2)), ((1, 0), (1, 3)), ((0, 2), (2, 2)),
           ((0, 3), (1, 2)), ((2, 3), (1, 2)), ((0, 0), (2, 0))]
bm = bmesh.new()
cell = 0.11
for col_x in (-0.32, 0.0, 0.32):
    z = 1.2
    while z < H - 1.1:
        for (a, b) in random.sample(STROKES, random.randint(2, 4)):
            ax, az = a[0] * cell, a[1] * cell
            bx, bz = b[0] * cell, b[1] * cell
            length = math.hypot(bx - ax, bz - az)
            ang = math.atan2(bz - az, bx - ax)
            res = bmesh.ops.create_cube(bm, size=1.0)
            vs = res["verts"]
            bmesh.ops.scale(bm, vec=(length + 0.035, 0.03, 0.035), verts=vs)
            bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(-ang, 3, "Y"), verts=vs)
            depth = 0.9 + (0.62 - 0.9) * (z / H)
            bmesh.ops.translate(bm, vec=(col_x - cell + (ax + bx) / 2, -depth / 2 - 0.004, z + (az + bz) / 2), verts=vs)
        z += cell * 3 + random.uniform(0.18, 0.32)
runes = mesh_object("Runes", bm)
runes.location = (0.0, 0.0, ground_z + 0.5)
runes.rotation_euler = Euler((math.radians(2.5), math.radians(-3.0), math.radians(8.0)))
apply_all(runes)
runes.data.materials.append(M_RUNE)


# ── stepped base, rune ring, ruined pillars, rubble ─────────────────────

bm = bmesh.new()
for r, z0, h in ((2.6, -0.4, 0.55), (2.0, 0.15, 0.35)):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r * 0.97, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, z0 + h / 2), verts=res["verts"])
steps = mesh_object("Steps", bm)
steps.location = (0, 0, ground_z)
steps.rotation_euler.z = math.radians(22.5)
bev = steps.modifiers.new("Bevel", "BEVEL")
bev.width = 0.04
bev.segments = 2
apply_all(steps)
steps.data.materials.append(M_STONE)
cube_uvs(steps)

bpy.ops.mesh.primitive_torus_add(major_radius=1.8, minor_radius=0.025, major_segments=96, minor_segments=6,
                                 location=(0, 0, ground_z + 0.52))
ring = bpy.context.active_object
ring.name = "RuneRing"
ring.data.materials.append(M_RUNE)

bm = bmesh.new()
for i in range(9):
    ang = math.radians(i * 40 + 20)
    if abs(math.degrees(ang) % 360 - 270) < 40:      # keep the camera side open
        continue
    r = 6.2 + random.uniform(-0.4, 0.6)
    x, y = math.cos(ang) * r, math.sin(ang) * r
    h = random.uniform(1.0, 3.8)
    fallen = random.random() < 0.25
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.38, radius2=0.33, depth=h)
    vs = res["verts"]
    for v in vs:
        if v.co.z > 0:
            v.co.z += random.uniform(-0.45, 0.05)          # broken top
        v.co.x += random.uniform(-0.02, 0.02)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=vs)
    if fallen:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(88), 3, "X") @
                         Matrix.Rotation(random.uniform(0, 6.28), 3, "Z"), verts=vs)
        bmesh.ops.translate(bm, vec=(x, y, plateau_height(x, y) + 0.3), verts=vs)
    else:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(random.uniform(-0.08, 0.08), 3, "X"), verts=vs)
        bmesh.ops.translate(bm, vec=(x, y, plateau_height(x, y) - 0.25), verts=vs)
pillars = mesh_object("Pillars", bm)
pillars.data.materials.append(M_STONE)
cube_uvs(pillars)
shade(pillars, smooth=False)

bm = bmesh.new()
for _ in range(46):
    ang = random.uniform(0, math.tau)
    r = random.uniform(2.8, 10.0)
    x, y = math.cos(ang) * r, math.sin(ang) * r
    if plateau_height(x, y) < -1.0:
        continue
    s = random.uniform(0.08, 0.38)
    res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    vs = res["verts"]
    for v in vs:
        v.co *= 1.0 + random.uniform(-0.25, 0.25)
    bmesh.ops.scale(bm, vec=(s * random.uniform(0.8, 1.6), s, s * random.uniform(0.5, 0.9)), verts=vs)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Euler((0, 0, random.uniform(0, 6.28))).to_matrix(), verts=vs)
    bmesh.ops.translate(bm, vec=(x, y, plateau_height(x, y) + s * 0.3), verts=vs)
rubble = mesh_object("Rubble", bm)
rubble.data.materials.append(M_STONE)
cube_uvs(rubble, 0.4)
shade(rubble, smooth=False)


# ── floating shards that orbit the monolith ─────────────────────────────

for i in range(7):
    bm = bmesh.new()
    res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    seed = Vector((i * 3.1, i * 1.7, 0.5))
    for v in res["verts"]:
        v.co *= 1.0 + 0.32 * noise.noise(v.co * 1.4 + seed)
    s = random.uniform(0.25, 0.65)
    bmesh.ops.scale(bm, vec=(s * 0.7, s * 0.7, s * 1.5), verts=res["verts"])
    # flat cut on top, like a broken-off chunk of the monolith
    for v in res["verts"]:
        v.co.z = min(v.co.z, s * 0.9)
    shard = mesh_object(f"Shard_{i}", bm)
    ang = i / 7 * math.tau + random.uniform(-0.3, 0.3)
    r = random.uniform(2.6, 4.2)
    shard.location = (math.cos(ang) * r, math.sin(ang) * r, ground_z + random.uniform(2.5, 7.5))
    shard.rotation_euler = Euler((random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5), random.uniform(0, 6.28)))
    shard.data.materials.append(M_BASALT)
    cube_uvs(shard, 0.5)
    shade(shard, smooth=False)


# ── distant mountain range ──────────────────────────────────────────────

bpy.ops.mesh.primitive_grid_add(x_subdivisions=220, y_subdivisions=60, size=1.0)
mountains = bpy.context.active_object
mountains.name = "Mountains"
for v in mountains.data.vertices:
    x = v.co.x * 520.0
    y = v.co.y * 140.0 + 150.0
    ridge = ridged(Vector((x * 0.011, y * 0.011, 3.0)))
    lift = smoothstep(80.0, 150.0, y)
    v.co.x, v.co.y = x, y
    v.co.z = -32.0 + ridge * 95.0 * (0.35 + 0.65 * lift)
mountains.data.update()
shade(mountains)


def mountain_color(v):
    snow = smoothstep(18.0, 34.0, v.co.z + noise.noise(v.co * 0.08) * 6.0) * smoothstep(0.35, 0.7, v.normal.z)
    rock = Vector((0.045, 0.048, 0.06))
    return tuple(rock.lerp(Vector((0.62, 0.64, 0.7)), snow))


paint_vertices(mountains, mountain_color)
mountains.data.materials.append(M_MOUNTAIN)


# ── save + export ───────────────────────────────────────────────────────

os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, compress=True)

bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    export_apply=True,
    export_vertex_color="ACTIVE",
    export_lights=False,
    export_cameras=False,
    export_image_format="JPEG",
    export_jpeg_quality=88,
)
print("wrote", GLB_PATH, round(os.path.getsize(GLB_PATH) / 1e6, 2), "MB")
