#!/usr/bin/env python3
"""Assemble the slim APK: bundled game + an optional downloadable graphics pack.

The 1.0.13 build embedded 201 MB of 4K/8K PBR maps, which pushed the download to
272 MB. This builder goes back to the repository's approved quality floor (a
lossless 2K set, inline, no network needed) and leaves the HQ maps to an in-app
download handled by the Android shell:

  * `AndroidManifest.xml`, `resources.arsc` and `res/` come from the freshly
    aapt2-linked launcher (which adds INTERNET and largeHeap);
  * `classes.dex` is the new WebView shell that serves the assets from a private
    https origin and downloads/unpacks the pack;
  * `assets/index.html` is rebuilt from `unity_preview` with a texture module
    that resolves `pack/*.webp` when the pack is installed and falls back to the
    inline 2K data URIs otherwise;
  * `assets/pack-config.json` describes the pack URLs, sizes and checksums;
  * merchant PNGs are re-encoded with the existing PSNR/SSIM-gated optimizer.

The output is unsigned; sign it with `Tools/sign_release_apk.py`.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile, ZipInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_hq_apk import align_stored_entry, sha256  # noqa: E402
from bundle_mia_hero_apk import extract_script, shell_files  # noqa: E402
from optimize_merchant_images import optimize_assets  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "unity_preview"

PACK_TEXTURES = """// Generated for the slim APK build.
// `hq2k/` holds the approved lossless 2048px maps shipped inside the APK, so the
// game is fully playable offline. Once the player installs the optional 4K/8K
// pack the Android shell serves those maps from app storage under `pack/`.
import { BLACKSMITH_FX } from './blacksmith-fx.js';

const packInstalled = (() => {
  try {
    const status = window.WoPPack && window.WoPPack.status ? window.WoPPack.status() : null;
    return status ? JSON.parse(status).installed === true : false;
  } catch (error) {
    return false;
  }
})();

const family = (root, name) => ({ albedo: `${root}/${name}_albedo.webp`,
  normal: `${root}/${name}_normal.webp`, orm: `${root}/${name}_orm.webp` });

const tables = root => ({
  stone: family(root, 'stone'), wood: family(root, 'wood'), metal: family(root, 'metal'),
  roof: family(root, 'roof'), cobble: family(root, 'cobble')
});

export const BLACKSMITH_PBR = tables(packInstalled ? 'pack' : 'hq2k');
export { BLACKSMITH_FX };
"""


def build_html(texture_dir: Path) -> tuple[str, dict]:
    html = (PREVIEW / "index.html").read_text(encoding="utf-8")
    # A 1254px PNG favicon/PWA icon (4.3 MB) is dead weight inside a fullscreen
    # WebView: the launcher icon comes from res/, and there is no browser chrome.
    for tag in ('  <link rel="manifest" href="./manifest.json" />\n',
                '  <link rel="icon" href="./icon.png" />\n'):
        if tag in html:
            html = html.replace(tag, "", 1)
    script, start, end = extract_script(html)
    # The APK has no service worker file, and a registered one would shadow the
    # WebView request interceptor that serves the downloaded pack.
    if "if ('serviceWorker' in navigator)" in script:
        script = script.replace("if ('serviceWorker' in navigator)",
                                "if (false && 'serviceWorker' in navigator)", 1)
        html = html[:start] + script + html[end:]
        end = start + len(script)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "site"
        shutil.copytree(PREVIEW, work, ignore=shutil.ignore_patterns(
            "WarriorsOfPersia_3D_Standalone.html", "*.apk"))
        (work / "blacksmith-fx.js").write_bytes((texture_dir / "blacksmith-fx.js").read_bytes())
        (work / "blacksmith-textures.js").write_text(PACK_TEXTURES, encoding="utf-8")
        (work / "main.js").write_text(script, encoding="utf-8")
        esbuild = shutil.which("esbuild")
        if not esbuild:
            raise SystemExit("esbuild is required; install it with `npm i esbuild`")
        bundled = work / "bundle.js"
        subprocess.run(
            [esbuild, str(work / "main.js"), "--bundle", "--format=iife", "--minify",
             "--target=es2019", "--legal-comments=none", f"--outfile={bundled}"],
            cwd=work, check=True,
        )
        code = bundled.read_text(encoding="utf-8")

    assert "MiaHeroModel" in code, "Mia model missing from the bundle"
    assert "pbr_hq/" not in code, "stale external HQ texture path"
    assert code.count("_albedo.webp") == 1, code.count("_albedo.webp")
    assert 'hq2k' in code and 'pack' in code, "texture roots missing" 
    assert "graphics-pack" in code or "WoPPack" in code, "pack installer missing"

    bundled_html = html[:start] + "\n" + code + "\n  " + html[end:]
    assert "Attila" not in bundled_html and "آتیلا" not in bundled_html
    meta = (
        '<meta name="wop-texture-quality" content="base-2k-lossless-inline;'
        'pack-4k-8k-optional;mia-hero-articulated;pack-installer" />\n  '
        '<meta name="apple-mobile-web-app-capable"'
    )
    bundled_html = bundled_html.replace('<meta name="apple-mobile-web-app-capable"', meta, 1)
    info = {
        "htmlBytes": len(bundled_html.encode("utf-8")),
        "baseTextures": "2K lossless WebP files under hq2k/",
        "externalPackMaps": 15,
        "miaHeroModule": True,
    }
    return bundled_html, info


def load_pack_config(path: Path) -> tuple[bytes, dict]:
    config = json.loads(path.read_text(encoding="utf-8"))
    assert config["packs"], "pack config needs at least one pack"
    for pack in config["packs"]:
        assert pack["url"].startswith("https://"), pack
        assert len(pack["sha256"]) == 64, pack
        assert int(pack["bytes"]) > 0 and int(pack["maps"]) == 15, pack
    return json.dumps(config, indent=2, ensure_ascii=False).encode("utf-8") + b"\n", config


def optimized_merchants(base_apk: Path, cache: Path) -> dict[str, tuple[bytes, dict]]:
    """Re-encode the packaged merchant PNGs with the quality-gated policy."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        with ZipFile(base_apk) as base:
            names = [n for n in base.namelist()
                     if n.startswith("assets/assets/merchants/") and n.endswith(".png")]
            for name in names:
                target = root / name[len("assets/"):]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(base.read(name))
        results = optimize_assets(root, cache)
    return {("assets/" + key): value for key, value in results.items()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-apk", type=Path, required=True,
                        help="container supplying the shared assets (e.g. 1.0.12)")
    parser.add_argument("--launcher-apk", type=Path, required=True,
                        help="aapt2-linked launcher: manifest, resources.arsc, res/")
    parser.add_argument("--dex", type=Path, required=True, help="compiled classes.dex")
    parser.add_argument("--pack-config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--texture-dir", type=Path, required=True,
                        help="output of Tools/prepare_apk_textures.py")
    parser.add_argument("--merchant-cache", type=Path, default=ROOT / "build/optimized-images")
    parser.add_argument("--no-merchant-optimization", action="store_true")
    args = parser.parse_args()

    html, html_info = build_html(args.texture_dir)
    html_bytes = html.encode("utf-8")
    pack_bytes, pack_config = load_pack_config(args.pack_config)
    dex = args.dex.read_bytes()

    replaced_merchants: dict[str, tuple[bytes, int]] = {}
    if not args.no_merchant_optimization:
        for name, (data, details) in optimized_merchants(args.base_apk, args.merchant_cache).items():
            if details["format"] != "original":
                replaced_merchants[name] = (data, details["sourceBytes"])

    launcher: dict[str, bytes] = {}
    with ZipFile(args.launcher_apk) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            if info.filename == "AndroidManifest.xml" or info.filename == "resources.arsc" \
                    or info.filename.startswith("res/"):
                launcher[info.filename] = archive.read(info.filename)
    for required in ("AndroidManifest.xml", "resources.arsc"):
        assert required in launcher, required

    entries: dict[str, tuple[bytes, int]] = {}
    order: list[str] = []
    with ZipFile(args.base_apk) as base:
        for info in base.infolist():
            name = info.filename
            if info.is_dir() or name.startswith("META-INF/"):
                continue
            if name in ("AndroidManifest.xml", "resources.arsc", "classes.dex") or name.startswith("res/"):
                continue
            if name in ("assets/index.html", "assets/icon.png") or name.startswith("assets/pbr_hq/"):
                continue
            if name in replaced_merchants:
                entries[name] = (replaced_merchants[name][0], ZIP_DEFLATED)
            else:
                entries[name] = (base.read(name), info.compress_type)
            order.append(name)

    for name, data in launcher.items():
        if name not in entries:
            order.append(name)
        entries[name] = (data, ZIP_STORED if name in ("AndroidManifest.xml", "resources.arsc") else ZIP_DEFLATED)

    for name, data, compress in (("classes.dex", dex, ZIP_DEFLATED),
                                 ("assets/index.html", html_bytes, ZIP_DEFLATED),
                                 ("assets/pack-config.json", pack_bytes, ZIP_DEFLATED)):
        if name not in entries:
            order.append(name)
        entries[name] = (data, compress)

    texture_manifest = json.loads((args.texture_dir / "hq2k/manifest.json").read_text(encoding="utf-8"))
    assert texture_manifest["mapCount"] == 15
    for record in texture_manifest["maps"]:
        source = args.texture_dir / record["path"]
        data = source.read_bytes()
        assert sha256(data) == record["sha256"], record["path"]
        name = "assets/" + record["path"]
        if name not in entries:
            order.append(name)
        entries[name] = (data, ZIP_DEFLATED)
    manifest_name = "assets/hq2k/manifest.json"
    if manifest_name not in entries:
        order.append(manifest_name)
    entries[manifest_name] = ((args.texture_dir / "hq2k/manifest.json").read_bytes(), ZIP_DEFLATED)

    refreshed = 0
    for path in shell_files():
        name = "assets/" + str(path.relative_to(PREVIEW)).replace(os.sep, "/")
        data = path.read_bytes()
        if name in entries and entries[name][0] == data:
            continue
        if name in entries:
            refreshed += 1
        else:
            order.append(name)
        entries[name] = (data, ZIP_DEFLATED)

    stored = [n for n in order if n in ("AndroidManifest.xml", "resources.arsc")]
    res = [n for n in order if n.startswith("res/") and n not in stored]
    rest = [n for n in order if n not in stored and n not in res]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.output, "w", allowZip64=True) as target:
        for name in stored + res + rest:
            data, compress = entries[name]
            entry = ZipInfo(name, date_time=(2026, 11, 12, 0, 0, 0))
            entry.compress_type = compress
            entry.external_attr = 0o100644 << 16
            if compress == 0:
                align_stored_entry(target, entry)
                target.writestr(entry, data, compress_type=0)
            else:
                target.writestr(entry, data, compress_type=ZIP_DEFLATED, compresslevel=9)

    with ZipFile(args.output) as built:
        assert built.testzip() is None
        assert built.read("assets/index.html") == html_bytes
        assert built.read("classes.dex") == dex
        assert json.loads(built.read("assets/pack-config.json"))["packs"]
        for record in texture_manifest["maps"]:
            assert sha256(built.read("assets/" + record["path"])) == record["sha256"]
        for name in ("AndroidManifest.xml", "resources.arsc", "res/drawable-nodpi-v4/app_icon.png",
                     "assets/manifest.json", "assets/hq2k/manifest.json"):
            assert name in built.namelist(), name
        names = built.namelist()
        assert len(names) == len(set(names)), "duplicate entries"
        assert not any(n.startswith("assets/pbr_hq/") for n in names), "HQ maps must not ship"

    merchant_report = {
        "policy": "PSNR>=40, blockSSIM>=0.99, dimensions/alpha preserved",
        "replaced": len(replaced_merchants),
        "sourceBytes": sum(v[1] for v in replaced_merchants.values()),
        "packedBytes": sum(len(v[0]) for v in replaced_merchants.values()),
    }
    details = {
        **html_info,
        "baseApk": str(args.base_apk),
        "baseApkSha256": sha256(args.base_apk.read_bytes()),
        "launcherApk": str(args.launcher_apk),
        "dexBytes": len(dex),
        "output": str(args.output),
        "bytes": args.output.stat().st_size,
        "sha256": sha256(args.output.read_bytes()),
        "entries": len(order) + len(stored) * 0,
        "shellFilesRefreshed": refreshed,
        "merchantImages": merchant_report,
        "packs": [{k: p[k] for k in ("tier", "label", "bytes", "sha256", "url", "maps")}
                  for p in pack_config["packs"]],
        "signed": False,
    }
    details["entries"] = len(stored) + len(res) + len(rest)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(details, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: details[k] for k in ("bytes", "sha256", "entries", "htmlBytes",
                                              "merchantImages")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
