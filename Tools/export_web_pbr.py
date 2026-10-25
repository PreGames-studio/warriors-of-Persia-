#!/usr/bin/env python3
"""Export the original 2K blacksmith PBR maps for the offline WebView.

Quality contract:
- every primary PBR map must already be 2048x2048;
- no source map is resized, downsampled, or converted to JPEG;
- primary albedo/normal/ORM pixels are preserved exactly with lossless WebP;
- FX PNG bytes are embedded unchanged;
- only the ORM channel packing is derived, at the same 2K resolution.

Requires Pillow, like the other texture generators in Tools/.
"""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Assets" / "Resources" / "BlacksmithExterior" / "Textures"
DESTINATION = ROOT / "unity_preview" / "blacksmith-textures.js"
SIZE = (2048, 2048)
FAMILIES = ("stone", "wood", "metal", "roof", "cobble")


def data_uri(data: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


def lossless_webp(image: Image.Image) -> bytes:
    """Compress without changing a pixel or reducing the authored resolution."""
    output = io.BytesIO()
    image.save(output, format="WEBP", lossless=True, quality=100, method=6)
    return output.getvalue()


def source_bytes(name: str) -> bytes:
    path = SOURCE / name
    with Image.open(path) as image:
        if image.size != SIZE:
            raise ValueError(f"{path} must be {SIZE}, got {image.size}; refusing to resize it")
        return lossless_webp(image.convert("RGB"))


def make_orm(stem: str) -> bytes:
    ao_path = SOURCE / f"{stem}_ao.png"
    ms_path = SOURCE / f"{stem}_metallic_smoothness.png"
    with Image.open(ao_path) as ao_source, Image.open(ms_path) as ms_source:
        if ao_source.size != SIZE or ms_source.size != SIZE:
            raise ValueError(f"{stem} ORM inputs must both be {SIZE}; refusing to resize them")
        ao = ao_source.convert("L")
        ms = ms_source.convert("RGBA")
        red, _, _, smoothness = ms.split()
        # Three.js roughness is the inverse of Unity smoothness.
        roughness = smoothness.point(lambda value: 255 - value)
        orm = Image.merge("RGB", (ao, roughness, red))
        return lossless_webp(orm)


def main() -> None:
    pbr = {}
    for stem in FAMILIES:
        pbr[stem] = {
            "albedo": data_uri(source_bytes(f"{stem}_albedo.png"), "image/webp"),
            "normal": data_uri(source_bytes(f"{stem}_normal.png"), "image/webp"),
            "orm": data_uri(make_orm(stem), "image/webp"),
        }

    # These are intentionally small particle sprites, not primary PBR maps.
    # Keep their source dimensions and bytes unchanged as well.
    fx = {
        "smoke": data_uri((SOURCE / "smoke.png").read_bytes()),
        "spark": data_uri((SOURCE / "spark.png").read_bytes()),
    }

    header = (
        "// Generated from the original local Unity blacksmith PBR maps.\n"
        "// Quality lock: primary albedo/normal/ORM maps are lossless 2048x2048 WebP; no resize or JPEG.\n"
        "// Three.js ORM channels: R = AO, G = roughness, B = metalness.\n"
        "// Data URIs keep the Android WebView build completely offline.\n"
    )
    DESTINATION.write_text(
        header
        + "export const BLACKSMITH_PBR = "
        + json.dumps(pbr, separators=(",", ":"))
        + ";\n\nexport const BLACKSMITH_FX = "
        + json.dumps(fx, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Exported {len(FAMILIES)} lossless 2K WebP PBR sets to {DESTINATION}")
    print(f"WebView texture module: {DESTINATION.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
