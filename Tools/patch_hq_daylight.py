#!/usr/bin/env python3
"""Patch an existing HQ r2 APK to daylight houses without re-encoding assets.

This one-time transport path lets CI use the already audited r2 release as its
input. All fifteen native WebP maps are copied byte-for-byte and checked against
the existing manifest. Only the bundled JavaScript and build metadata change.
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
    DAYLIGHT_MANIFEST,
    DAYLIGHT_PBR_RETURN,
    align_stored_entry,
    apply_daylight_house_patch,
    local_data_offset,
    sha256,
)


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
        for record in packed_manifest["maps"]:
            raw = source.read(record["path"])
            assert len(raw) == record["bytes"], record["path"]
            assert sha256(raw) == record["sha256"], record["path"]

    assert len(packed_manifest["maps"]) == 15
    previous_build = packed_manifest["build"]
    html = apply_daylight_house_patch(html)

    identity = hashlib.sha256()
    identity.update(source_bytes)
    identity.update(DAYLIGHT_PBR_RETURN.encode("utf-8"))
    build_id = f"hq8k-daylight-{identity.hexdigest()[:12]}"
    html = replace_once(r'(<meta name="wop-build" content=")[^"]+(")',
                        rf'\g<1>{build_id}\g<2>', html, "build meta")
    html = replace_once(r'(<meta name="wop-texture-quality" content=")[^"]+(")',
                        rf'\g<1>metal-8k;others-4k;lossless-vp8l;daylight-houses-c4-e1;{build_id}\g<2>',
                        html, "texture quality meta")
    assert 'name="wop-house-lighting"' not in html
    lighting_meta = (f'<meta name="wop-house-lighting" content="daylight;houses-c4-e1;'
                     f'textures-unchanged;{build_id}" />\n  ')
    html = html.replace('<meta name="wop-texture-quality"', lighting_meta + '<meta name="wop-texture-quality"', 1)
    html = re.sub(r'data-build="[^"]+"', f'data-build="{build_id}"', html)
    assert html.count(build_id) >= 3
    html_bytes = html.encode("utf-8")

    new_packed_manifest = copy.deepcopy(packed_manifest)
    new_packed_manifest["previousBuild"] = previous_build
    new_packed_manifest["build"] = build_id
    new_packed_manifest["patchedFromApkSha256"] = source_sha256
    new_packed_manifest["houseLighting"] = copy.deepcopy(DAYLIGHT_MANIFEST)
    manifest_bytes = (json.dumps(new_packed_manifest, ensure_ascii=False, indent=2) + "\n").encode()

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
        for record in new_packed_manifest["maps"]:
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
    script_path.write_text(script_match.group(1))

    result = {
        **new_packed_manifest,
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
        "signed": False,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({
        "previousBuild": previous_build,
        "build": build_id,
        "apk": str(args.output),
        "bytes": result["unsignedBytes"],
        "sha256": result["unsignedSha256"],
        "mapsPreserved": 15,
        "inlineScript": str(script_path),
    }, indent=2))


if __name__ == "__main__":
    main()
