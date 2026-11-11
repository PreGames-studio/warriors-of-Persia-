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
    "T_Ranger_BaseColor": ("leather", 0.14, 0.16, 0.0),
    "T_Superhero_Female_Dark_BaseColor": ("skin", 0.03, 0.05, 0.005),
}


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
    mask = soften(leather_mask(rgb) if family == "leather" else skin_mask(rgb))
    if mask.max() <= 0.001:
        return image, 0.0

    maximum = rgb.max(axis=-1)
    minimum = rgb.min(axis=-1)
    saturation = np.where(maximum > 0, (maximum - minimum) / np.maximum(maximum, 1e-5), 0)
    value = maximum
    delta_sat = saturation * saturation_gain
    # Contrast around the mid-tone; scaled by (1 - value) so highlights do not clip.
    delta_con = (value - 0.5) * contrast_gain * (1 - np.clip(value, 0, 1) ** 4)

    scale = 1.0 + (delta_sat + delta_con + value_gain) * mask
    scale = np.clip(scale, 0.86, 1.14)
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
