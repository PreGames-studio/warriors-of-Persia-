#!/usr/bin/env python3
"""Assemble the HQ APK from the current sources, keeping the base container intact.

The shipped HQ build is a release asset, not a repository file, so a content
refresh has to start from an installable APK that is in the tree and add the
authored 4K/8K maps back in. This script:

* reuses `AndroidManifest.xml`, `classes.dex`, the launcher icon and the resource
  table of the base APK byte-for-byte;
* reuses every base asset that is still referenced (`assets/assets/**`, fonts,
  CSS, icon, manifest) unless the source tree has a fresher copy;
* rebuilds `assets/index.html` from `unity_preview` through esbuild, with the
  blacksmith texture module pointing at the external `pbr_hq/*.webp` files;
* copies the 15 maps and their manifest from the staged APK without re-encoding.

The output is unsigned; sign it with `Tools/sign_release_apk.py`.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_hq_apk import align_stored_entry  # noqa: E402
from bundle_mia_hero_apk import build_html, shell_files  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "unity_preview"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-apk", type=Path, required=True,
                        help="installable APK supplying manifest/dex/icon/resources and assets")
    parser.add_argument("--staged-apk", type=Path, required=True,
                        help="base APK plus assets/pbr_hq/*.webp and its manifest")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    html, info = build_html(args.staged_apk, PREVIEW / "index.html")
    html_bytes = html.encode("utf-8")

    with ZipFile(args.base_apk) as base:
        entries: dict[str, tuple[bytes, int]] = {}
        order: list[str] = []
        for item in base.infolist():
            if item.filename.startswith("META-INF/"):
                continue
            entries[item.filename] = (base.read(item.filename), item.compress_type)
            order.append(item.filename)

    # Fresh shell files (CSS/fonts/shop art) replace the packaged copies.
    replaced = 0
    for path in shell_files():
        name = "assets/" + str(path.relative_to(PREVIEW)).replace(os.sep, "/")
        data = path.read_bytes()
        if name in entries and entries[name][0] == data:
            continue
        if name in entries:
            replaced += 1
        else:
            order.append(name)
        entries[name] = (data, ZIP_DEFLATED)

    with ZipFile(args.staged_apk) as staged:
        map_manifest = json.loads(staged.read("assets/pbr_hq/manifest.json"))
        assert map_manifest["mapCount"] == 15
        for record in map_manifest["maps"]:
            name = record["path"]
            data = staged.read(name)
            assert sha256(data) == record["sha256"] and len(data) == record["bytes"], name
            if name not in entries:
                order.append(name)
            entries[name] = (data, ZIP_DEFLATED)
        manifest_bytes = staged.read("assets/pbr_hq/manifest.json")
        if "assets/pbr_hq/manifest.json" not in entries:
            order.append("assets/pbr_hq/manifest.json")
        entries["assets/pbr_hq/manifest.json"] = (manifest_bytes, ZIP_DEFLATED)

    if "assets/index.html" not in entries:
        order.append("assets/index.html")
    entries["assets/index.html"] = (html_bytes, ZIP_DEFLATED)

    # Manifest and resource table first, uncompressed and 4-byte aligned.
    stored = [name for name in order if name in ("AndroidManifest.xml", "resources.arsc")]
    res = [name for name in order if name.startswith("res/") and name not in stored]
    rest = [name for name in order if name not in stored and name not in res]
    ordered = stored + res + rest

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.output, "w", allowZip64=True) as target:
        for name in ordered:
            data, compress = entries[name]
            entry = ZipInfo(name, date_time=(2026, 10, 27, 0, 0, 0))
            entry.compress_type = compress
            entry.external_attr = 0o100644 << 16
            if compress == 0 or name == "resources.arsc":
                align_stored_entry(target, entry)
                target.writestr(entry, data, compress_type=compress)
            else:
                target.writestr(entry, data, compress_type=ZIP_DEFLATED, compresslevel=9)

    with ZipFile(args.output) as built:
        assert built.testzip() is None
        assert built.read("assets/index.html") == html_bytes
        for record in map_manifest["maps"]:
            assert sha256(built.read(record["path"])) == record["sha256"], record["path"]
        for name in ("AndroidManifest.xml", "resources.arsc", "classes.dex",
                     "res/drawable-nodpi-v4/app_icon.png", "assets/icon.png", "assets/manifest.json"):
            assert name in built.namelist(), name
        names = built.namelist()
        duplicates = {n for n in names if names.count(n) > 1}
        assert not duplicates, duplicates

    details = {
        **info,
        "baseApk": str(args.base_apk),
        "baseApkSha256": sha256(args.base_apk.read_bytes()),
        "stagedApk": str(args.staged_apk),
        "output": str(args.output),
        "bytes": args.output.stat().st_size,
        "sha256": sha256(args.output.read_bytes()),
        "entries": len(ordered),
        "shellFilesRefreshed": replaced,
        "pbrMaps": 15,
        "pbrMapBytes": map_manifest["totalBytes"],
        "signed": False,
    }
    args.manifest.write_text(json.dumps(details, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: details[k] for k in ("bytes", "sha256", "entries", "shellFilesRefreshed",
                                              "pbrMapBytes", "htmlBytes", "build")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
