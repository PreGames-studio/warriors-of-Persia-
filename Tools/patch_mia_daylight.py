#!/usr/bin/env python3
"""Remove Attila by building from r3 and fix dark houses with constant fill.

The input is the verified Mia-only daylight r3 APK. All fifteen HQ WebP maps
are copied byte-for-byte. The only runtime change is architecture material
response: emissive fill no longer depends on the dark albedo image.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile

from build_hq_apk import (
    DAYLIGHT_PBR_RETURN,
    align_stored_entry,
    local_data_offset,
    sha256,
)

# Keep this exact minified replacement in lockstep with blacksmith-forge.js.
CONSTANT_DAYLIGHT_PBR_RETURN = """return (N === \"stone\" || N === \"wood\" || N === \"roof\") && (
        J.color.multiplyScalar(4),
        J.emissive.setHex(N === \"wood\" ? 11040079 : N === \"roof\" ? 9546183 : 12372179),
        J.emissiveMap = null,
        J.emissiveIntensity = N === \"wood\" ? 0.78 : 0.85
      ), J.normalScale.set(0.78, 0.78), J;"""

CONSTANT_DAYLIGHT_MANIFEST = {
    "village": "daylight; constant architecture fill; no night color grade",
    "families": ["stone", "wood", "roof"],
    "materialColorMultiplier": 4,
    "emissiveMap": None,
    "albedoIndependentEmissiveFill": True,
    "emissiveColors": {"stone": "#bcc8d3", "wood": "#a8754f", "roof": "#91a9c7"},
    "emissiveIntensity": {"stone": 0.85, "wood": 0.78, "roof": 0.85},
    "excludedFamilies": ["metal", "cobble"],
    "textureBytesModified": False,
    "textureResolutionModified": False,
    "shadowsDisabled": False,
}


def replace_once(pattern: str, replacement: str, text: str, label: str):
    result, count = re.subn(pattern, replacement, text, count=1)
    assert count == 1, f"Expected one {label}, got {count}"
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-apk", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    source_bytes = args.source_apk.read_bytes()
    source_sha256 = sha256(source_bytes)
    with ZipFile(args.source_apk) as source:
        assert source.testzip() is None
        html = source.read("assets/index.html").decode("utf-8")
        packed_manifest = json.loads(source.read("assets/pbr_hq/manifest.json"))
        assert len(packed_manifest["maps"]) == 15
        for record in packed_manifest["maps"]:
            raw = source.read(record["path"])
            assert len(raw) == record["bytes"], record["path"]
            assert sha256(raw) == record["sha256"], record["path"]

    # r3 is deliberately the input: this guarantees Attila is not carried into r5.
    for marker in ("Attila_Rigged_3D_Model", "ATTILA_GLB_BASE64", "آتیلا"):
        assert marker not in html, f"Unexpected Attila marker in Mia-only input: {marker}"
    assert html.count(DAYLIGHT_PBR_RETURN) == 1, "Unexpected r3 architecture bundle"
    html = html.replace(DAYLIGHT_PBR_RETURN, CONSTANT_DAYLIGHT_PBR_RETURN, 1)
    assert html.count(CONSTANT_DAYLIGHT_PBR_RETURN) == 1
    assert "J.emissiveMap = null" in html

    identity = hashlib.sha256()
    identity.update(source_bytes)
    identity.update(CONSTANT_DAYLIGHT_PBR_RETURN.encode("utf-8"))
    build_id = f"hq8k-mia-daylight-{identity.hexdigest()[:12]}"
    html = replace_once(r'(<meta name="wop-build" content=")[^"]+(")',
                        rf"\g<1>{build_id}\g<2>", html, "build meta")
    html = replace_once(r'(<meta name="wop-texture-quality" content=")[^"]+(")',
                        rf"\g<1>metal-8k;others-4k;lossless-vp8l;constant-daylight;mia-only;{build_id}\g<2>",
                        html, "texture quality meta")
    html = replace_once(r'(<meta name="wop-house-lighting" content=")[^"]+(")',
                        rf"\g<1>daylight;constant-emissive-fill;albedo-independent;textures-unchanged;{build_id}\g<2>",
                        html, "house lighting meta")
    html = re.sub(r'data-build="[^"]+"', f'data-build="{build_id}"', html)
    assert html.count(build_id) >= 3
    html_bytes = html.encode("utf-8")

    previous_build = packed_manifest["build"]
    new_manifest = copy.deepcopy(packed_manifest)
    new_manifest["previousBuild"] = previous_build
    new_manifest["build"] = build_id
    new_manifest["patchedFromApkSha256"] = source_sha256
    new_manifest["houseLighting"] = copy.deepcopy(CONSTANT_DAYLIGHT_MANIFEST)
    new_manifest["character"] = {"miaOnly": True, "attilaPresent": False}
    manifest_bytes = (json.dumps(new_manifest, ensure_ascii=False, indent=2) + "\n").encode()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.source_apk) as source, ZipFile(args.output, "w", allowZip64=True) as target:
        for original in source.infolist():
            name = original.filename
            if name.startswith("META-INF/"):
                continue
            info = copy.copy(original)
            if name == "assets/index.html":
                data = html_bytes
            elif name == "assets/pbr_hq/manifest.json":
                data = manifest_bytes
            else:
                data = source.read(name)
            align_stored_entry(target, info)
            target.writestr(info, data, compress_type=original.compress_type, compresslevel=9)

    with ZipFile(args.output) as built:
        assert built.testzip() is None
        webp_names = [n for n in built.namelist()
                      if n.startswith("assets/pbr_hq/") and n.endswith(".webp")]
        assert len(webp_names) == 15
        for record in new_manifest["maps"]:
            raw = built.read(record["path"])
            assert len(raw) == record["bytes"], record["path"]
            assert sha256(raw) == record["sha256"], record["path"]
        assert built.read("assets/index.html") == html_bytes
        assert built.read("assets/pbr_hq/manifest.json") == manifest_bytes
        for info in built.infolist():
            if info.compress_type == 0:
                alignment = 4096 if info.filename.endswith(".so") else 4
                assert local_data_offset(args.output, info.filename) % alignment == 0, info.filename

    script_match = re.search(r'<script data-build="[^"]+">(.*?)</script>', html, re.S)
    assert script_match
    script_path = args.output.with_suffix(".inline.js")
    script_path.write_text(script_match.group(1), "utf-8")

    result = {
        **new_manifest,
        "sourceApk": str(args.source_apk),
        "sourceSha256": source_sha256,
        "unsignedApk": str(args.output),
        "unsignedBytes": args.output.stat().st_size,
        "unsignedSha256": sha256(args.output.read_bytes()),
        "htmlBytes": len(html_bytes),
        "inlineScriptForNodeCheck": str(script_path),
        "resourcesArscDataOffsetMod4": local_data_offset(args.output, "resources.arsc") % 4,
        "allStoredEntriesAligned": True,
        "all15TextureHashesPreserved": True,
        "attilaRemoved": True,
        "signed": False,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({
        "previousBuild": previous_build, "build": build_id,
        "apk": str(args.output), "bytes": result["unsignedBytes"],
        "sha256": result["unsignedSha256"], "mapsPreserved": 15,
        "miaOnly": True, "constantDaylightFill": True
    }, indent=2))


if __name__ == "__main__":
    main()
