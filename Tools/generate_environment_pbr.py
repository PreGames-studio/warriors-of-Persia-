#!/usr/bin/env python3
"""Author original 2K ground/detail maps for the Built-in mobile environment."""
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Tools"))
import generate_blacksmith_pbr as base

OUT = base.OUT
SIZE = base.SIZE


def ground_set(name, seed, palette, roughness):
    rng = np.random.default_rng(seed)
    broad = base.fractal(rng, octaves=((3, .42), (8, .28), (19, .18), (43, .12)))
    fine = base.fractal(rng, octaves=((17, .38), (41, .32), (97, .2), (181, .1)))
    height = .28 + broad * .34 + fine * .22
    color = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    for channel, (low, high) in enumerate(palette):
        color[..., channel] = low + (high - low) * (broad * .7 + fine * .3)
    # Small, irregular dry/soil flecks prevent a flat procedural green field.
    flecks = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(flecks)
    for _ in range(950):
        x, y = [int(v) for v in rng.integers(0, SIZE, 2)]
        radius = int(rng.integers(1, 6))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=int(rng.integers(30, 120)))
    fleck = np.asarray(flecks.filter(ImageFilter.GaussianBlur(.6)), dtype=np.float32) / 255.0
    color *= 1.0 - fleck[..., None] * .18
    height -= fleck * .07
    ao = np.clip(.73 + broad * .23 - fleck * .12, 0, 1)
    base.save_set(name, color, height, 0.0, roughness + fine * .08, ao)


def detail_maps():
    size = 512
    rng = np.random.default_rng(66301)
    noise = base.fractal(rng, size=size, octaves=((7, .4), (19, .32), (47, .2), (101, .08)))
    albedo = np.repeat((.42 + noise * .16)[..., None], 3, axis=2)
    Image.fromarray(np.uint8(np.clip(albedo, 0, 1) * 255), "RGB").save(OUT / "detail_albedo.png", optimize=True)
    height = noise * .7
    dy, dx = np.gradient(height.astype(np.float32))
    normal = np.stack((-dx * 5, -dy * 5, np.ones_like(height)), axis=-1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-6)
    Image.fromarray(np.uint8(np.clip(normal * .5 + .5, 0, 1) * 255), "RGB").save(OUT / "detail_normal.png", optimize=True)


if __name__ == "__main__":
    ground_set("grass", 5101, ((.055, .18), (.12, .29), (.035, .10)), .72)
    ground_set("grass_dry", 5102, ((.12, .27), (.16, .31), (.055, .13)), .78)
    ground_set("grass_dark", 5103, ((.025, .10), (.07, .19), (.025, .075)), .82)
    ground_set("earth", 5104, ((.12, .29), (.075, .18), (.035, .095)), .83)
    detail_maps()
    print("Generated 2K grass/earth PBR sets and 512px detail maps")
