#!/usr/bin/env python3
"""Build the downloadable graphics packs and the in-app pack catalogue.

The APK ships a lossless 2K set inline; these zips carry the same five families
at 4K (and an 8K metal variant) so the player can upgrade from inside the game.

    python Tools/build_graphics_pack.py hd --maps /tmp/hd --output out/wop-graphics-hd.zip
    python Tools/build_graphics_pack.py catalogue --hd out/wop-graphics-hd.zip \
        --ultra out/wop-graphics-ultra.zip --base-url https://.../download/v1.0.14 \
        --output out/pack-config.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

FAMILIES = ("stone", "wood", "metal", "roof", "cobble")
KINDS = ("albedo", "normal", "orm")

LABELS = {
    "hd": ("HD 4K", "سنگ، چوب، سقف و سنگ‌فرش ۴۰۹۶ و فلز ۴۰۹۶"),
    "ultra": ("Ultra 8K", "همان بستهٔ ۴K با فلز ۸۱۹۲ برای نمایشگرهای بزرگ"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build(tier: str, maps: Path, output: Path, compression: int) -> dict:
    records = []
    for family in FAMILIES:
        for kind in KINDS:
            source = maps / f"{family}_{kind}.webp"
            if not source.is_file():
                raise SystemExit(f"missing map: {source}")
            records.append({
                "name": f"{family}_{kind}.webp",
                "family": family,
                "kind": kind,
                "bytes": source.stat().st_size,
                "sha256": sha256(source),
            })
    assert len(records) == 15, len(records)
    manifest = {
        "tier": tier,
        "generator": "Tools/generate_hq_web_pbr.py",
        "encoding": "lossless WebP (VP8L)",
        "mapCount": 15,
        "totalBytes": sum(record["bytes"] for record in records),
        "maps": records,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", allowZip64=True) as archive:
        for record in records:
            info = zipfile.ZipInfo(record["name"], date_time=(2026, 11, 12, 0, 0, 0))
            info.compress_type = compression
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (maps / record["name"]).read_bytes(), compress_type=compression)
        info = zipfile.ZipInfo("manifest.json", date_time=(2026, 11, 12, 0, 0, 0))
        info.compress_type = zipfile.ZIP_STORED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, json.dumps(manifest, indent=2) + "\n")

    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert len(names) == 16, names
        for record in records:
            assert hashlib.sha256(archive.read(record["name"])).hexdigest() == record["sha256"]

    return {
        "tier": tier,
        "path": str(output),
        "bytes": output.stat().st_size,
        "sha256": sha256(output),
        "maps": 15,
        "mapBytes": manifest["totalBytes"],
    }


def catalogue(entries: list[dict], base_url: str, output: Path) -> dict:
    packs = []
    for entry in entries:
        label, detail = LABELS[entry["tier"]]
        packs.append({
            "tier": entry["tier"],
            "label": label,
            "detail": detail,
            "bytes": entry["bytes"],
            "sha256": entry["sha256"],
            "url": f"{base_url.rstrip('/')}/{Path(entry['path']).name}",
            "maps": 15,
            "mapBytes": entry["mapBytes"],
        })
    config = {"version": 1, "generated": "Tools/build_graphics_pack.py", "packs": packs}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return config


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)

    one = sub.add_parser("build")
    one.add_argument("tier", choices=("hd", "ultra"))
    one.add_argument("--maps", type=Path, required=True)
    one.add_argument("--output", type=Path, required=True)
    one.add_argument("--deflate", action="store_true", help="compress (WebP is already compressed)")

    cat = sub.add_parser("catalogue")
    cat.add_argument("--hd", type=Path, required=True)
    cat.add_argument("--ultra", type=Path, required=True)
    cat.add_argument("--base-url", required=True)
    cat.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if args.mode == "build":
        result = build(args.tier, args.maps, args.output,
                       zipfile.ZIP_DEFLATED if args.deflate else zipfile.ZIP_STORED)
    else:
        entries = []
        for tier, path in (("hd", args.hd), ("ultra", args.ultra)):
            entries.append({
                "tier": tier,
                "path": str(path),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                "maps": 15,
                "mapBytes": json.loads(zipfile.ZipFile(path).read("manifest.json"))["totalBytes"],
            })
        result = catalogue(entries, args.base_url, args.output)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
