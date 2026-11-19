#!/usr/bin/env python3
"""Stage the authored 4K/8K PBR maps into an APK so the HQ bundle can be built.

`Tools/bundle_mia_hero_apk.py` expects a source APK that already carries the 15
external maps plus `assets/pbr_hq/manifest.json` (it verifies every hash and byte
count before reusing them). The published HQ APK is a release asset and is not
kept in Git, so this script recreates that carrier from:

* any installable APK that has a valid `AndroidManifest.xml`, `classes.dex`, icon
  resources and resource table (the launcher part), and
* the maps produced by `Tools/generate_hq_web_pbr.py` for each family.

Nothing from the base APK is modified: entries are copied byte-for-byte and the
maps are added as their own entries.

    python3 Tools/generate_hq_web_pbr.py metal --size 8192 --output /tmp/hq-pbr
    python3 Tools/generate_hq_web_pbr.py stone --size 4096 --output /tmp/hq-pbr
    ...
    python3 Tools/stage_hq_maps_apk.py --base-apk artifacts/releases/<apk> \\
        --maps /tmp/hq-pbr --output /tmp/staged.apk --manifest /tmp/staged.json
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_hq_apk import align_stored_entry  # noqa: E402

FAMILIES = ("stone", "wood", "metal", "roof", "cobble")
KINDS = ("albedo", "normal", "orm")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-apk", type=Path, required=True)
    parser.add_argument("--maps", type=Path, required=True,
                        help="folder written by generate_hq_web_pbr.py (all five families)")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    maps: list[dict] = []
    payloads: dict[str, bytes] = {}
    families: dict[str, dict] = {}
    for family in FAMILIES:
        family_manifest = json.loads((args.maps / f"{family}.json").read_text())
        families[family] = {"resolution": family_manifest["resolution"],
                            "encoding": family_manifest["encoding"]}
        for kind in KINDS:
            path = args.maps / f"{family}_{kind}.webp"
            data = path.read_bytes()
            record = family_manifest["maps"][kind]
            assert record["bytes"] == len(data), (path, record["bytes"], len(data))
            assert record["sha256"] == sha256(data), path
            entry_name = f"assets/pbr_hq/{family}_{kind}.webp"
            payloads[entry_name] = data
            maps.append({"path": entry_name, "family": family, "kind": kind,
                         "bytes": len(data), "sha256": record["sha256"],
                         "resolution": family_manifest["resolution"]})
    assert len(maps) == 15, len(maps)

    manifest = {
        "generator": "Tools/generate_hq_web_pbr.py",
        "stagedBy": "Tools/stage_hq_maps_apk.py",
        "families": families,
        "encoding": "lossless WebP (VP8L)",
        "upsampled": False,
        "textureResolutionReduced": False,
        "mapCount": len(maps),
        "totalBytes": sum(item["bytes"] for item in maps),
        "maps": maps,
    }
    manifest_bytes = (json.dumps(manifest, indent=2) + "\n").encode("utf-8")
    payloads["assets/pbr_hq/manifest.json"] = manifest_bytes

    with ZipFile(args.base_apk) as source:
        originals = source.infolist()
        raw = {info.filename: source.read(info.filename) for info in originals}

    for name in [n for n in raw if n.startswith("META-INF/")]:
        raw.pop(name)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.output, "w", allowZip64=True) as target:
        for info in originals:
            name = info.filename
            if name.startswith("META-INF/") or name in payloads:
                continue
            entry = copy.copy(info)
            align_stored_entry(target, entry)
            target.writestr(entry, raw[name], compress_type=info.compress_type, compresslevel=9)
        for name, data in payloads.items():
            entry = ZipInfo(name, date_time=(2026, 10, 27, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            target.writestr(entry, data, compresslevel=9)

    with ZipFile(args.output) as built:
        assert built.testzip() is None
        for name, data in payloads.items():
            assert built.read(name) == data, name
    args.manifest.write_text(json.dumps({
        "baseApk": str(args.base_apk),
        "baseApkSha256": sha256(args.base_apk.read_bytes()),
        "stagedApk": str(args.output),
        "stagedBytes": args.output.stat().st_size,
        "stagedSha256": sha256(args.output.read_bytes()),
        **{k: manifest[k] for k in ("mapCount", "totalBytes", "families", "encoding")},
    }, indent=2) + "\n")
    print(json.dumps({"staged": str(args.output), "bytes": args.output.stat().st_size,
                      "maps": manifest["mapCount"], "mapBytes": manifest["totalBytes"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
