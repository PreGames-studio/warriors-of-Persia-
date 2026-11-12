#!/usr/bin/env python3
"""Sign an already-assembled APK without touching its resources.

`Tools/build_installable_apk.py` rebuilds the container and, in doing so, drops
`resources.arsc` and `res/` (the old source APK carried a corrupt table). That is
right for that repair job but wrong for a content refresh: the launcher icon and
the resource table must survive untouched.

This tool takes an APK produced by e.g. `Tools/bundle_mia_hero_apk.py`, keeps
every entry byte-for-byte (optionally patching versionCode/versionName in the
binary manifest), and re-signs it with the committed release key using the same
JAR (v1) + APK Signature Scheme v2 implementation the other releases use.

    python3 Tools/sign_release_apk.py --input unsigned.apk --output signed.apk \
        --keystore Tools/keys/wop-release.p12 --storepass wop-release-2026 \
        --version-code 13 --version-name 1.0.13 --report artifacts/quality/build.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from apk_manifest import patch_manifest, read_manifest_attributes  # noqa: E402
from apk_signing import Entry, sign_apk  # noqa: E402
from build_installable_apk import load_key  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--keystore", type=Path, required=True)
    parser.add_argument("--storepass", required=True)
    parser.add_argument("--version-code", type=int)
    parser.add_argument("--version-name")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    with zipfile.ZipFile(args.input) as archive:
        raw = {info.filename: archive.read(info.filename) for info in archive.infolist()}
    # Old signatures are replaced by the ones written below.
    for name in [n for n in raw if n.startswith("META-INF/") and n.split("/")[-1].upper().split(".")[-1]
                 in ("MF", "SF", "RSA", "DSA", "EC")]:
        raw.pop(name)

    if args.version_code is not None or args.version_name:
        raw["AndroidManifest.xml"] = patch_manifest(
            raw["AndroidManifest.xml"],
            version_code=args.version_code,
            version_name=args.version_name,
        )

    # Stored entries must come first and stay stored; everything else compresses.
    stored = ("AndroidManifest.xml", "resources.arsc")
    entries = []
    for name in sorted(raw, key=lambda n: (n not in stored, not n.startswith("res/"), n)):
        compress = not (name in stored or name.startswith("res/"))
        entries.append(Entry(name, raw[name], compress=compress))

    key, cert_der, extra = load_key(args.keystore, args.storepass)
    apk, report = sign_apk(entries, key, cert_der, extra_certificates=extra)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(apk)

    digest = hashlib.sha256(apk).hexdigest()
    details = {
        "output": str(args.output),
        "bytes": len(apk),
        "sha256": digest,
        "sourceBytes": args.input.stat().st_size,
        "sourceSha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
        "entries": len(entries),
        "manifest": read_manifest_attributes(raw["AndroidManifest.xml"]),
        "schemes": report.get("schemes"),
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(details, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: details[k] for k in ("output", "bytes", "sha256", "manifest", "schemes")},
                     indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
