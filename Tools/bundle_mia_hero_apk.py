#!/usr/bin/env python3
"""Bundle the web village with Mia's hi-quality hero into a signed-off APK HTML.

The shipped APK keeps the game in one inlined script. This tool rebuilds that
script from the readable `unity_preview` sources (so `mia-hero.js` and its GLB
payload are included), repoints the blacksmith PBR maps at the 15 external
`pbr_hq/*.webp` files already present in the source APK, and replaces only
`assets/index.html`. Every HQ texture entry is copied byte-for-byte and is
re-verified by hash, so no map is resized, re-encoded or regenerated.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile, ZipInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_hq_apk import align_stored_entry, local_data_offset, sha256  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "unity_preview"
FAMILIES = ("stone", "wood", "metal", "roof", "cobble")
KINDS = ("albedo", "normal", "orm")

# Replaces the data-URI texture module so the APK loads its external HQ maps.
URL_TEXTURES = """// Generated for the APK build: the 15 HQ maps live beside index.html.
const family = name => ({ albedo: `pbr_hq/${name}_albedo.webp`,
  normal: `pbr_hq/${name}_normal.webp`, orm: `pbr_hq/${name}_orm.webp` });
export const BLACKSMITH_PBR = {
  stone: family('stone'), wood: family('wood'), metal: family('metal'),
  roof: family('roof'), cobble: family('cobble')
};
export const BLACKSMITH_FX = { smoke: '', spark: '' };
"""


def extract_script(html: str) -> tuple[str, int, int]:
    start = html.index('<script type="module">') + len('<script type="module">')
    end = html.index("</script>", start)
    return html[start:end], start, end


def bundle(source_dir: Path, entry: Path, out: Path) -> None:
    esbuild = shutil.which("esbuild")
    if not esbuild:
        raise SystemExit("esbuild is required; install it with `npm i esbuild`")
    subprocess.run(
        [esbuild, str(entry), "--bundle", "--format=iife", "--minify",
         "--target=es2019", "--legal-comments=none", f"--outfile={out}"],
        cwd=source_dir, check=True,
    )


def shell_files() -> list[Path]:
    """Runtime files the bundled HTML still loads from disk (CSS, fonts, photos)."""
    files = [PREVIEW / "potion-shop.css", PREVIEW / "village-theme.css"]
    files += sorted((PREVIEW / "fonts").glob("*"))
    for folder in ("blacksmith", "apothecary"):
        files += sorted((PREVIEW / "assets" / folder).glob("*"))
    files.append(PREVIEW / "assets" / "hero" / "mia_hero.png")
    return [path for path in files if path.is_file()]


def build_html(source_apk: Path, esbuild_entry: Path) -> tuple[str, dict]:
    html = (PREVIEW / "index.html").read_text(encoding="utf-8")
    script, start, end = extract_script(html)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "site"
        shutil.copytree(PREVIEW, work, ignore=shutil.ignore_patterns(
            "WarriorsOfPersia_3D_Standalone.html", "*.apk"))
        (work / "blacksmith-textures.js").write_text(URL_TEXTURES, encoding="utf-8")
        (work / "main.js").write_text(script, encoding="utf-8")
        bundled = work / "bundle.js"
        bundle(work, work / "main.js", bundled)
        code = bundled.read_text(encoding="utf-8")

    assert "pbr_hq/" in code
    assert "MiaHeroModel" in code, "Mia model missing from the bundle"
    # esbuild shares the template, so each kind contributes one prefix.
    assert code.count("pbr_hq/") == 3, code.count("pbr_hq/")

    bundled_html = html[:start] + "\n" + code + "\n  " + html[end:]

    with ZipFile(source_apk) as source:
        manifest = json.loads(source.read("assets/pbr_hq/manifest.json"))
        assert len(manifest["maps"]) == 15
        digest = hashlib.sha256(b"MiaHiQualityHero6")
        for record in manifest["maps"]:
            digest.update(source.read(record["path"]))
        build_id = f"hq8k-mia-hero-{digest.hexdigest()[:12]}"
        for record in manifest["maps"]:
            raw = source.read(record["path"])
            assert sha256(raw) == record["sha256"]
            assert len(raw) == record["bytes"]

    bundled_html = re.sub(r'(<meta name="wop-build" content=")[^"]+(")',
                          rf"\g<1>{build_id}\g<2>", bundled_html, count=1)
    bundled_html = re.sub(r'data-build="[^"]+"', f'data-build="{build_id}"', bundled_html, count=1)
    bundled_html = bundled_html.replace(
        '<meta name="apple-mobile-web-app-capable"',
        f'<meta name="wop-texture-quality" content="metal-8k;others-4k;lossless-vp8l;'
        f'daylight-houses-c4-e1;mia-hero-articulated;{build_id}" />\n  '
        f'<meta name="apple-mobile-web-app-capable"', 1)
    assert bundled_html.count("pbr_hq/") == 3
    assert "Attila" not in bundled_html and "آتیلا" not in bundled_html
    info = {
        "build": build_id,
        "shellAssets": len(shell_files()),
        "htmlBytes": len(bundled_html.encode("utf-8")),
        "miaHeroModule": True,
        "miaGlbBase64Bytes": (PREVIEW / "assets/hero/mia/mia-assets.js").stat().st_size,
        "externalMaps": 15,
        "textureResolutionReduced": False,
    }
    return bundled_html, info


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-apk", type=Path, required=True,
                        help="APK that already carries the 15 HQ maps (r5)")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    html, info = build_html(args.source_apk, PREVIEW / "index.html")
    html_bytes = html.encode("utf-8")
    source_bytes = args.source_apk.read_bytes()

    with ZipFile(args.source_apk) as source:
        records = {info_.filename: info_ for info_ in source.infolist()}

    args.output.parent.mkdir(parents=True, exist_ok=True)
    extras = {}
    for path in shell_files():
        name = "assets/" + str(path.relative_to(PREVIEW)).replace(os.sep, "/")
        extras[name] = path.read_bytes()
    assert "assets/assets/hero/mia_hero.png" in extras

    with ZipFile(args.source_apk) as source, ZipFile(args.output, "w", allowZip64=True) as target:
        for original in source.infolist():
            name = original.filename
            if name.startswith("META-INF/"):
                continue
            entry = copy.copy(original)
            data = html_bytes if name == "assets/index.html" else source.read(name)
            align_stored_entry(target, entry)
            target.writestr(entry, data, compress_type=original.compress_type, compresslevel=9)
        for name, data in extras.items():
            entry = ZipInfo(name, date_time=(2026, 10, 25, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            target.writestr(entry, data, compresslevel=9)

    with ZipFile(args.output) as built, ZipFile(args.source_apk) as source:
        assert built.testzip() is None
        assert built.read("assets/index.html") == html_bytes
        manifest = json.loads(built.read("assets/pbr_hq/manifest.json"))
        for record in manifest["maps"]:
            raw = built.read(record["path"])
            assert raw == source.read(record["path"]), record["path"]
            assert sha256(raw) == record["sha256"] and len(raw) == record["bytes"]
        for name, data in extras.items():
            assert built.read(name) == data, name
        for entry in built.infolist():
            if entry.compress_type == ZIP_STORED:
                alignment = 4096 if entry.filename.endswith(".so") else 4
                assert local_data_offset(args.output, entry.filename) % alignment == 0

    result = {
        **info,
        "sourceApk": str(args.source_apk),
        "sourceApkSha256": sha256(source_bytes),
        "unsignedApk": str(args.output),
        "unsignedBytes": args.output.stat().st_size,
        "unsignedSha256": sha256(args.output.read_bytes()),
        "hqMapsPreservedByteForByte": True,
        "signed": False,
    }
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
