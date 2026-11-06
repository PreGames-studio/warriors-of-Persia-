#!/usr/bin/env python3
"""Build the Attila sample APK from the verified daylight HQ release.

The current readable WebView source is bundled with esbuild. Attila's CC0 GLB
and original-resolution recoloured atlas are embedded for offline file:// use.
Every audited HQ PBR map is copied byte-for-byte from the input APK; no texture
is resized, re-encoded or replaced. Mia's existing portrait and game code stay.
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from build_hq_apk import align_stored_entry, local_data_offset, sha256

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "unity_preview"
ATTILA = PREVIEW / "assets" / "hero" / "attila"
FAMILIES = ("stone", "wood", "metal", "roof", "cobble")
KINDS = ("albedo", "normal", "orm")


def replace_once(pattern: str, replacement: str, text: str, label: str):
    result, count = re.subn(pattern, replacement, text, count=1)
    assert count == 1, f"Expected one {label}, got {count}"
    return result


def body_skeleton(html: str):
    """Compare the UI markup while ignoring the different script transport."""
    match = re.search(r"<body[^>]*>([\s\S]*)</body>", html)
    assert match
    body = re.sub(r"<script\b[^>]*>[\s\S]*?</script>", "", match.group(1))
    body = re.sub(r'data-build="[^"]+"', 'data-build=""', body)
    # The readable source uses file paths while the offline APK embeds images
    # as data URIs. Compare the UI structure, not the image transport.
    body = re.sub(
        r'<img\b[^>]*>',
        lambda match: re.sub(r'src="[^"]*"', 'src="__EMBEDDED_IMAGE__"', match.group(0)),
        body,
    )
    return re.sub(r"\s+", " ", body).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-apk", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--esbuild-module", help="Absolute path to a temporary esbuild installation")
    args = parser.parse_args()

    source_bytes = args.source_apk.read_bytes()
    source_sha256 = sha256(source_bytes)
    with ZipFile(args.source_apk) as source:
        assert source.testzip() is None
        template_html = source.read("assets/index.html").decode("utf-8")
        packed_manifest = json.loads(source.read("assets/pbr_hq/manifest.json"))
        assert len(packed_manifest["maps"]) == 15
        for record in packed_manifest["maps"]:
            raw = source.read(record["path"])
            assert len(raw) == record["bytes"], record["path"]
            assert sha256(raw) == record["sha256"], record["path"]
        mia_portrait = (source.read("assets/hero/mia_hero.png")
                        if "assets/hero/mia_hero.png" in source.namelist() else None)
        mia_markup_match = re.search(r'<img\b[^>]*id="hud-mia-portrait"[^>]*>', template_html)
        assert mia_markup_match, "Mia portrait markup is missing from the APK template"
        mia_markup = mia_markup_match.group(0)

    source_html = (PREVIEW / "index.html").read_text("utf-8")
    assert body_skeleton(source_html) == body_skeleton(template_html), (
        "The readable UI and APK template differ; refusing to silently discard UI markup"
    )
    forge_source = (PREVIEW / "blacksmith-forge.js").read_text("utf-8")
    assert "color.multiplyScalar(4)" in forge_source
    assert "emissiveIntensity = 1" in forge_source

    public_pbr = {family: {} for family in FAMILIES}
    for record in packed_manifest["maps"]:
        family, kind = record["family"], record["map"]
        assert family in public_pbr and kind in KINDS
        assert record["path"].startswith("assets/pbr_hq/")
        public_pbr[family][kind] = record["path"][len("assets/"):]
    assert all(set(public_pbr[family]) == set(KINDS) for family in FAMILIES)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="wop-attila-bundle-") as temp:
        temp_path = Path(temp)
        pbr_path = temp_path / "public-pbr.json"
        bundle_path = temp_path / "attila-bundle.js"
        pbr_path.write_text(json.dumps(public_pbr, separators=(",", ":")), "utf-8")
        env = os.environ.copy()
        if args.esbuild_module:
            env["WOP_ESBUILD_MODULE"] = str(Path(args.esbuild_module).resolve())
        subprocess.run([
            "node", str(ROOT / "Tools" / "bundle_attila.cjs"),
            "--output", str(bundle_path), "--pbr-manifest", str(pbr_path)
        ], cwd=ROOT, env=env, check=True)
        bundle = bundle_path.read_text("utf-8")

    glb_bytes = (ATTILA / "attila_base.glb").read_bytes()
    atlas_bytes = (ATTILA / "attila_atlas.png").read_bytes()
    assert glb_bytes[:4] == b"glTF"
    assert base64.b64encode(glb_bytes).decode("ascii") in bundle
    atlas_uri = "data:image/png;base64," + base64.b64encode(atlas_bytes).decode("ascii")
    assert atlas_uri in bundle
    # The sole embedded WebP is GLTFLoader's tiny feature-detection probe.
    assert bundle.count("data:image/webp;base64,") == 1
    assert bundle.count("pbr_hq/") == 15
    mia_portrait_sha256 = sha256(mia_portrait) if mia_portrait is not None else None
    mia_markup_sha256 = sha256(mia_markup.encode("utf-8"))

    identity = hashlib.sha256()
    identity.update(source_bytes)
    identity.update(bundle.encode("utf-8"))
    identity.update(glb_bytes)
    identity.update(atlas_bytes)
    build_id = f"hq8k-attila-{identity.hexdigest()[:12]}"

    new_script = f'<script data-build="{build_id}">{bundle}</script>'
    html = replace_once(r'<script data-build="[^"]+">[\s\S]*?</script>',
                        lambda _: new_script, template_html, "bundled script")
    html = replace_once(r'(<meta name="wop-build" content=")[^"]+(")',
                        rf"\g<1>{build_id}\g<2>", html, "build meta")
    html = replace_once(r'(<meta name="wop-texture-quality" content=")[^"]+(")',
                        rf"\g<1>metal-8k;others-4k;lossless-vp8l;daylight-houses-c4-e1;attila-rigged;{build_id}\g<2>",
                        html, "texture quality meta")
    html = replace_once(r'(<meta name="wop-house-lighting" content=")[^"]+(")',
                        rf"\g<1>daylight;houses-c4-e1;textures-unchanged;{build_id}\g<2>",
                        html, "house lighting meta")
    assert 'name="wop-attila"' not in html
    attila_meta = (f'<meta name="wop-attila" content="cc0-kaykit;76-clips;embedded-glb;'
                   f'mia-preserved;{build_id}" />\n  ')
    html = html.replace('<meta name="wop-texture-quality"', attila_meta + '<meta name="wop-texture-quality"', 1)
    html = re.sub(r'data-build="[^"]+"', f'data-build="{build_id}"', html)
    assert html.count(build_id) >= 4
    assert mia_markup in html, "Mia's original portrait markup was not preserved"
    html_bytes = html.encode("utf-8")

    previous_build = packed_manifest["build"]
    new_manifest = copy.deepcopy(packed_manifest)
    new_manifest.update({
        "previousBuild": previous_build,
        "build": build_id,
        "patchedFromApkSha256": source_sha256,
        "bundleSha256": sha256(bundle.encode("utf-8")),
        "miaPortraitSha256": mia_portrait_sha256,
        "miaPortraitMarkupSha256": mia_markup_sha256,
        "miaPortraitTransport": "external-file" if mia_portrait is not None else "embedded-in-html",
        "attila": {
            "characterId": "attila",
            "miaReplaced": False,
            "saveMigration": "preserve existing party and append Attila when absent",
            "source": "KayKit Adventurers Character Pack 1.0 — Knight.glb — Kay Lousberg",
            "license": "CC0",
            "animationClips": 76,
            "baseGlbBytes": len(glb_bytes),
            "baseGlbSha256": sha256(glb_bytes),
            "atlasBytes": len(atlas_bytes),
            "atlasSha256": sha256(atlas_bytes),
            "atlasResolution": "1024x1024; lossless PNG; no resize",
            "transport": "GLB and atlas embedded as base64 for offline Android file:// WebView",
        },
    })
    manifest_bytes = (json.dumps(new_manifest, ensure_ascii=False, indent=2) + "\n").encode()
    license_entries = {
        "assets/hero/attila/LICENSE-KayKit.txt": (ATTILA / "LICENSE-KayKit.txt").read_bytes(),
        "assets/hero/attila/SOURCE.md": (ATTILA / "SOURCE.md").read_bytes(),
        # These already-referenced offline support files were absent from the
        # old wrapper and caused harmless but noisy file:// 404s in smoke.
        "assets/manifest.json": (PREVIEW / "manifest.json").read_bytes(),
        "assets/icon.png": (PREVIEW / "icon.png").read_bytes(),
    }
    # The readable source references shop images by path. The old standalone
    # bundle embedded only some of them, so include every original image rather
    # than allowing the newly bundled shop UI to regress under file://.
    for directory in ("blacksmith", "apothecary"):
        for image in sorted((PREVIEW / "assets" / directory).glob("*.jpg")):
            # index.html is itself under APK assets/, while its URL is
            # ./assets/<shop>/…; therefore the ZIP path needs both segments.
            license_entries[f"assets/assets/{directory}/{image.name}"] = image.read_bytes()

    with ZipFile(args.source_apk) as source, ZipFile(args.output, "w", allowZip64=True) as target:
        for original in source.infolist():
            name = original.filename
            if name.startswith("META-INF/") or name in license_entries:
                continue
            info = copy.copy(original)
            if name == "assets/index.html":
                data = html_bytes
            elif name == "assets/pbr_hq/manifest.json":
                data = manifest_bytes
            else:
                data = source.read(name)
            if name == "assets/hero/mia_hero.png":
                assert data == mia_portrait
            align_stored_entry(target, info)
            target.writestr(info, data, compress_type=original.compress_type, compresslevel=9)
        for name, data in license_entries.items():
            info = ZipInfo(name, date_time=(2026, 11, 6, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            target.writestr(info, data, compresslevel=9)

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
        if mia_portrait is not None:
            assert built.read("assets/hero/mia_hero.png") == mia_portrait
        assert re.search(r'<img\b[^>]*id="hud-mia-portrait"[^>]*>',
                         built.read("assets/index.html").decode("utf-8")).group(0) == mia_markup
        for name, data in license_entries.items():
            assert built.read(name) == data
        for info in built.infolist():
            if info.compress_type == 0:
                alignment = 4096 if info.filename.endswith(".so") else 4
                assert local_data_offset(args.output, info.filename) % alignment == 0, info.filename

    script_match = re.search(r'<script data-build="[^"]+">(.*?)</script>', html, re.S)
    assert script_match
    script_path = args.output.with_suffix(".inline.js")
    script_path.write_text(script_match.group(1), "utf-8")
    subprocess.run(["node", "--check", str(script_path)], check=True)

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
        "miaPortraitPreserved": True,
        "nodeSyntaxCheck": "passed",
        "signed": False,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({
        "previousBuild": previous_build, "build": build_id,
        "apk": str(args.output), "bytes": result["unsignedBytes"],
        "sha256": result["unsignedSha256"], "mapsPreserved": 15,
        "attilaClips": 76, "nodeSyntaxCheck": "passed"
    }, indent=2))


if __name__ == "__main__":
    main()
