#!/usr/bin/env python3
"""Generate original, tileable-ish PBR textures for the medieval blacksmith.

No downloaded imagery is used. The Unity material loader consumes the albedo,
normal, metallic/smoothness and AO maps produced here. Requires numpy + Pillow.
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Hero architectural maps are authored at 2K; mobile import settings can
# downsample them per quality tier without making the source assets blurry.
SIZE = 2048
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Assets" / "Resources" / "BlacksmithExterior" / "Textures"
OUT.mkdir(parents=True, exist_ok=True)
RESAMPLE = Image.Resampling.BICUBIC


def fractal(rng, size=SIZE, octaves=((4, .34), (9, .27), (19, .19), (39, .12), (83, .08))):
    result = np.zeros((size, size), dtype=np.float32)
    for grid, amplitude in octaves:
        source = Image.fromarray(np.uint8(rng.random((grid, grid)) * 255), "L")
        layer = np.asarray(source.resize((size, size), RESAMPLE), dtype=np.float32) / 255.0
        result += layer * amplitude
    return np.clip(result, 0.0, 1.0)


def to_image(array):
    return Image.fromarray(np.uint8(np.clip(array, 0, 1) * 255), "L")


def normal_from_height(height, strength=5.0):
    # Preserve the same physical relief when the authoring resolution grows.
    strength *= SIZE / 512.0
    dy, dx = np.gradient(height.astype(np.float32))
    normal = np.stack((-dx * strength, -dy * strength, np.ones_like(height)), axis=-1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-6)
    return np.uint8(np.clip(normal * .5 + .5, 0, 1) * 255)


def save_set(name, albedo, height, metallic, smoothness, ao):
    Image.fromarray(np.uint8(np.clip(albedo, 0, 1) * 255), "RGB").save(OUT / f"{name}_albedo.png", optimize=True)
    Image.fromarray(normal_from_height(height), "RGB").save(OUT / f"{name}_normal.png", optimize=True)
    metallic = np.broadcast_to(metallic, (SIZE, SIZE)).astype(np.float32)
    smoothness = np.broadcast_to(smoothness, (SIZE, SIZE)).astype(np.float32)
    packed = np.dstack((np.repeat(metallic[..., None], 3, axis=2), smoothness[..., None]))
    Image.fromarray(np.uint8(np.clip(packed, 0, 1) * 255), "RGBA").save(OUT / f"{name}_metallic_smoothness.png", optimize=True)
    to_image(ao).save(OUT / f"{name}_ao.png", optimize=True)


def bevel_polygon(x, y, w, h, bevel, rng):
    j = lambda: float(rng.uniform(-2.4, 2.4))
    return [
        (x + bevel + j(), y + j()), (x + w - bevel + j(), y + j()),
        (x + w + j(), y + bevel + j()), (x + w + j(), y + h - bevel + j()),
        (x + w - bevel + j(), y + h + j()), (x + bevel + j(), y + h + j()),
        (x + j(), y + h - bevel + j()), (x + j(), y + bevel + j())
    ]


def make_stone():
    rng = np.random.default_rng(1138)
    noise = fractal(rng)
    albedo_image = Image.new("RGB", (SIZE, SIZE), (24, 28, 29))
    mask_image = Image.new("L", (SIZE, SIZE), 22)
    color_draw = ImageDraw.Draw(albedo_image)
    mask_draw = ImageDraw.Draw(mask_image)
    row_height = SIZE / 5
    for row in range(5):
        width = SIZE / 4
        offset = -width * .5 if row % 2 else 0
        for col in range(-1, 5):
            x = col * width + offset + 3
            y = row * row_height + 3
            poly = bevel_polygon(x, y, width - 6, row_height - 6, 8, rng)
            variation = int(rng.integers(-10, 15))
            base = (55 + variation, 60 + variation, 62 + variation)
            color_draw.polygon(poly, fill=base)
            mask_draw.polygon(poly, fill=int(rng.integers(172, 232)))
    mask = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(1.1)), dtype=np.float32) / 255.0
    color = np.asarray(albedo_image, dtype=np.float32) / 255.0
    color += (noise[..., None] - .5) * .20
    cracks = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(cracks)
    for _ in range(31):
        x, y = rng.integers(0, SIZE, 2)
        points = [(int(x), int(y))]
        for _ in range(int(rng.integers(2, 6))):
            x += rng.integers(-14, 15)
            y += rng.integers(5, 20)
            points.append((int(x), int(y)))
        draw.line(points, fill=int(rng.integers(80, 180)), width=1)
    crack = np.asarray(cracks, dtype=np.float32) / 255.0
    moss = np.clip((fractal(rng, octaves=((5, .55), (17, .3), (41, .15))) - .56) * 4, 0, 1) * (1 - mask)
    color[..., 0] -= crack * .12 + moss * .04
    color[..., 1] -= crack * .11 - moss * .07
    color[..., 2] -= crack * .10 - moss * .05
    height = .17 + mask * .66 + (noise - .5) * .18 - crack * .17
    ao = np.clip(.46 + mask * .52 - crack * .22, 0, 1)
    save_set("stone", color, height, .0, .19 + noise * .09, ao)


def make_wood():
    rng = np.random.default_rng(2901)
    noise = fractal(rng)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    warped = xx + fractal(rng, octaves=((3, .6), (13, .3), (31, .1))) * 24
    grain = (np.sin(warped * .22 + np.sin(yy * .023) * 2.4) * .5 + .5)
    fine = np.sin(warped * .79 + yy * .003) * .5 + .5
    knots = np.zeros((SIZE, SIZE), dtype=np.float32)
    for cx, cy, rx, ry in ((105, 132, 23, 61), (348, 331, 28, 78), (221, 456, 18, 48)):
        distance = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
        knots += np.exp(-distance * 2.2) * np.sin(distance * 17)
    seams = np.minimum(xx % 86, 86 - (xx % 86))
    seam_mask = np.clip(seams / 3.2, 0, 1)
    value = .48 + (grain - .5) * .31 + (fine - .5) * .11 + (noise - .5) * .21 + knots * .09
    value *= .55 + seam_mask * .45
    color = np.stack((value * .39, value * .235, value * .135), axis=-1)
    scratches = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(scratches)
    for _ in range(115):
        x = int(rng.integers(0, SIZE)); y = int(rng.integers(0, SIZE))
        draw.line((x, y, x + int(rng.integers(-3, 4)), y + int(rng.integers(8, 62))), fill=int(rng.integers(20, 100)), width=1)
    scratch = np.asarray(scratches, dtype=np.float32) / 255.0
    color += scratch[..., None] * .09
    height = .32 + grain * .23 + fine * .08 + noise * .13 - (1 - seam_mask) * .23 - scratch * .08
    save_set("wood", color, height, .0, .20 + grain * .13, .60 + seam_mask * .34 - scratch * .1)


def make_roof():
    rng = np.random.default_rng(7331)
    noise = fractal(rng)
    albedo_image = Image.new("RGB", (SIZE, SIZE), (13, 18, 23))
    mask_image = Image.new("L", (SIZE, SIZE), 18)
    color_draw = ImageDraw.Draw(albedo_image)
    mask_draw = ImageDraw.Draw(mask_image)
    rows, cols = 6, 4
    h, w = SIZE / rows, SIZE / cols
    for row in range(rows):
        offset = -w * .5 if row % 2 else 0
        for col in range(-1, cols + 1):
            x = col * w + offset + 2
            y = row * h + 2
            poly = bevel_polygon(x, y, w - 4, h - 4, 4, rng)
            variation = int(rng.integers(-9, 12))
            color_draw.polygon(poly, fill=(31 + variation, 39 + variation, 47 + variation))
            mask_draw.polygon(poly, fill=int(rng.integers(160, 235)))
    mask = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(.65)), dtype=np.float32) / 255.0
    color = np.asarray(albedo_image, dtype=np.float32) / 255.0 + (noise[..., None] - .5) * .15
    cracks = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(cracks)
    for _ in range(42):
        x, y = [int(v) for v in rng.integers(0, SIZE, 2)]
        draw.line((x, y, x + int(rng.integers(-20, 21)), y + int(rng.integers(9, 36))), fill=150, width=1)
    crack = np.asarray(cracks, dtype=np.float32) / 255.0
    color -= crack[..., None] * .09
    height = .15 + mask * .67 + noise * .12 - crack * .16
    save_set("roof", color, height, .06, .25 + noise * .18, .42 + mask * .54 - crack * .18)


def make_metal():
    rng = np.random.default_rng(9917)
    hammered = fractal(rng, octaves=((7, .28), (23, .31), (57, .25), (121, .16)))
    broad = fractal(rng, octaves=((3, .65), (11, .25), (37, .1)))
    rust = np.clip((broad - .54) * 4.8, 0, 1)
    base = np.stack((.19 + hammered * .14, .205 + hammered * .14, .21 + hammered * .14), axis=-1)
    rust_color = np.stack((.29 + hammered * .18, .12 + hammered * .07, .055 + hammered * .035), axis=-1)
    color = base * (1 - rust[..., None]) + rust_color * rust[..., None]
    scratches = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(scratches)
    for _ in range(185):
        x, y = [int(v) for v in rng.integers(0, SIZE, 2)]
        length = int(rng.integers(4, 48))
        draw.line((x, y, x + length, y + int(rng.integers(-3, 4))), fill=int(rng.integers(30, 145)), width=1)
    scratch = np.asarray(scratches, dtype=np.float32) / 255.0
    color += scratch[..., None] * .16 * (1 - rust[..., None])
    height = .35 + (hammered - .5) * .34 - rust * .09 - scratch * .06
    metallic = .88 * (1 - rust) + .16 * rust
    smooth = (.48 + hammered * .25) * (1 - rust) + .19 * rust + scratch * .12
    save_set("metal", color, height, metallic, smooth, .73 + hammered * .23 - rust * .14)


def make_cobble():
    rng = np.random.default_rng(42017)
    noise = fractal(rng)
    albedo_image = Image.new("RGB", (SIZE, SIZE), (19, 22, 20))
    mask_image = Image.new("L", (SIZE, SIZE), 16)
    color_draw = ImageDraw.Draw(albedo_image)
    mask_draw = ImageDraw.Draw(mask_image)
    rows, cols = 6, 5
    h, w = SIZE / rows, SIZE / cols
    for row in range(rows):
        offset = -w * .5 if row % 2 else 0
        for col in range(-1, cols + 1):
            x = col * w + offset + 3
            y = row * h + 3
            poly = bevel_polygon(x, y, w - 6, h - 6, 11, rng)
            variation = int(rng.integers(-12, 14))
            color_draw.polygon(poly, fill=(64 + variation, 62 + variation, 55 + variation))
            mask_draw.polygon(poly, fill=int(rng.integers(166, 235)))
    mask = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(1.3)), dtype=np.float32) / 255.0
    color = np.asarray(albedo_image, dtype=np.float32) / 255.0 + (noise[..., None] - .5) * .18
    wet = np.clip((fractal(rng, octaves=((3, .7), (13, .3))) - .46) * 3.3, 0, 1)
    color *= 1 - wet[..., None] * .30
    moss = np.clip((noise - .61) * 4, 0, 1) * (1 - mask)
    color[..., 1] += moss * .055
    height = .12 + mask * .68 + noise * .14
    save_set("cobble", color, height, .0, .23 + wet * .47, .40 + mask * .56)


def make_particle_textures():
    rng = np.random.default_rng(8128)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    x = (xx - SIZE / 2) / (SIZE / 2)
    y = (yy - SIZE / 2) / (SIZE / 2)
    radius = np.sqrt(x * x + y * y)
    smoke_noise = fractal(rng, octaves=((4, .45), (11, .32), (29, .23)))
    alpha = np.clip(1 - radius, 0, 1) ** 1.8 * (.55 + smoke_noise * .65)
    rgb = .48 + smoke_noise * .28
    smoke = np.dstack((np.repeat(rgb[..., None], 3, axis=2), alpha[..., None]))
    Image.fromarray(np.uint8(np.clip(smoke, 0, 1) * 255), "RGBA").resize((128, 128), Image.Resampling.LANCZOS).save(OUT / "smoke.png", optimize=True)
    spark_alpha = np.clip(1 - radius, 0, 1) ** 3.2
    spark = np.ones((SIZE, SIZE, 4), dtype=np.float32)
    spark[..., 1] = .88
    spark[..., 2] = .57
    spark[..., 3] = spark_alpha
    Image.fromarray(np.uint8(np.clip(spark, 0, 1) * 255), "RGBA").resize((64, 64), Image.Resampling.LANCZOS).save(OUT / "spark.png", optimize=True)


if __name__ == "__main__":
    make_stone()
    make_wood()
    make_roof()
    make_metal()
    make_cobble()
    make_particle_textures()
    print(f"Generated {len(list(OUT.glob('*.png')))} original textures in {OUT}")
