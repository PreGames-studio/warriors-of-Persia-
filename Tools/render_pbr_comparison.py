#!/usr/bin/env python3
"""Create honest, equal-footprint software-PBR comparisons of native PBR sets.

This is a material inspection aid, not a game/mobile benchmark. Source maps are
never modified. The same 1/8-texture physical crop is shown at 512 px: a 2K
panel enlarges 256 source px, 4K shows 512 source px, and 8K downsamples 1024
source px for the preview only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FAMILIES = ("stone", "wood", "metal", "roof", "cobble")
PANEL = 512
CROP_FRACTION = 0.125
CROP_ORIGINS = {
    "stone": (0.185, 0.185),
    "wood": (0.055, 0.075),
    "metal": (0.275, 0.065),
    "roof": (0.185, 0.185),
    "cobble": (0.185, 0.185),
}


def font(size: int, bold: bool = False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size)
    except OSError:
        return ImageFont.load_default()


def normalize(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-6)


def crop_map(root: Path, family: str, kind: str, size: int, crop_fraction=CROP_FRACTION, origin=None) -> np.ndarray:
    path = root / f"{family}_{kind}.webp"
    with Image.open(path) as source:
        assert source.size == (size, size), (path, source.size)
        ox, oy = origin or CROP_ORIGINS[family]
        side = int(round(size * crop_fraction))
        box = (int(ox * size), int(oy * size), int(ox * size) + side, int(oy * size) + side)
        image = source.convert("RGB").crop(box).resize((PANEL, PANEL), Image.Resampling.LANCZOS)
        return np.asarray(image, dtype=np.float32) / 255.0


def software_pbr(albedo: np.ndarray, normal: np.ndarray, orm: np.ndarray) -> Image.Image:
    """Small tangent-space GGX preview with two lights and ACES-style output."""
    base = np.power(np.clip(albedo, 0, 1), 2.2)
    n = normalize(normal * 2.0 - 1.0)
    ao = np.clip(orm[..., 0:1], 0, 1)
    rough = np.clip(orm[..., 1:2], 0.10, 0.96)
    metal = np.clip(orm[..., 2:3], 0, 1)
    view = np.array([0.0, 0.0, 1.0], dtype=np.float32)
    nv = np.maximum(n[..., 2:3], 1e-3)
    f0 = 0.04 * (1 - metal) + base * metal
    result = base * ao * 0.16 + f0 * (1 - rough) * 0.055

    for direction, intensity, light_color in (
        ((-0.46, -0.58, 0.76), 3.1, (1.0, 0.86, 0.68)),
        ((0.62, 0.28, 0.73), 1.05, (0.56, 0.70, 1.0)),
    ):
        light = np.array(direction, dtype=np.float32)
        light /= np.linalg.norm(light)
        h = normalize(light + view)
        nl = np.maximum(np.sum(n * light, axis=-1, keepdims=True), 0.0)
        nh = np.maximum(np.sum(n * h, axis=-1, keepdims=True), 0.0)
        vh = np.maximum(np.sum(h * view, axis=-1, keepdims=True), 0.0)
        alpha = rough * rough
        alpha2 = alpha * alpha
        d = alpha2 / (np.pi * np.square(nh * nh * (alpha2 - 1) + 1) + 1e-5)
        f = f0 + (1 - f0) * np.power(1 - vh, 5)
        k = np.square(rough + 1) / 8
        gv = nv / (nv * (1 - k) + k)
        gl = nl / (nl * (1 - k) + k + 1e-5)
        spec = d * f * gv * gl / (4 * nv * np.maximum(nl, 1e-4))
        diffuse = (1 - f) * (1 - metal) * base / np.pi
        result += (diffuse + spec) * nl * intensity * np.array(light_color, dtype=np.float32)

    mapped = np.clip((result * 1.35), 0, 8)
    mapped = np.clip((mapped * (2.51 * mapped + 0.03)) /
                     (mapped * (2.43 * mapped + 0.59) + 0.14), 0, 1)
    srgb = np.power(mapped, 1 / 2.2)
    return Image.fromarray(np.uint8(srgb * 255), "RGB")


def render_panel(root: Path, family: str, size: int, crop_fraction=CROP_FRACTION, origin=None) -> Image.Image:
    albedo = crop_map(root, family, "albedo", size, crop_fraction, origin)
    normal = crop_map(root, family, "normal", size, crop_fraction, origin)
    orm = crop_map(root, family, "orm", size, crop_fraction, origin)
    return software_pbr(albedo, normal, orm)


def label(draw, xy, title, subtitle, width):
    x, y = xy
    draw.text((x, y), title, font=font(22, True), fill=(238, 205, 137))
    draw.text((x, y + 29), subtitle, font=font(15), fill=(183, 193, 207))


def add_footer(draw, width, y):
    draw.line((24, y, width - 24, y), fill=(67, 56, 40), width=1)
    draw.text((24, y + 14), "Same physical crop + equal display size | Software PBR inspection only — not a game or mobile benchmark",
              font=font(15), fill=(163, 174, 187))


def metal_comparison(roots, output: Path, crop_fraction=CROP_FRACTION, origin=None):
    entries = []
    for size, title in ((2048, "2K REFERENCE"), (4096, "4K NATIVE"), (8192, "8K NATIVE")):
        source_px = int(round(size * crop_fraction))
        entries.append((size, roots[size], title, f"{source_px} source px -> 512 px panel"))
    width = PANEL * 3 + 24 * 4
    canvas = Image.new("RGB", (width, 754), (10, 14, 20))
    draw = ImageDraw.Draw(canvas)
    heading = "FORGED METAL / EXTREME CLOSE-UP" if crop_fraction < 0.1 else "FORGED METAL / NATIVE RESOLUTION COMPARISON"
    draw.text((24, 20), heading, font=font(28, True), fill=(241, 211, 150))
    draw.text((24, 59), "Identical generator and physical crop; source maps remain lossless and unchanged.", font=font(17), fill=(181, 192, 205))
    for index, (size, root, title, subtitle) in enumerate(entries):
        x = 24 + index * (PANEL + 24)
        label(draw, (x, 103), title, subtitle, PANEL)
        panel = render_panel(root, "metal", size, crop_fraction, origin)
        canvas.paste(panel, (x, 166))
        draw.rectangle((x, 166, x + PANEL - 1, 166 + PANEL - 1), outline=(94, 74, 44), width=2)
    add_footer(draw, width, 696)
    canvas.save(output)


def families_comparison(roots, output: Path):
    families = ("stone", "wood", "roof", "cobble")
    width = PANEL * 2 + 24 * 3
    row_height = 590
    canvas = Image.new("RGB", (width, 110 + row_height * len(families) + 58), (10, 14, 20))
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 20), "ENVIRONMENT MATERIALS / 2K REFERENCE vs 4K NATIVE", font=font(27, True), fill=(241, 211, 150))
    draw.text((24, 59), "Same generator, same physical crop and the same software lighting for both panels.", font=font(17), fill=(181, 192, 205))
    for row, family in enumerate(families):
        y = 110 + row * row_height
        draw.text((24, y + 4), family.upper(), font=font(20, True), fill=(213, 177, 105))
        for col, size in enumerate((2048, 4096)):
            x = 24 + col * (PANEL + 24)
            subtitle = "256 px crop enlarged to 512" if size == 2048 else "512 px crop shown at 512"
            draw.text((x + 142, y + 7), f"{size // 1024}K / {subtitle}", font=font(14), fill=(165, 178, 193))
            panel = render_panel(roots[size], family, size)
            canvas.paste(panel, (x, y + 42))
            draw.rectangle((x, y + 42, x + PANEL - 1, y + 42 + PANEL - 1), outline=(94, 74, 44), width=2)
    add_footer(draw, width, canvas.height - 50)
    canvas.save(output)


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_manifest(roots, output: Path, images):
    data = {
        "method": "native procedural authoring; no upscaled source texture",
        "preview": "software tangent-space GGX; not game/mobile benchmark",
        "physicalCropFraction": CROP_FRACTION,
        "closeup": {"physicalCropFraction": 1 / 32, "origin": [0.275, 0.092]},
        "sourceMapsUnmodified": True,
        "sets": {},
        "comparisonImages": {p.name: {"bytes": p.stat().st_size, "sha256": sha256(p)} for p in images},
    }
    for size, root in roots.items():
        families = FAMILIES if size != 8192 else ("metal",)
        data["sets"][str(size)] = {}
        for family in families:
            source = json.loads((root / f"{family}.json").read_text())
            data["sets"][str(size)][family] = source
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--2k", dest="root2k", type=Path, required=True)
    parser.add_argument("--4k", dest="root4k", type=Path, required=True)
    parser.add_argument("--8k", dest="root8k", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    roots = {2048: args.root2k, 4096: args.root4k, 8192: args.root8k}
    metal = args.output / "metal-2k-4k-8k.png"
    closeup = args.output / "metal-closeup-2k-4k-8k.png"
    families = args.output / "families-2k-vs-4k.png"
    metal_comparison(roots, metal)
    metal_comparison(roots, closeup, crop_fraction=1 / 32, origin=(0.275, 0.092))
    families_comparison(roots, families)
    write_manifest(roots, args.output / "source-and-comparison-manifest.json", (metal, closeup, families))
    print(json.dumps({"metal": str(metal), "closeup": str(closeup), "families": str(families)}, indent=2))


if __name__ == "__main__":
    main()
