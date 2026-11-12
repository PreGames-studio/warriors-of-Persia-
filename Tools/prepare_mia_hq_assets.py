#!/usr/bin/env python3
"""Prepare Mia's CC0 rig and animation subsets for the offline WebView.

No geometry or texture resolution is reduced. Animation GLBs retain only the
clips used by the game; unused mesh/material data are removed from those
animation-only files. The character GLB is copied byte-for-byte.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
import colorsys
import io
from pathlib import Path

from PIL import Image


def read_glb(path: Path):
    raw = path.read_bytes()
    assert raw[:4] == b"glTF" and struct.unpack_from("<I", raw, 4)[0] == 2, path
    total = struct.unpack_from("<I", raw, 8)[0]
    assert total == len(raw), (path, total, len(raw))
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    assert json_type == 0x4E4F534A
    document = json.loads(raw[20:20 + json_length])
    bin_header = 20 + json_length
    bin_length, bin_type = struct.unpack_from("<II", raw, bin_header)
    assert bin_type == 0x004E4942
    binary = raw[bin_header + 8:bin_header + 8 + bin_length]
    return raw, document, binary


def write_glb(path: Path, document: dict, binary: bytes):
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    binary += b"\0" * ((-len(binary)) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as output:
        output.write(struct.pack("<4sII", b"glTF", 2, total))
        output.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        output.write(json_bytes)
        output.write(struct.pack("<II", len(binary), 0x004E4942))
        output.write(binary)


def recolour_model(source: Path, destination: Path):
    """Create Mia's dark/crimson variant without resizing any source texture.

    Only green cloth pixels in the Ranger albedo are remapped. Leather, metal,
    stitches, normal maps, ORM maps, geometry and every texture dimension stay
    unchanged. The edited albedo is encoded as lossless WebP.
    """
    original_raw, document, source_bin = read_glb(source)
    ranger_image = next((i for i, image in enumerate(document["images"])
                         if image.get("name") == "T_Ranger_BaseColor"), None)
    assert ranger_image is not None
    ranger_view_index = document["images"][ranger_image]["bufferView"]
    ranger_view = document["bufferViews"][ranger_view_index]
    start = ranger_view.get("byteOffset", 0)
    payload = source_bin[start:start + ranger_view["byteLength"]]
    with Image.open(io.BytesIO(payload)) as source_image:
        assert source_image.size == (512, 512)
        image = source_image.convert("RGB")
        pixels = []
        changed = 0
        for red, green, blue in image.getdata():
            hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
            degrees = hue * 360
            if 62 <= degrees <= 166 and saturation >= .16 and green > red * 1.04:
                changed += 1
                if value >= .235 and degrees < 125:
                    # Main jerkin and cloth panels: painted crimson, preserving
                    # the source value and brush shading.
                    out_hue, out_saturation = .975, min(.78, .48 + saturation * .30)
                    out_value = max(.055, value * .82)
                else:
                    # Dark sleeves and trousers: blue-charcoal rather than
                    # crushed black, retaining folds and painted highlights.
                    out_hue, out_saturation = .62, .24
                    out_value = max(.045, value * .88)
                out_red, out_green, out_blue = colorsys.hsv_to_rgb(out_hue, out_saturation, out_value)
                pixels.append((round(out_red * 255), round(out_green * 255), round(out_blue * 255)))
            else:
                pixels.append((red, green, blue))
        assert changed > 10000
        image.putdata(pixels)
        encoded = io.BytesIO()
        image.save(encoded, format="WEBP", lossless=True, quality=100, method=6)
        replacement = encoded.getvalue()

    # Repack buffer views in their original order so every accessor, image and
    # extension retains its index. No geometry data is interpreted or altered.
    binary = bytearray()
    for index, source_view in enumerate(document["bufferViews"]):
        while len(binary) % 4:
            binary.append(0)
        view = document["bufferViews"][index]
        start = view.get("byteOffset", 0)
        data = replacement if index == ranger_view_index else source_bin[start:start + view["byteLength"]]
        view["byteOffset"] = len(binary)
        view["byteLength"] = len(data)
        view["buffer"] = 0
        binary.extend(data)
    document["buffers"] = [{"byteLength": len(binary)}]
    document.setdefault("asset", {})["generator"] += "; WOP Mia crimson cloth recolour (lossless, original resolution)"
    write_glb(destination, document, bytes(binary))
    raw = destination.read_bytes()
    return original_raw, {
        "file": destination.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
        "sourceSha256": hashlib.sha256(original_raw).hexdigest(),
        "copiedByteForByte": False,
        "rangerAlbedoRecoloured": True,
        "rangerAlbedoEncoding": "lossless WebP; 512x512; no resize",
        "rangerClothPixelsChanged": changed,
        "otherTextureDimensionsChanged": False,
        "textureResolutionReduced": False,
        "geometryReduced": False,
    }


def animation_subset(source: Path, destination: Path, names: list[str]):
    _, source_doc, source_bin = read_glb(source)
    by_name = {animation.get("name"): animation for animation in source_doc.get("animations", [])}
    missing = [name for name in names if name not in by_name]
    assert not missing, f"{source}: missing clips {missing}"

    # Keep the complete named bone hierarchy, but no renderable mannequin.
    nodes = []
    for source_node in source_doc.get("nodes", []):
        node = {key: value for key, value in source_node.items() if key not in {"mesh", "skin"}}
        nodes.append(node)
    animations = [json.loads(json.dumps(by_name[name])) for name in names]

    used_accessors = sorted({
        accessor
        for animation in animations
        for sampler in animation["samplers"]
        for accessor in (sampler["input"], sampler["output"])
    })
    accessor_remap = {old: new for new, old in enumerate(used_accessors)}
    used_views = sorted({
        source_doc["accessors"][accessor]["bufferView"]
        for accessor in used_accessors
        if "bufferView" in source_doc["accessors"][accessor]
    })
    view_remap = {old: new for new, old in enumerate(used_views)}

    binary = bytearray()
    views = []
    for old in used_views:
        view = dict(source_doc["bufferViews"][old])
        start = view.get("byteOffset", 0)
        payload = source_bin[start:start + view["byteLength"]]
        padding = (-len(binary)) % 4
        binary.extend(b"\0" * padding)
        view["byteOffset"] = len(binary)
        view["buffer"] = 0
        view.pop("extensions", None)
        binary.extend(payload)
        views.append(view)

    accessors = []
    for old in used_accessors:
        accessor = dict(source_doc["accessors"][old])
        assert "sparse" not in accessor, "Sparse animation accessors are not expected"
        if "bufferView" in accessor:
            accessor["bufferView"] = view_remap[accessor["bufferView"]]
        accessors.append(accessor)
    for animation in animations:
        for sampler in animation["samplers"]:
            sampler["input"] = accessor_remap[sampler["input"]]
            sampler["output"] = accessor_remap[sampler["output"]]

    result = {
        "asset": {"version": "2.0", "generator": "WOP Mia CC0 animation subset; geometry unchanged"},
        "scene": source_doc.get("scene", 0),
        "scenes": source_doc.get("scenes", [{"nodes": [len(nodes) - 1]}]),
        "nodes": nodes,
        "animations": animations,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
    }
    # Scene references remain valid because all nodes retain their indices.
    write_glb(destination, result, bytes(binary))
    return {
        "source": str(source),
        "file": destination.name,
        "bytes": destination.stat().st_size,
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "clips": names,
    }


def js_base64(name: str, raw: bytes):
    encoded = base64.b64encode(raw).decode("ascii")
    return f"export const {name} = '{encoded}';\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--locomotion", type=Path, required=True)
    parser.add_argument("--actions", type=Path, required=True)
    parser.add_argument("--combat", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)

    model_raw, model_doc, _ = read_glb(args.model)
    assert len(model_doc.get("skins", [])) >= 10
    assert len(model_doc.get("images", [])) == 16
    model_path = out / "mia_base.glb"
    original_raw, model_record = recolour_model(args.model, model_path)
    assert original_raw == model_raw

    records = [{
        "source": str(args.model), **model_record,
    }]
    records.append(animation_subset(args.locomotion, out / "mia_locomotion.glb", [
        "Idle_Loop", "Jog_Fwd_Loop", "Jump_Loop", "Walk_Loop",
    ]))
    records.append(animation_subset(args.actions, out / "mia_actions.glb", [
        "Death01", "Jump_Land", "Jump_Start", "Sprint_Loop", "Sword_Idle",
    ]))
    records.append(animation_subset(args.combat, out / "mia_combat.glb", [
        "Hit_Knockback", "OverhandThrow", "Sword_Block", "Sword_Dash",
        "Sword_Heavy_A", "Sword_Light_A", "Sword_Light_B", "Sword_Light_C",
        "Sword_Regular_A", "Sword_Regular_B", "Sword_UpperCut",
    ]))

    module = ["// Generated from the CC0 source GLBs beside this module; see SOURCE.md.\n"]
    for record, constant in zip(records, ["MIA_BASE_GLB_BASE64", "MIA_LOCOMOTION_GLB_BASE64", "MIA_ACTIONS_GLB_BASE64", "MIA_COMBAT_GLB_BASE64"]):
        module.append(js_base64(constant, (out / record["file"]).read_bytes()))
    module_path = out / "mia-assets.js"
    module_path.write_text("".join(module), "utf-8")

    manifest = {
        "character": "Mia",
        "license": "CC0 1.0 Universal",
        "modelCopiedByteForByte": False,
        "rangerAlbedoRecolouredLosslessly": True,
        "textureResolutionReduced": False,
        "geometryReduced": False,
        "files": records,
        "generatedModule": {"file": module_path.name, "bytes": module_path.stat().st_size},
    }
    (out / "asset-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
