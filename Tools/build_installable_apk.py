#!/usr/bin/env python3
"""Repackage the offline web build into an installable, reproducible APK.

The game content (``assets/index.html``) is taken byte-for-byte from the previous
APK or from the repository's Unity preview bundle; only the container and the
signatures are rebuilt:

* ``resources.arsc`` and ``res/drawable/icon.png`` are stored uncompressed and
  4-byte aligned (Android requirement);
* the JAR signature (v1) and APK Signature Scheme v2 are produced by
  ``Tools/apk_signing.py`` with the committed release key, so future builds stay
  upgrade-compatible (the previous release rotated keys, which makes an APK fail
  to install over an existing copy);
* ``versionCode`` / ``versionName`` are patched in binary XML.

Usage:
    python3 Tools/build_installable_apk.py \
        --source-apk WarriorsOfPersia_3D.apk \
        --keystore Tools/keys/wop-release.p12 --storepass wop-release-2026 \
        --version-code 2 --version-name 1.0.1 \
        --output WarriorsOfPersia_3D.apk
"""
from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from apk_manifest import patch_manifest, read_manifest_attributes  # noqa: E402
from apk_signing import Entry, sign_apk  # noqa: E402

from cryptography.hazmat.primitives.serialization import pkcs12  # noqa: E402


def load_key(keystore: Path, password: str):
    key, cert, extra = pkcs12.load_key_and_certificates(
        keystore.read_bytes(), password.encode("utf-8")
    )
    if key is None or cert is None:
        raise SystemExit(f"{keystore} does not contain a private key + certificate")
    from cryptography.hazmat.primitives.serialization import Encoding

    return key, cert.public_bytes(Encoding.DER), [c.public_bytes(Encoding.DER) for c in (extra or [])]


def collect_entries(
    source: Path,
    version_code: int | None,
    version_name: str | None,
    package: str | None = None,
) -> list[Entry]:
    """Reuse the game payload from *source* and rebuild the container around it."""
    with zipfile.ZipFile(source) as zf:
        content = {
            info.filename: zf.read(info.filename)
            for info in zf.infolist()
            if not info.filename.startswith("META-INF/")
            and not info.filename.endswith((".SF", ".RSA", ".DSA", ".EC"))
        }

    content["AndroidManifest.xml"] = patch_manifest(
        content["AndroidManifest.xml"],
        version_code=version_code,
        version_name=version_name,
        package=package,
    )

    # resources.arsc must be stored and 4-byte aligned; drawables are stored too
    # so that resources can be mapped straight from the APK.
    order = ["AndroidManifest.xml", "classes.dex", "resources.arsc"]
    entries: list[Entry] = []
    for name in order:
        if name in content:
            entries.append(Entry(name, content.pop(name), compress=name != "resources.arsc"))
    for name in sorted(n for n in content if n.startswith("res/")):
        entries.append(Entry(name, content.pop(name), compress=False))
    for name in sorted(content):
        entries.append(Entry(name, content.pop(name), compress=True))
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-apk", type=Path, required=True,
                        help="APK whose assets/classes.dex/resources.arsc are reused")
    parser.add_argument("--keystore", type=Path, required=True)
    parser.add_argument("--storepass", required=True)
    parser.add_argument("--version-code", type=int)
    parser.add_argument("--version-name")
    parser.add_argument("--package", help="override the application id (fresh install id)")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    key, cert_der, extra_certs = load_key(args.keystore, args.storepass)
    entries = collect_entries(args.source_apk, args.version_code, args.version_name, args.package)
    apk, report = sign_apk(entries, key, cert_der, extra_certificates=extra_certs)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(apk)

    manifest_attrs = read_manifest_attributes(
        next(e.data for e in entries if e.name == "AndroidManifest.xml")
    )
    report.update(
        {
            "output": str(args.output),
            "bytes": len(apk),
            "sha256": __import__("hashlib").sha256(apk).hexdigest(),
            "manifest": {k: v for k, v in manifest_attrs.items()},
        }
    )
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: report[k] for k in ("output", "bytes", "sha256", "manifest")},
                     indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
