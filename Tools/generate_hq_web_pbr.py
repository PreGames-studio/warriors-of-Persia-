#!/usr/bin/env python3
"""Author native 4K/8K PBR maps without upsampling the original 2K assets.

The user's explicit quality-upgrade request permits higher-resolution output.
Every family is generated in its own process to bound RAM. WebP is lossless;
there is no JPEG conversion, resize, downsampling, or AI-upscale step.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "artifacts" / "hq-pbr"
RESAMPLE = Image.Resampling.BICUBIC
DEFAULT_SIZES = {"stone": 4096, "wood": 4096, "metal": 8192, "roof": 4096, "cobble": 4096}


def fractal(rng, size, octaves):
    """Stable base pattern plus independent, genuinely new frequency bands."""
    base_bands = list(octaves)
    bands = [(grid, amplitude, rng) for grid, amplitude in base_bands]
    if size > 2048:
        # Extra detail must not advance the base RNG: otherwise rust, knots,
        # cracks and every later feature move when the resolution changes.
        signature = repr(tuple(base_bands)).encode("utf-8")
        detail_seed = int.from_bytes(hashlib.sha256(signature).digest()[:8], "little")
        detail_rng = np.random.default_rng(detail_seed)
        extra_levels = int(math.log2(size / 2048)) * 2
        grid = max(item[0] for item in base_bands)
        for level in range(extra_levels):
            grid = grid * 2 + 1
            if grid >= size:
                break
            bands.append((grid, .052 / (level + 1), detail_rng))
    result = np.zeros((size, size), dtype=np.float32)
    for grid, amplitude, active_rng in bands:
        source = Image.fromarray(np.uint8(active_rng.random((grid, grid)) * 255), "L")
        layer = np.asarray(source.resize((size, size), RESAMPLE), dtype=np.float32) / 255.0
        result += layer * amplitude
        del source, layer
    # 8-bit output does not need float32 storage; float16 keeps 8K authoring
    # within the sandbox RAM while preserving all generated detail bands.
    dtype = np.float16 if size >= 8192 else np.float32
    return np.clip(result, 0, 1).astype(dtype)


def scaled_count(value, scale):
    # Feature count is physical, not per-pixel. Increasing raster resolution
    # must not add more dents/cracks and change the underlying art direction.
    return max(1, int(round(value)))


def bevel_polygon(x, y, w, h, bevel, rng, scale):
    jitter = lambda: float(rng.uniform(-2.4 * scale, 2.4 * scale))
    b = bevel * scale
    return [
        (x + b + jitter(), y + jitter()), (x + w - b + jitter(), y + jitter()),
        (x + w + jitter(), y + b + jitter()), (x + w + jitter(), y + h - b + jitter()),
        (x + w - b + jitter(), y + h + jitter()), (x + b + jitter(), y + h + jitter()),
        (x + jitter(), y + h - b + jitter()), (x + jitter(), y + b + jitter())
    ]


def uint8_rgb(array):
    size = array.shape[0]
    output = np.empty((size, size, 3), dtype=np.uint8)
    for start in range(0, size, 128):
        stop = min(size, start + 128)
        output[start:stop] = np.uint8(np.clip(array[start:stop], 0, 1) * 255)
    return output


def normal_from_height(height, size):
    """Compute normals in strips; a full float32 8K RGB normal is ~768MiB."""
    strength = 5.0 * (size / 512.0)
    dy, dx = np.gradient(height)
    output = np.empty((size, size, 3), dtype=np.uint8)
    for start in range(0, size, 128):
        stop = min(size, start + 128)
        nx = -dx[start:stop] * strength
        ny = -dy[start:stop] * strength
        nz = np.ones_like(nx)
        length = np.maximum(np.sqrt(nx * nx + ny * ny + nz * nz), 1e-6)
        output[start:stop, :, 0] = np.uint8(np.clip(nx / length * .5 + .5, 0, 1) * 255)
        output[start:stop, :, 1] = np.uint8(np.clip(ny / length * .5 + .5, 0, 1) * 255)
        output[start:stop, :, 2] = np.uint8(np.clip(nz / length * .5 + .5, 0, 1) * 255)
    return output


def save_webp(path, pixels):
    image = Image.fromarray(pixels, "RGB")
    # Lossless pixels are identical at every WebP method; method 2 avoids the
    # large search buffers that method 6 allocates for 8K normal maps.
    method = 2 if image.width >= 8192 else 6
    image.save(path, format="WEBP", lossless=True, quality=100, method=method)
    image.close()


def export_family(out, stem, size, albedo, height, metallic, smoothness, ao):
    records = {}
    if albedo is not None:
        print(f"EXPORT {stem} {size} albedo", flush=True)
        albedo_path = out / f"{stem}_albedo.webp"
        save_webp(albedo_path, uint8_rgb(albedo))
        del albedo
        records["albedo"] = {"size": size, "bytes": albedo_path.stat().st_size, "sha256": hashlib.sha256(albedo_path.read_bytes()).hexdigest()}

    print(f"EXPORT {stem} {size} normal", flush=True)
    normal_path = out / f"{stem}_normal.webp"
    normal = normal_from_height(height, size)
    save_webp(normal_path, normal)
    del normal, height
    records["normal"] = {"size": size, "bytes": normal_path.stat().st_size, "sha256": hashlib.sha256(normal_path.read_bytes()).hexdigest()}

    print(f"EXPORT {stem} {size} ORM", flush=True)
    orm_path = out / f"{stem}_orm.webp"
    orm = np.empty((size, size, 3), dtype=np.uint8)
    for start in range(0, size, 128):
        stop = min(size, start + 128)
        orm[start:stop, :, 0] = np.uint8(np.clip(ao[start:stop], 0, 1) * 255)
        orm[start:stop, :, 1] = np.uint8((1 - np.clip(smoothness[start:stop], 0, 1)) * 255)
        orm[start:stop, :, 2] = np.uint8(np.clip(metallic[start:stop], 0, 1) * 255)
    save_webp(orm_path, orm)
    records["orm"] = {"size": size, "bytes": orm_path.stat().st_size, "sha256": hashlib.sha256(orm_path.read_bytes()).hexdigest()}
    return records


def make_stone(size, out):
    scale = size / 2048
    rng = np.random.default_rng(1138)
    noise = fractal(rng, size, ((4, .34), (9, .27), (19, .19), (39, .12), (83, .08)))
    albedo_image = Image.new("RGB", (size, size), (24, 28, 29))
    mask_image = Image.new("L", (size, size), 22)
    color_draw, mask_draw = ImageDraw.Draw(albedo_image), ImageDraw.Draw(mask_image)
    row_height = size / 5
    for row in range(5):
        width = size / 4
        offset = -width * .5 if row % 2 else 0
        for col in range(-1, 5):
            x, y = col * width + offset + 3 * scale, row * row_height + 3 * scale
            poly = bevel_polygon(x, y, width - 6 * scale, row_height - 6 * scale, 8, rng, scale)
            variation = int(rng.integers(-10, 15))
            color_draw.polygon(poly, fill=(55 + variation, 60 + variation, 62 + variation))
            mask_draw.polygon(poly, fill=int(rng.integers(172, 232)))
    mask = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(1.1 * scale)), dtype=np.float32) / 255.0
    color = np.asarray(albedo_image, dtype=np.float32) / 255.0
    del albedo_image, mask_image, color_draw, mask_draw
    color += (noise[..., None] - .5) * .20
    cracks = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(cracks)
    for _ in range(scaled_count(31, scale)):
        x, y = rng.integers(0, 2048, 2) * scale
        points = [(int(x), int(y))]
        for _ in range(int(rng.integers(2, 6))):
            x += int(rng.integers(-14, 15) * scale)
            y += int(rng.integers(5, 20) * scale)
            points.append((int(x), int(y)))
        draw.line(points, fill=int(rng.integers(80, 180)), width=max(1, int(round(scale))))
    crack = np.asarray(cracks, dtype=np.float32) / 255.0
    del cracks, draw
    moss = np.clip((fractal(rng, size, ((5, .55), (17, .3), (41, .15))) - .56) * 4, 0, 1) * (1 - mask)
    for channel in range(3):
        color[..., channel] -= crack * (.12 - channel * .01) + moss * (.04 if channel == 0 else -.07 if channel == 1 else -.05)
    height = .17 + mask * .66 + (noise - .5) * .18 - crack * .17
    ao = np.clip(.46 + mask * .52 - crack * .22, 0, 1)
    metallic = np.zeros((size, size), dtype=np.float32)
    smoothness = .19 + noise * .09
    del noise, crack, moss, mask
    return export_family(out, "stone", size, color, height, metallic, smoothness, ao)


def make_wood(size, out):
    scale = size / 2048
    rng = np.random.default_rng(2901)
    noise = fractal(rng, size, ((4, .34), (9, .27), (19, .19), (39, .12), (83, .08)))
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    xb, yb = xx / scale, yy / scale
    warped = xb + fractal(rng, size, ((3, .6), (13, .3), (31, .1))) * 24
    grain = np.sin(warped * .22 + np.sin(yb * .023) * 2.4) * .5 + .5
    fine = np.sin(warped * .79 + yb * .003) * .5 + .5
    micro = np.sin(xb * .74 + np.sin(yb * .042) * 1.7) * .5 + .5 if size > 2048 else 0
    knots = np.zeros((size, size), dtype=np.float32)
    for cx, cy, rx, ry in ((105, 132, 23, 61), (348, 331, 28, 78), (221, 456, 18, 48)):
        distance = np.sqrt(((xb - cx) / rx) ** 2 + ((yb - cy) / ry) ** 2)
        knots += np.exp(-distance * 2.2) * np.sin(distance * 17)
    seams = np.minimum(xb % 86, 86 - (xb % 86))
    seam_mask = np.clip(seams / 3.2, 0, 1)
    value = .48 + (grain - .5) * .31 + (fine - .5) * .11 + (noise - .5) * .21 + knots * .09
    if size > 2048:
        value += (micro - .5) * .035
    value *= .55 + seam_mask * .45
    color = np.stack((value * .39, value * .235, value * .135), axis=-1).astype(np.float32)
    scratches = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(scratches)
    for _ in range(scaled_count(115, scale)):
        x, y = int(rng.integers(0, 2048) * scale), int(rng.integers(0, 2048) * scale)
        draw.line((x, y, x + int(rng.integers(-3, 4) * scale), y + int(rng.integers(8, 62) * scale)), fill=int(rng.integers(20, 100)), width=max(1, int(round(scale))))
    scratch = np.asarray(scratches, dtype=np.float32) / 255.0
    for channel in range(3):
        color[..., channel] += scratch * .09
    height = .32 + grain * .23 + fine * .08 + noise * .13 - (1 - seam_mask) * .23 - scratch * .08
    ao = .60 + seam_mask * .34 - scratch * .1
    metallic = np.zeros((size, size), dtype=np.float32)
    smoothness = .20 + grain * .13
    del yy, xx, xb, yb, warped, grain, fine, micro, knots, seams, seam_mask, value, noise, scratch, scratches, draw
    return export_family(out, "wood", size, color, height, metallic, smoothness, ao)


def make_roof(size, out):
    scale = size / 2048
    rng = np.random.default_rng(7331)
    noise = fractal(rng, size, ((4, .34), (9, .27), (19, .19), (39, .12), (83, .08)))
    albedo_image = Image.new("RGB", (size, size), (13, 18, 23))
    mask_image = Image.new("L", (size, size), 18)
    color_draw, mask_draw = ImageDraw.Draw(albedo_image), ImageDraw.Draw(mask_image)
    rows, cols = 6, 4
    h, w = size / rows, size / cols
    for row in range(rows):
        offset = -w * .5 if row % 2 else 0
        for col in range(-1, cols + 1):
            x, y = col * w + offset + 2 * scale, row * h + 2 * scale
            poly = bevel_polygon(x, y, w - 4 * scale, h - 4 * scale, 4, rng, scale)
            variation = int(rng.integers(-9, 12))
            color_draw.polygon(poly, fill=(31 + variation, 39 + variation, 47 + variation))
            mask_draw.polygon(poly, fill=int(rng.integers(160, 235)))
    mask = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(.65 * scale)), dtype=np.float32) / 255.0
    color = np.asarray(albedo_image, dtype=np.float32) / 255.0 + (noise[..., None] - .5) * .15
    cracks = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(cracks)
    for _ in range(scaled_count(42, scale)):
        x, y = [int(v) for v in rng.integers(0, 2048, 2) * scale]
        draw.line((x, y, x + int(rng.integers(-20, 21) * scale), y + int(rng.integers(9, 36) * scale)), fill=150, width=max(1, int(round(scale))))
    crack = np.asarray(cracks, dtype=np.float32) / 255.0
    for channel in range(3):
        color[..., channel] -= crack * .09
    height = .15 + mask * .67 + noise * .12 - crack * .16
    ao = .42 + mask * .54 - crack * .18
    metallic = np.full((size, size), .06, dtype=np.float32)
    smoothness = .25 + noise * .18
    del noise, mask, crack, cracks, draw, albedo_image, mask_image, color_draw, mask_draw
    return export_family(out, "roof", size, color, height, metallic, smoothness, ao)


def make_metal(size, out):
    scale = size / 2048
    field_dtype = np.float16 if size >= 8192 else np.float32
    rng = np.random.default_rng(9917)
    print(f"AUTHOR metal {size} multiscale steel/rust", flush=True)
    hammered = fractal(rng, size, ((7, .28), (23, .31), (57, .25), (121, .16)))
    broad = fractal(rng, size, ((3, .65), (11, .25), (37, .1)))
    micro = fractal(rng, size, ((61, .43), (127, .31), (257, .18), (509, .08)))
    rust = np.clip((broad - .535) * 5.2 + (micro - .5) * .72, 0, 1).astype(field_dtype)
    del broad

    # Analytic float32 parabolic dishes: no 8-bit intermediate, concentric
    # bands, upsampled height layer, or resolution-dependent feature count.
    print(f"AUTHOR metal {size} forged dents", flush=True)
    dent = np.full((size, size), .5, dtype=np.float32)
    for _ in range(scaled_count(1600, scale)):
        cx, cy = rng.uniform(0, size, 2)
        rx = float(rng.uniform(8, 32) * scale)
        ry = rx * float(rng.uniform(.58, 1.42))
        depth = float(rng.uniform(24, 72)) / 255.0
        ox, oy = rng.uniform(-.13, .13, 2) * rx
        cx += float(ox) * .25
        cy += float(oy) * .25
        x0, x1 = max(0, int(np.floor(cx - rx))), min(size, int(np.ceil(cx + rx)) + 1)
        y0, y1 = max(0, int(np.floor(cy - ry))), min(size, int(np.ceil(cy + ry)) + 1)
        if x0 >= x1 or y0 >= y1:
            continue
        yy, xx = np.ogrid[y0:y1, x0:x1]
        radius2 = np.square((xx - cx) / rx) + np.square((yy - cy) / ry)
        profile = np.clip(1 - radius2, 0, None)
        profile *= profile
        region = dent[y0:y1, x0:x1]
        np.minimum(region, .5 - depth * profile, out=region)
    dent = dent.astype(field_dtype, copy=False)

    grain_rng = np.random.default_rng(77881)
    grain_pixels = grain_rng.integers(0, 256, (size, size), dtype=np.uint8)
    grain = grain_pixels.astype(field_dtype) / 255.0
    del grain_pixels
    pits = np.clip((.10 - grain) * 5.0, 0, 1).astype(field_dtype)
    color = np.empty((size, size, 3), dtype=field_dtype)
    for channel in range(3):
        steel = (.105 + channel * .016) + dent * .10 + hammered * .065 + (grain - .5) * .025
        rust_color = ((.16, .045, .018)[channel] + micro * (.18, .07, .025)[channel]
                      + grain * (.05, .02, .01)[channel])
        color[..., channel] = steel * (1 - rust) + rust_color * rust - pits * rust * .045
        del steel, rust_color

    scratches = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(scratches)
    for _ in range(scaled_count(340, scale)):
        x, y = [int(v) for v in rng.integers(0, 2048, 2) * scale]
        length = int(rng.integers(5, 58) * scale)
        draw.line((x, y, x + length, y + int(rng.integers(-3, 4) * scale)),
                  fill=int(rng.integers(45, 180)), width=max(1, int(round(scale))))
    scratch = (np.asarray(scratches, dtype=np.float32) / 255.0).astype(field_dtype)
    del scratches, draw
    print(f"AUTHOR metal {size} material channels", flush=True)
    for channel in range(3):
        color[..., channel] += scratch * .18 * (1 - rust)
    height = (.34 + (dent - .5) * .42 + (hammered - .5) * .14 + (micro - .5) * .045
              - rust * .07 - pits * rust * .025 - scratch * .09).astype(np.float32)
    metallic = (.91 * (1 - rust) + .10 * rust).astype(field_dtype)
    smoothness = ((.36 + dent * .25 + grain * .03) * (1 - rust) + .13 * rust + scratch * .10).astype(field_dtype)
    ao = (.66 + dent * .28 - rust * .10 - pits * rust * .10).astype(field_dtype)
    del hammered, micro, rust, scratch, dent, grain, pits
    print(f"EXPORT metal {size} albedo", flush=True)
    albedo_path = out / "metal_albedo.webp"
    save_webp(albedo_path, uint8_rgb(color))
    albedo_record = {"size": size, "bytes": albedo_path.stat().st_size, "sha256": hashlib.sha256(albedo_path.read_bytes()).hexdigest()}
    del color
    records = export_family(out, "metal", size, None, height, metallic, smoothness, ao)
    records["albedo"] = albedo_record
    return records


def make_cobble(size, out):
    scale = size / 2048
    rng = np.random.default_rng(42017)
    noise = fractal(rng, size, ((4, .34), (9, .27), (19, .19), (39, .12), (83, .08)))
    albedo_image = Image.new("RGB", (size, size), (19, 22, 20))
    mask_image = Image.new("L", (size, size), 16)
    color_draw, mask_draw = ImageDraw.Draw(albedo_image), ImageDraw.Draw(mask_image)
    rows, cols = 6, 5
    h, w = size / rows, size / cols
    for row in range(rows):
        offset = -w * .5 if row % 2 else 0
        for col in range(-1, cols + 1):
            x, y = col * w + offset + 3 * scale, row * h + 3 * scale
            poly = bevel_polygon(x, y, w - 6 * scale, h - 6 * scale, 11, rng, scale)
            variation = int(rng.integers(-12, 14))
            color_draw.polygon(poly, fill=(64 + variation, 62 + variation, 55 + variation))
            mask_draw.polygon(poly, fill=int(rng.integers(166, 235)))
    mask = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(1.3 * scale)), dtype=np.float32) / 255.0
    color = np.asarray(albedo_image, dtype=np.float32) / 255.0 + (noise[..., None] - .5) * .18
    wet = np.clip((fractal(rng, size, ((3, .7), (13, .3))) - .46) * 3.3, 0, 1)
    color *= 1 - wet[..., None] * .30
    moss = np.clip((noise - .61) * 4, 0, 1) * (1 - mask)
    color[..., 1] += moss * .055
    height = .12 + mask * .68 + noise * .14
    ao = .40 + mask * .56
    metallic = np.zeros((size, size), dtype=np.float32)
    smoothness = .23 + wet * .47
    del noise, wet, moss, mask, albedo_image, mask_image, color_draw, mask_draw
    return export_family(out, "cobble", size, color, height, metallic, smoothness, ao)


BUILDERS = {"stone": make_stone, "wood": make_wood, "metal": make_metal, "roof": make_roof, "cobble": make_cobble}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("family", choices=tuple(BUILDERS))
    parser.add_argument("--size", type=int, choices=(2048, 4096, 8192), default=None)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    size = args.size or DEFAULT_SIZES[args.family]
    args.output.mkdir(parents=True, exist_ok=True)
    records = BUILDERS[args.family](size, args.output)
    manifest = {
        "family": args.family,
        "resolution": [size, size],
        "nativeAuthoring": True,
        "upsampled": False,
        "encoding": "lossless WebP",
        "channels": {"albedo": "RGB", "normal": "RGB", "orm": "R=AO, G=roughness, B=metalness"},
        "maps": records,
    }
    (args.output / f"{args.family}.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
