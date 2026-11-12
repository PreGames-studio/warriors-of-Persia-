#!/usr/bin/env python3
"""Build a valid, minimal ``resources.arsc`` for the offline game APK.

The game needs no Android resources: the manifest uses a literal label, the
framework theme is referenced by numeric id and all artwork lives in
``assets/index.html``.  The APK that shipped before contained a hand-written
576-byte resource table that was structurally corrupt -- Android's own resource
parser (the code inside ``aapt2`` and inside the platform's package manager)
rejects it with::

    error: corrupt ResTable_package: chunk is past the end of the document

which makes the whole package "invalid" at install time.

This module emits a *structurally valid* ``ResTable`` with zero packages, which
is what an APK without app resources looks like:

    ResTable_header  (type 0x0002, header size 12, packageCount 0)
    ResStringPool    (empty global value string pool)

Verified with ``aapt2 dump badging`` / ``aapt2 dump resources`` /
``aapt2 dump xmltree``; see ``Tools/verify_apk.py --aapt2``.
"""
from __future__ import annotations

import struct

RES_TABLE_TYPE = 0x0002
RES_STRING_POOL_TYPE = 0x0001


def _string_pool(strings: list[str]) -> bytes:
    """Encode a UTF-8 ResStringPool chunk (NUL terminated, 4-byte padded)."""
    offsets: list[int] = []
    data = bytearray()
    for value in strings:
        offsets.append(len(data))
        encoded = value.encode("utf-8")
        data += bytes([len(encoded)]) + encoded + b"\x00"
        while len(data) % 4:
            data += b"\x00"
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    size = strings_start + len(data)
    return (
        struct.pack("<HHI", RES_STRING_POOL_TYPE, header_size, size)
        + struct.pack(
            "<IIIII",
            len(strings),  # stringCount
            0,  # styleCount
            0x100,  # UTF8_FLAG
            strings_start,
            0,  # stylesStart
        )
        + b"".join(struct.pack("<I", offset) for offset in offsets)
        + bytes(data)
    )


def empty_resource_table(*, package_name: str | None = None) -> bytes:
    """Return a minimal ``resources.arsc`` payload.

    ``package_name`` is accepted for documentation purposes only: the table has
    no package chunks, so nothing inside it refers to the app id.  Callers that
    need real resources should use ``aapt2 link`` instead.
    """
    del package_name
    pool = _string_pool([])
    body = pool
    return struct.pack("<HHII", RES_TABLE_TYPE, 12, 12 + len(body), 0) + body
