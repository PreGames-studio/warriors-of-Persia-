#!/usr/bin/env python3
"""Audit an APK for the failures that make Android reject an install.

Checks performed (every one of them has caused a real "invalid package" error):

1. ZIP integrity and structural sanity (EOCD, central directory, offsets).
2. Stored entries 4-byte aligned, ``resources.arsc`` stored + aligned
   (mandatory for ``targetSdkVersion >= 30``, recommended for all).
3. JAR signature (v1): ``MANIFEST.MF`` entry digests, ``CERT.SF`` digests and the
   PKCS#7 signature over ``CERT.SF``.
4. APK Signature Scheme v2: block structure, chunked content digest and the
   signature over the signed-data section.
5. ``AndroidManifest.xml`` parses as binary XML and exposes package, versionCode,
   versionName, minSdkVersion and targetSdkVersion; ``classes.dex`` is a DEX file.

Usage:
    python3 Tools/verify_apk.py WarriorsOfPersia_3D.apk --json audit.json
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
import sys
import zipfile
from pathlib import Path

from asn1crypto import cms
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

sys.path.insert(0, str(Path(__file__).resolve().parent))

from apk_manifest import read_manifest_attributes  # noqa: E402
from apk_signing import (  # noqa: E402
    APK_SIGNATURE_SCHEME_V2_BLOCK_ID,
    APK_SIGNING_BLOCK_MAGIC,
    SIG_ALG_RSA_PKCS1_V1_5_SHA256,
    compute_apk_content_digest,
    zip_layout,
)


def _lp(buf: bytes, offset: int) -> tuple[bytes, int]:
    if offset + 4 > len(buf):
        raise ValueError("truncated length prefix")
    length = struct.unpack_from("<I", buf, offset)[0]
    end = offset + 4 + length
    if end > len(buf):
        raise ValueError("length prefix runs past the end of the buffer")
    return buf[offset + 4:end], end


def find_signing_block(apk: bytes) -> tuple[int, dict[int, bytes]]:
    layout = zip_layout(apk)
    cd_offset = layout["cd_offset"]
    magic_offset = apk.rfind(APK_SIGNING_BLOCK_MAGIC, 0, cd_offset)
    if magic_offset < 0:
        raise ValueError("APK Signing Block not found")
    size = struct.unpack_from("<Q", apk, magic_offset - 8)[0]
    start = magic_offset + 16 - size - 8
    if start < 0 or struct.unpack_from("<Q", apk, start)[0] != size:
        raise ValueError("APK Signing Block size fields do not match")
    pairs: dict[int, bytes] = {}
    pos = start + 8
    while pos < magic_offset - 8:
        length = struct.unpack_from("<Q", apk, pos)[0]
        pair_id = struct.unpack_from("<I", apk, pos + 8)[0]
        pairs[pair_id] = apk[pos + 12:pos + 8 + length]
        pos += 8 + length
    if pos != magic_offset - 8:
        raise ValueError("APK Signing Block pairs are misaligned")
    return start, pairs


def parse_v2_block(value: bytes) -> dict:
    """Parse the v2 block value the same way apksig / the platform do."""
    signers_seq, end = _lp(value, 0)
    if end != len(value):
        raise ValueError("unexpected trailing bytes after the v2 signer list")
    signer, _ = _lp(signers_seq, 0)

    signed_data, offset = _lp(signer, 0)
    signatures, offset = _lp(signer, offset)
    public_key, offset = _lp(signer, offset)
    if offset != len(signer):
        raise ValueError("v2 signer has trailing bytes")

    digests_seq, pos = _lp(signed_data, 0)
    certs_seq, pos = _lp(signed_data, pos)
    attrs_seq, pos = _lp(signed_data, pos)
    # apksig (and the platform verifier) tolerate a few trailing zero bytes.
    trailing = signed_data[pos:]
    if len(trailing) > 8 or any(trailing):
        raise ValueError("v2 signed-data has unexpected trailing bytes")

    digest_records = []
    pos = 0
    while pos < len(digests_seq):
        record, next_pos = _lp(digests_seq, pos)
        alg, dlen = struct.unpack_from("<II", record, 0)
        digest_records.append((alg, record[8:8 + dlen]))
        pos = next_pos

    signature_records = []
    pos = 0
    while pos < len(signatures):
        record, next_pos = _lp(signatures, pos)
        alg, slen = struct.unpack_from("<II", record, 0)
        signature_records.append((alg, record[8:8 + slen]))
        pos = next_pos

    certificates = []
    pos = 0
    while pos < len(certs_seq):
        cert, pos = _lp(certs_seq, pos)
        certificates.append(cert)

    return {
        "signedData": signed_data,
        "digests": digest_records,
        "signatures": signature_records,
        "certificates": certificates,
        "publicKey": public_key,
        "attributes": attrs_seq,
        "signedDataTrailingBytes": len(trailing),
    }


def verify_v1(apk: bytes, zf: zipfile.ZipFile) -> dict:
    result: dict = {"checked": False, "ok": False, "problems": []}
    names = set(zf.namelist())
    if "META-INF/MANIFEST.MF" not in names:
        result["problems"].append("META-INF/MANIFEST.MF is missing")
        return result
    result["checked"] = True

    manifest = zf.read("META-INF/MANIFEST.MF")
    sections = manifest.split(b"\r\n\r\n")
    entry_digests: dict[str, str] = {}
    for section in sections:
        if not section.startswith(b"Name: "):
            continue
        lines = section.split(b"\r\n")
        name = lines[0][len(b"Name: "):].decode("utf-8")
        for line in lines[1:]:
            if line.startswith(b"SHA-256-Digest: "):
                entry_digests[name] = line[len(b"SHA-256-Digest: "):].decode("ascii")

    checked = 0
    for name, expected in entry_digests.items():
        if name not in names:
            result["problems"].append(f"MANIFEST.MF lists missing entry {name}")
            continue
        try:
            payload = zf.read(name)
        except Exception as exc:  # noqa: BLE001 - corrupted entry
            result["problems"].append(f"entry {name} cannot be read: {exc}")
            continue
        actual = base64.b64encode(hashlib.sha256(payload).digest()).decode("ascii")
        if actual != expected:
            result["problems"].append(f"MANIFEST.MF digest mismatch for {name}")
        checked += 1
    if not entry_digests:
        result["problems"].append("MANIFEST.MF contains no entry digests")

    sf_name = next((n for n in names if n.startswith("META-INF/") and n.endswith(".SF")), None)
    p7_name = next((n for n in names if n.startswith("META-INF/") and n.endswith((".RSA", ".DSA", ".EC"))), None)
    if not sf_name or not p7_name:
        result["problems"].append("CERT.SF / signature block missing")
        return result

    sf = zf.read(sf_name)
    sf_sections = sf.split(b"\r\n\r\n")
    main = sf_sections[0]
    declared = None
    schemes = None
    for line in main.split(b"\r\n"):
        if line.startswith(b"SHA-256-Digest-Manifest: "):
            declared = line[len(b"SHA-256-Digest-Manifest: "):].decode("ascii")
        if line.startswith(b"X-Android-APK-Signed: "):
            schemes = line[len(b"X-Android-APK-Signed: "):].decode("ascii")
    if declared:
        actual = base64.b64encode(hashlib.sha256(manifest).digest()).decode("ascii")
        if actual != declared:
            result["problems"].append("CERT.SF SHA-256-Digest-Manifest mismatch")
    else:
        result["problems"].append("CERT.SF has no SHA-256-Digest-Manifest")

    manifest_sections = {s.split(b"\r\n", 1)[0][len(b"Name: "):].decode("utf-8"): s
                         for s in sections if s.startswith(b"Name: ")}
    for section in sf_sections[1:]:
        if not section.startswith(b"Name: "):
            continue
        lines = section.split(b"\r\n")
        name = lines[0][len(b"Name: "):].decode("utf-8")
        for line in lines[1:]:
            if line.startswith(b"SHA-256-Digest: "):
                expected = line[len(b"SHA-256-Digest: "):].decode("ascii")
                source = manifest_sections.get(name)
                if source is None:
                    result["problems"].append(f"CERT.SF entry {name} missing from MANIFEST.MF")
                    break
                actual = base64.b64encode(hashlib.sha256(source + b"\r\n\r\n").digest()).decode("ascii")
                if actual != expected:
                    result["problems"].append(f"CERT.SF digest mismatch for {name}")

    # PKCS#7 signature over CERT.SF
    try:
        content_info = cms.ContentInfo.load(zf.read(p7_name))
        signed_data = content_info["content"]
        certs = [c.chosen.dump() for c in signed_data["certificates"]]
        from cryptography import x509

        cert = x509.load_der_x509_certificate(certs[0])
        signer = signed_data["signer_infos"][0]
        signature = signer["signature"].native
        sig_alg = signer["signature_algorithm"]["algorithm"].native
        if sig_alg not in ("sha256_rsa", "sha1_rsa", "rsassa_pkcs1v15"):
            result["problems"].append(f"unexpected PKCS#7 signature algorithm {sig_alg}")
        digest_alg = signer["digest_algorithm"]["algorithm"].native
        hash_obj = hashes.SHA256() if digest_alg == "sha256" else hashes.SHA1()
        try:
            cert.public_key().verify(signature, sf, padding.PKCS1v15(), hash_obj)
            result["pkcs7Verified"] = True
        except Exception as exc:  # noqa: BLE001
            result["pkcs7Verified"] = False
            result["problems"].append(f"PKCS#7 signature over CERT.SF failed: {exc}")
    except Exception as exc:  # noqa: BLE001
        result["problems"].append(f"PKCS#7 block unreadable: {exc}")

    result["entriesVerified"] = checked
    result["declaredSchemes"] = schemes
    result["ok"] = not result["problems"]
    return result


def verify_v2(apk: bytes) -> dict:
    result: dict = {"present": False, "ok": False, "problems": []}
    try:
        block_offset, pairs = find_signing_block(apk)
    except ValueError as exc:
        result["problems"].append(str(exc))
        return result
    result["blockOffset"] = block_offset
    result["pairIds"] = [f"0x{pid:08x}" for pid in pairs]
    if APK_SIGNATURE_SCHEME_V2_BLOCK_ID not in pairs:
        result["problems"].append("v2 signature block missing")
        return result
    result["present"] = True

    parsed = parse_v2_block(pairs[APK_SIGNATURE_SCHEME_V2_BLOCK_ID])
    digests = dict(parsed["digests"])
    if SIG_ALG_RSA_PKCS1_V1_5_SHA256 not in digests:
        result["problems"].append("no RSA PKCS#1 v1.5 + SHA-256 digest in v2 block")
        return result

    expected = compute_apk_content_digest(apk, block_offset)
    result["contentDigest"] = expected.hex()
    result["declaredDigest"] = digests[SIG_ALG_RSA_PKCS1_V1_5_SHA256].hex()
    if digests[SIG_ALG_RSA_PKCS1_V1_5_SHA256] != expected:
        result["problems"].append("v2 content digest does not match the APK contents")

    from cryptography.hazmat.primitives.serialization import load_der_public_key

    public_key = load_der_public_key(parsed["publicKey"])
    signatures = dict(parsed["signatures"])
    try:
        public_key.verify(
            signatures[SIG_ALG_RSA_PKCS1_V1_5_SHA256],
            parsed["signedData"],
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        result["signatureVerified"] = True
    except Exception as exc:  # noqa: BLE001
        result["signatureVerified"] = False
        result["problems"].append(f"v2 signature failed: {exc}")

    from cryptography import x509

    cert = x509.load_der_x509_certificate(parsed["certificates"][0])
    result["certificateSubject"] = cert.subject.rfc4514_string()
    result["certificateSha256"] = hashlib.sha256(parsed["certificates"][0]).hexdigest()
    result["certificateNotAfter"] = cert.not_valid_after_utc.isoformat()
    result["publicKeyMatchesCertificate"] = (
        cert.public_key().public_numbers() == public_key.public_numbers()
    )
    if not result["publicKeyMatchesCertificate"]:
        result["problems"].append("v2 public key does not match the first certificate")

    result["ok"] = not result["problems"]
    return result


def audit(path: Path) -> dict:
    apk = path.read_bytes()
    report: dict = {
        "path": str(path),
        "bytes": len(apk),
        "sha256": hashlib.sha256(apk).hexdigest(),
        "verdict": "fail",
        "problems": [],
    }
    try:
        zf = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        report["problems"].append(f"not a ZIP file: {exc}")
        return report

    with zf:
        report["zipTest"] = "ok" if zf.testzip() is None else "corrupt"
        if report["zipTest"] != "ok":
            report["problems"].append("ZIP central directory / CRC check failed")
        entries = {i.filename: i for i in zf.infolist()}
        report["entryCount"] = len(entries)
        alignment = {}
        for name, info in entries.items():
            if info.compress_type == zipfile.ZIP_STORED:
                header = apk[info.header_offset:info.header_offset + 30]
                name_len, extra_len = struct.unpack_from("<HH", header, 26)
                data_offset = info.header_offset + 30 + name_len + extra_len
                alignment[name] = data_offset % 4
        report["storedEntryAlignmentMod4"] = alignment
        misaligned = {n: v for n, v in alignment.items() if v != 0}
        if misaligned:
            report["problems"].append(f"stored entries not 4-byte aligned: {misaligned}")
        if "resources.arsc" in entries and entries["resources.arsc"].compress_type != zipfile.ZIP_STORED:
            report["problems"].append("resources.arsc is compressed (must be stored)")
        if "AndroidManifest.xml" not in entries:
            report["problems"].append("AndroidManifest.xml missing")
            return report

        manifest = zf.read("AndroidManifest.xml")
        attrs = read_manifest_attributes(manifest)
        report["manifest"] = {k: (v if isinstance(v, int) else str(v)) for k, v in attrs.items()}
        if "package" not in attrs:
            report["problems"].append("manifest has no package attribute")

        if "classes.dex" in entries:
            dex = zf.read("classes.dex")
            report["dexMagic"] = dex[:8].decode("latin-1")
            if not dex.startswith(b"dex\n"):
                report["problems"].append("classes.dex is not a DEX file")

        try:
            report["v1"] = verify_v1(apk, zf)
        except Exception as exc:  # noqa: BLE001
            report["v1"] = {"ok": False, "problems": [f"v1 verification error: {exc}"]}
        if not report["v1"].get("ok"):
            report["problems"].append("JAR signature (v1) verification failed")
        try:
            report["v2"] = verify_v2(apk)
        except Exception as exc:  # noqa: BLE001
            report["v2"] = {"ok": False, "problems": [f"v2 verification error: {exc}"]}
        if not report["v2"].get("ok"):
            report["problems"].append("APK Signature Scheme v2 verification failed")

        if "assets/index.html" in entries:
            html = zf.read("assets/index.html")
            report["indexHtmlBytes"] = len(html)
            marker = b'name="wop-build" content="'
            pos = html.find(marker)
            if pos >= 0:
                start = pos + len(marker)
                report["buildMarker"] = html[start:html.find(b'"', start)].decode("latin-1")

    report["verdict"] = "pass" if not report["problems"] else "fail"
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--json", type=Path, help="write the full report as JSON")
    args = parser.parse_args()

    report = audit(args.apk)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    summary = {
        "path": report["path"],
        "bytes": report["bytes"],
        "sha256": report["sha256"],
        "verdict": report["verdict"],
        "problems": report["problems"],
        "package": report.get("manifest", {}).get("package"),
        "versionCode": report.get("manifest", {}).get("versionCode"),
        "v1": report.get("v1", {}).get("ok"),
        "v2": report.get("v2", {}).get("ok"),
        "certificate": report.get("v2", {}).get("certificateSubject"),
        "buildMarker": report.get("buildMarker"),
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if report["verdict"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
