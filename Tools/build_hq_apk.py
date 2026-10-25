#!/usr/bin/env python3
"""Pack the offline Mia APK with audited native 4K/8K WebP PBR assets.

The large APK is intentionally written outside Git. The source 2K textures and
base APK are not modified. WebP files are packed as files instead of base64 so
there is no 33% data-URI inflation. Stored entries are aligned before the
unsigned output is signed with apksigner.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import struct
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile, ZipInfo

FAMILIES = ("stone", "wood", "metal", "roof", "cobble")
KINDS = ("albedo", "normal", "orm")
TEXTURE_START = "// unity_preview/blacksmith-textures.js"
TEXTURE_END = "// unity_preview/blacksmith-forge.js"

# Patch the base bundle's loader to match blacksmith-forge.js. Three.js r160
# shares GPU uploads between Texture instances with the same Source; repeat stays local.
OLD_TEXTURE_LOADER = """function E(N, Z, w = [1, 1], z = !1) {
      let l = g.get(N);
      if (!l) {
        l = { image: null, waiting: [] };
        let R = new Image();
        R.onload = () => {
          l.image = R, l.waiting.forEach((c) => {
            c.image = R, c.needsUpdate = !0;
          }), l.waiting.length = 0;
        }, R.src = N, g.set(N, l);
      }
      let J = new s.Texture(l.image);
      return J.colorSpace = Z ? s.SRGBColorSpace : s.NoColorSpace, J.anisotropy = 4, J.wrapS = J.wrapT = z ? s.ClampToEdgeWrapping : s.RepeatWrapping, J.repeat.set(w[0], w[1]), l.image ? J.needsUpdate = !0 : l.waiting.push(J), J;
    }"""
NEW_TEXTURE_LOADER = """function E(N, Z, w = [1, 1], z = !1) {
      let l = g.get(N);
      if (!l) {
        l = { base: new s.Texture(), waiting: [] };
        let R = new Image();
        R.onload = () => {
          l.base.image = R, l.base.needsUpdate = !0, l.waiting.forEach((c) => {
            c.needsUpdate = !0;
          }), l.waiting.length = 0;
        }, R.src = N, g.set(N, l);
      }
      let J = new s.Texture(); J.source = l.base.source;
      return J.colorSpace = Z ? s.SRGBColorSpace : s.NoColorSpace, J.anisotropy = 4, J.wrapS = J.wrapT = z ? s.ClampToEdgeWrapping : s.RepeatWrapping, J.repeat.set(w[0], w[1]), l.base.image ? J.needsUpdate = !0 : l.waiting.push(J), J;
    }"""


def sha256(data: bytes):
    return hashlib.sha256(data).hexdigest()


def local_data_offset(apk: Path, name: str):
    with ZipFile(apk) as z:
        info = z.getinfo(name)
        with apk.open("rb") as f:
            f.seek(info.header_offset)
            header = f.read(30)
            assert header[:4] == b"PK\x03\x04"
            fields = struct.unpack("<IHHHHHIIIHH", header)
            name_len, extra_len = fields[-2:]
            return info.header_offset + 30 + name_len + extra_len


def align_stored_entry(target: ZipFile, info: ZipInfo):
    """Pad a stored local header so its data starts at an Android-safe offset."""
    if info.compress_type != ZIP_STORED:
        return
    alignment = 4096 if info.filename.endswith(".so") else 4
    base = target.fp.tell() + 30 + len(info.filename.encode("utf-8")) + len(info.extra)
    padding = (-base) % alignment
    total = padding
    if total and total < 4:
        # An extra field needs a four-byte header. Add one whole alignment
        # period when the payload alone would leave too little room for it.
        total += alignment
    if total:
        # D935 is the conventional zipalign padding extra-field ID.
        info.extra += struct.pack("<HH", 0xD935, total - 4) + bytes(total - 4)
    assert (base + total) % alignment == 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-apk", type=Path, required=True)
    parser.add_argument("--4k", dest="root4k", type=Path, required=True)
    parser.add_argument("--8k", dest="root8k", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    base_bytes = args.base_apk.read_bytes()
    with ZipFile(args.base_apk) as source:
        html = source.read("assets/index.html").decode("utf-8")
    start = html.index(TEXTURE_START)
    end = html.index(TEXTURE_END, start + len(TEXTURE_START))
    # The bundled statement also contains ti = { smoke, spark }. Preserve it;
    # replacing the whole section must not delete the forge particle textures.
    effects_start = html.rfind("ti =", start, end)
    assert effects_start > start
    effects_declaration = html[effects_start:end].strip()

    texture_files = {}
    for family in FAMILIES:
        root = args.root8k if family == "metal" else args.root4k
        expected_size = 8192 if family == "metal" else 4096
        texture_files[family] = {}
        for kind in KINDS:
            path = root / f"{family}_{kind}.webp"
            raw = path.read_bytes()
            assert raw[:4] == b"RIFF" and raw[8:12] == b"WEBP" and b"VP8L" in raw[:64], path
            # Read dimensions directly from the lossless VP8L header.
            chunk = raw.index(b"VP8L")
            assert raw[chunk + 8] == 0x2F, path
            bits = int.from_bytes(raw[chunk + 9:chunk + 13], "little")
            width = (bits & 0x3FFF) + 1
            height = ((bits >> 14) & 0x3FFF) + 1
            assert (width, height) == (expected_size, expected_size), (path, width, height)
            # index.html lives at APK assets/index.html; this resolves to
            # file:///android_asset/pbr_hq/... (APK assets/pbr_hq/...).
            relative = f"pbr_hq/{family}_{kind}.webp"
            texture_files[family][kind] = relative
            texture_files[family][kind + "_sha256"] = sha256(raw)

    public_manifest = {
        family: {kind: texture_files[family][kind] for kind in KINDS}
        for family in FAMILIES
    }
    bundle_seed = json.dumps(public_manifest, sort_keys=True).encode() + base_bytes
    # Include source bytes in the build identity, not only their paths.
    digest = hashlib.sha256(bundle_seed)
    digest.update(NEW_TEXTURE_LOADER.encode("utf-8"))
    for family in FAMILIES:
        root = args.root8k if family == "metal" else args.root4k
        for kind in KINDS:
            digest.update((root / f"{family}_{kind}.webp").read_bytes())
    build_id = f"hq8k-{digest.hexdigest()[:12]}"

    replacement = (TEXTURE_START + "\n  var Ai = " +
                   json.dumps(public_manifest, ensure_ascii=False, separators=(",", ":")) +
                   ";\n  var " + effects_declaration + "\n\n  ")
    html = html[:start] + replacement + html[end:]
    assert html.count(OLD_TEXTURE_LOADER) == 1
    html = html.replace(OLD_TEXTURE_LOADER, NEW_TEXTURE_LOADER, 1)
    assert OLD_TEXTURE_LOADER not in html and html.count(NEW_TEXTURE_LOADER) == 1
    html = re.sub(r'(<meta name="wop-build" content=")[^"]+(")',
                  rf'\g<1>{build_id}\g<2>', html, count=1)
    html = re.sub(r'data-build="[^"]+"', f'data-build="{build_id}"', html)
    quality_meta = (f'<meta name="wop-texture-quality" content="metal-8k;others-4k;lossless-vp8l;'
                    f'{build_id}" />')
    html = html.replace('<meta name="apple-mobile-web-app-capable"',
                        quality_meta + '\n  <meta name="apple-mobile-web-app-capable"', 1)
    html_bytes = html.encode("utf-8")
    assert "var ti =" in replacement
    assert html.count("pbr_hq/") == 15
    assert build_id in html
    assert "data:image/webp;base64" not in html[start:start + len(replacement)]

    asset_manifest = {
        "build": build_id,
        "baseApkSha256": sha256(base_bytes),
        "quality": {"metal": "native 8192x8192", "stone/wood/roof/cobble": "native 4096x4096"},
        "encoding": "lossless WebP VP8L; files packed without base64",
        "runtimeOptimization": "shared THREE.Source per PBR URI; per-material repeat preserved; no resolution or mipmap reduction",
        "maps": [],
    }
    for family in FAMILIES:
        root = args.root8k if family == "metal" else args.root4k
        for kind in KINDS:
            path = root / f"{family}_{kind}.webp"
            raw = path.read_bytes()
            asset_manifest["maps"].append({
                "family": family, "map": kind, "resolution": 8192 if family == "metal" else 4096,
                "path": f"assets/pbr_hq/{path.name}", "bytes": len(raw), "sha256": sha256(raw),
            })
    manifest_bytes = (json.dumps(asset_manifest, ensure_ascii=False, indent=2) + "\n").encode()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.base_apk) as source, ZipFile(args.output, "w", allowZip64=True) as target:
        for original in source.infolist():
            name = original.filename
            if name.startswith("META-INF/") or name.startswith("assets/pbr_hq/"):
                continue
            info = copy.copy(original)
            data = html_bytes if name == "assets/index.html" else source.read(name)
            align_stored_entry(target, info)
            target.writestr(info, data, compress_type=original.compress_type, compresslevel=9)
        for record in asset_manifest["maps"]:
            family, kind = record["family"], record["map"]
            root = args.root8k if family == "metal" else args.root4k
            raw = (root / f"{family}_{kind}.webp").read_bytes()
            info = ZipInfo(record["path"], date_time=(2026, 10, 25, 0, 0, 0))
            info.compress_type = ZIP_STORED
            info.external_attr = 0o100644 << 16
            align_stored_entry(target, info)
            target.writestr(info, raw)
        info = ZipInfo("assets/pbr_hq/manifest.json", date_time=(2026, 10, 25, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        target.writestr(info, manifest_bytes, compresslevel=9)

    with ZipFile(args.output) as built:
        assert built.testzip() is None
        for record in asset_manifest["maps"]:
            raw = built.read(record["path"])
            assert len(raw) == record["bytes"] and sha256(raw) == record["sha256"]
        packed_html = built.read("assets/index.html").decode("utf-8")
        assert packed_html == html
        assert built.read("assets/pbr_hq/manifest.json") == manifest_bytes
        for info in built.infolist():
            if info.compress_type == ZIP_STORED:
                alignment = 4096 if info.filename.endswith(".so") else 4
                assert local_data_offset(args.output, info.filename) % alignment == 0, info.filename

    script_match = re.search(r'<script data-build="[^"]+">(.*?)</script>', html, re.S)
    assert script_match
    script_path = args.output.with_suffix(".inline.js")
    script_path.write_text(script_match.group(1))

    result = {
        **asset_manifest,
        "unsignedApk": str(args.output),
        "unsignedBytes": args.output.stat().st_size,
        "unsignedSha256": sha256(args.output.read_bytes()),
        "htmlBytes": len(html_bytes),
        "inlineScriptForNodeCheck": str(script_path),
        "resourcesArscDataOffsetMod4": local_data_offset(args.output, "resources.arsc") % 4,
        "allStoredEntriesAligned": True,
        "signed": False,
    }
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"build": build_id, "apk": str(args.output), "bytes": result["unsignedBytes"],
                      "sha256": result["unsignedSha256"], "maps": len(asset_manifest["maps"])}, indent=2))


if __name__ == "__main__":
    main()
