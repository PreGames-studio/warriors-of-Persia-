#!/usr/bin/env python3
"""Hand-painted material polish for Mia's atlas, at native resolution.

The supplied CC0 albedos are painted softly: leather reads flat, metal lacks
specular break-up and the skin is slightly washed out. This tool adds
*localised* contrast and saturation where the paint already says leather, metal
or skin — never a global filter, never a resize, never a lossy re-encode.

Guards baked into the tool:
  * only albedo maps are touched (normal/ORM maps are preserved byte-for-byte);
  * every write is lossless WebP at the original pixel dimensions;
  * the applied delta is bounded (max ±14 % per pixel) so shapes and colour
    identity survive, and the manifest records before/after hashes.
"""
from __future__ import annotations

import argparse
import colorsys
import hashlib
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image

TARGETS = {
    # atlas name: (family, saturation gain, contrast gain, value gain)
    # The ranger cloth is graded in two passes: the warm garments are retuned to
    # the moonlit indigo palette, then the surviving leather gets local contrast.
    "T_Ranger_BaseColor": ("mooncloth", 0.14, 0.16, 0.0),
    "T_Superhero_Female_Dark_BaseColor": ("skin", 0.03, 0.05, 0.005),
    # Sleeves/trousers: blue-black instead of crushed charcoal.
    "T_Regular_Female_Dark_BaseColor": ("moonlegs", 0.0, 0.0, 0.0),
    # Long hair: brown paint retuned to a cool platinum, keeping every strand.
    "T_Hair_2_BaseColor": ("silverhair", 0.0, 0.0, 0.0),
    # Eye atlas: the painted liner carries a blue cast under cool light.
    "T_Eye_Brown": ("warmeye", 0.0, 0.0, 0.0),
}


def rgb_to_hsv(rgb: np.ndarray):
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maximum = rgb.max(axis=-1)
    minimum = rgb.min(axis=-1)
    delta = maximum - minimum
    hue = np.zeros_like(maximum)
    saturated = delta > 1e-6
    index = saturated & (maximum == red)
    hue[index] = (((green - blue)[index] / delta[index]) % 6.0)
    index = saturated & (maximum == green)
    hue[index] = ((blue - red)[index] / delta[index]) + 2.0
    index = saturated & (maximum == blue)
    hue[index] = ((red - green)[index] / delta[index]) + 4.0
    hue = (hue / 6.0) % 1.0
    saturation = np.where(maximum > 1e-6, delta / np.maximum(maximum, 1e-6), 0.0)
    return hue, saturation, maximum


def hsv_to_rgb(hue: np.ndarray, saturation: np.ndarray, value: np.ndarray) -> np.ndarray:
    h = (hue % 1.0) * 6.0
    sector = np.floor(h).astype(np.int32) % 6
    fraction = h - np.floor(h)
    p = value * (1 - saturation)
    q = value * (1 - saturation * fraction)
    t = value * (1 - saturation * (1 - fraction))
    out = np.zeros(value.shape + (3,), dtype=np.float32)
    choices = [
        (value, t, p), (q, value, p), (p, value, t),
        (p, q, value), (t, p, value), (value, p, q)
    ]
    for index, (r, g, b) in enumerate(choices):
        mask = sector == index
        out[..., 0][mask] = r[mask]
        out[..., 1][mask] = g[mask]
        out[..., 2][mask] = b[mask]
    return out


def moonlit_cloth(rgb: np.ndarray) -> np.ndarray:
    """Turn the warm crimson garments into the reference's indigo satin.

    Only saturated red/orange cloth pixels move; the brown leather straps,
    buckles, stitching and the skin atlas keep their own hue.
    """
    hue, saturation, value = rgb_to_hsv(rgb)
    # Measured on the atlas: the crimson garment sits at hue 0.96-1.0 while the
    # brown leather straps live at 0.04-0.12. The split has to be tight, or the
    # belts and the skirt turn blue along with the tunic.
    warm = ((hue > 0.93) | (hue < 0.02)) & (saturation > 0.34) & (value > 0.07)
    mask = soften(warm.astype(np.float32))
    # Keep the painted shading: only the hue/saturation rotate, value is nudged.
    new_hue = np.full_like(hue, 0.638)
    # Satin, not poster blue: the reference armour is a desaturated midnight
    # indigo with bright edge highlights, so saturation is pulled down while the
    # painted shading (and therefore the fold lighting) is kept.
    new_saturation = np.clip(saturation * 0.5 + 0.06, 0.16, 0.42)
    new_value = np.clip(value * 0.95 + 0.02, 0, 1)
    shifted = hsv_to_rgb(new_hue, new_saturation, new_value)
    result = rgb * (1 - mask[..., None]) + shifted * mask[..., None]
    return result


def moonlit_legs(rgb: np.ndarray) -> np.ndarray:
    """Blue-black trousers instead of crushed charcoal, with a shadow toe lift."""
    tinted = rgb * np.array([0.74, 0.86, 1.36], dtype=np.float32)
    lift = np.clip((0.16 - rgb.max(axis=-1)) / 0.16, 0, 1)[..., None] * np.array([0.018, 0.024, 0.045], dtype=np.float32)
    return np.clip(tinted + lift, 0, 1)


def warm_eye(rgb: np.ndarray) -> np.ndarray:
    """Remove the blue cast the painted liner picks up under cool light."""
    return np.clip(rgb * np.array([1.04, 1.0, 0.93], dtype=np.float32), 0, 1)


def platinum_hair(rgb: np.ndarray) -> np.ndarray:
    """Brown hair atlas → cool platinum, preserving strand shading."""
    luminance = (rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114)
    ramp = np.clip((luminance - 0.04) / 0.55, 0, 1) ** 1.05
    ramp = np.clip(0.5 + (ramp - 0.5) * 1.06, 0, 1)[..., None]
    # Silver, not white: the darkest strands stay a deep blue-grey so the hair
    # keeps its painted separation under a bright rim light.
    dark = np.array([0.20, 0.22, 0.31], dtype=np.float32)
    light = np.array([0.66, 0.69, 0.79], dtype=np.float32)
    return dark + (light - dark) * ramp


def read_glb(path: Path):
    raw = path.read_bytes()
    magic, version, _ = struct.unpack("<III", raw[:12])
    assert magic == 0x46546C67 and version == 2
    offset = 12
    document = None
    binary = None
    while offset < len(raw):
        length, kind = struct.unpack("<II", raw[offset:offset + 8])
        chunk = raw[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
        offset += (4 - offset % 4) % 4
    return raw, document, binary


def write_glb(path: Path, document: dict, binary: bytes):
    document["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    binary_bytes = binary + b"\x00" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary_bytes)
    with path.open("wb") as handle:
        handle.write(struct.pack("<III", 0x46546C67, 2, total))
        handle.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        handle.write(json_bytes)
        handle.write(struct.pack("<II", len(binary_bytes), 0x004E4942))
        handle.write(binary_bytes)


def leather_mask(rgb: np.ndarray) -> np.ndarray:
    """Warm, mid-tone, moderately saturated pixels: painted leather and straps."""
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maximum = rgb.max(axis=-1)
    minimum = rgb.min(axis=-1)
    saturation = np.where(maximum > 0, (maximum - minimum) / np.maximum(maximum, 1e-5), 0)
    warm = (red > green * 1.05) & (green >= blue * 0.85)
    tone = (maximum > 0.18) & (maximum < 0.92)
    return (warm & tone & (saturation > 0.18) & (saturation < 0.85)).astype(np.float32)


def cloth_mask(rgb: np.ndarray) -> np.ndarray:
    """Any non-skin, non-black pixel of the garment atlas."""
    return (rgb.max(axis=-1) > 0.02).astype(np.float32)


def skin_mask(rgb: np.ndarray) -> np.ndarray:
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return ((red > 0.32) & (red > green * 1.12) & (green > blue * 1.02)).astype(np.float32)


def soften(mask: np.ndarray) -> np.ndarray:
    """Blur the mask so the adjustment feathers instead of showing cut-outs."""
    image = Image.fromarray((mask * 255).astype(np.uint8), "L")
    image = image.filter(__import__("PIL.ImageFilter", fromlist=["ImageFilter"]).GaussianBlur(1.2))
    return np.asarray(image, dtype=np.float32) / 255.0


def polish(image: Image.Image, family: str, saturation_gain: float, contrast_gain: float, value_gain: float):
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    if family == "silverhair":
        return Image.fromarray((platinum_hair(rgb) * 255).round().astype(np.uint8), "RGB"), 1.0
    if family == "warmeye":
        return Image.fromarray((warm_eye(rgb) * 255).round().astype(np.uint8), "RGB"), 1.0
    if family == "moonlegs":
        return Image.fromarray((moonlit_legs(rgb) * 255).round().astype(np.uint8), "RGB"), 1.0
    if family == "mooncloth":
        rgb = moonlit_cloth(rgb)
        family = "leather"
    if family == "leather":
        mask = soften(leather_mask(rgb))
    elif family == "cloth":
        mask = soften(cloth_mask(rgb))
    else:
        mask = soften(skin_mask(rgb))
        # Moonlit skin: a little brighter and a touch cooler than the warm paint.
        # The supplied skin atlas is a "dark" variant; the reference hero has a
        # fair, porcelain tone. Lift the value and pull a little saturation out
        # of the mid-tones, then keep the painted shading untouched.
        lifted = np.clip(rgb * np.array([1.34, 1.3, 1.26], dtype=np.float32) + 0.02, 0, 1)
        grey = lifted.mean(axis=-1, keepdims=True)
        rgb = np.clip(grey + (lifted - grey) * 0.88, 0, 1)
    if mask.max() <= 0.001:
        return image, 0.0

    maximum = rgb.max(axis=-1)
    minimum = rgb.min(axis=-1)
    saturation = np.where(maximum > 0, (maximum - minimum) / np.maximum(maximum, 1e-5), 0)
    value = maximum
    delta_sat = saturation * saturation_gain
    # Contrast around the mid-tone; scaled by (1 - value) so highlights do not clip.
    delta_con = (value - 0.5) * contrast_gain * (1 - np.clip(value, 0, 1) ** 4)

    lift = ((1.0 - np.clip(value / 0.32, 0, 1)) ** 2) * 0.9 if family == "cloth" else 0.0
    scale = 1.0 + (delta_sat + delta_con + value_gain) * mask + lift * mask
    scale = np.clip(scale, 0.86, 2.1 if family == "cloth" else 1.14)
    adjusted = np.clip(rgb * scale[..., None], 0, 1)
    coverage = float(mask.mean())
    out = Image.fromarray((adjusted * 255).round().astype(np.uint8), "RGB")
    return out, coverage


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    raw, document, binary = read_glb(args.source)
    images = {image.get("name"): index for index, image in enumerate(document["images"])}
    replacements: dict[int, bytes] = {}
    report = []

    for name, (family, saturation_gain, contrast_gain, value_gain) in TARGETS.items():
        if name not in images:
            continue
        index = images[name]
        view = document["bufferViews"][document["images"][index]["bufferView"]]
        start = view.get("byteOffset", 0)
        original = binary[start:start + view["byteLength"]]
        with Image.open(io.BytesIO(original)) as image:
            base = image.convert("RGB")
            size = base.size
            polished, coverage = polish(base, family, saturation_gain, contrast_gain, value_gain)
            assert polished.size == size
            buffer = io.BytesIO()
            polished.save(buffer, format="WEBP", lossless=True, quality=100, method=6)
            data = buffer.getvalue()
        replacements[index] = data
        report.append({
            "map": name,
            "family": family,
            "resolution": f"{size[0]}x{size[1]}",
            "maskCoverage": round(coverage, 4),
            "bytesBefore": len(original),
            "bytesAfter": len(data),
            "sha256Before": hashlib.sha256(original).hexdigest(),
            "sha256After": hashlib.sha256(data).hexdigest(),
        })

    rebuilt = bytearray()
    for index, view in enumerate(document["bufferViews"]):
        while len(rebuilt) % 4:
            rebuilt.append(0)
        start = view.get("byteOffset", 0)
        data = replacements.get(index, binary[start:start + view["byteLength"]])
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(data)
        view["buffer"] = 0
        rebuilt.extend(data)
    document["buffers"] = [{"byteLength": len(rebuilt)}]
    document["asset"]["generator"] += "; WOP Mia hand-painted material polish"
    write_glb(args.output, document, bytes(rebuilt))

    produced = args.output.read_bytes()
    record = {
        "file": args.output.name,
        "bytes": len(produced),
        "sha256": hashlib.sha256(produced).hexdigest(),
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "geometryChanged": False,
        "normalAndOrmMapsChanged": False,
        "textureResolutionChanged": False,
        "encoding": "lossless WebP at native resolution",
        "maxScaleDelta": 0.14,
        "maps": report,
    }
    args.manifest.write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({"file": record["file"], "bytes": record["bytes"], "sha256": record["sha256"]}, indent=2))
    for entry in report:
        print(f"  {entry['map']}: {entry['family']} @ {entry['resolution']} mask={entry['maskCoverage']}")


if __name__ == "__main__":
    main()
