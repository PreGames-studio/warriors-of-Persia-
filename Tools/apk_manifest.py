#!/usr/bin/env python3
"""Minimal Android binary XML (AXML) support for patching the ``<manifest>`` tag.

Only what the build needs: read the string pool and the first ``<manifest>``
element, then rewrite ``android:versionCode`` / ``android:versionName`` in place
so every chunk size and offset in the file stays valid.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass

RES_STRING_POOL_TYPE = 0x0001
RES_XML_TYPE = 0x0003
RES_XML_START_ELEMENT_TYPE = 0x0102

UTF8_FLAG = 0x100
TYPE_INT_DEC = 0x10
TYPE_STRING = 0x03


@dataclass
class StringPool:
    """Position/length information for every string in a resource chunk."""

    chunk_offset: int
    count: int
    flags: int
    strings_start: int
    offsets: list[int]
    blob: bytearray

    @property
    def utf8(self) -> bool:
        return bool(self.flags & UTF8_FLAG)

    @property
    def string_count(self) -> int:
        return self.count

    def string_slice(self, index: int) -> tuple[int, int]:
        """Return (start, end) of the encoded string *index* inside ``blob``."""
        pool_start = self.chunk_offset + self.strings_start
        start = pool_start + self.offsets[index]
        if self.utf8:
            pos = start
            # u8 or u16 length of the UTF-8 byte count, then same for characters
            n = self.blob[pos]
            pos += 1
            if n & 0x80:
                pos += 1
            n2 = self.blob[pos]
            pos += 1
            if n2 & 0x80:
                pos += 1
            return pos, pos + (n & 0x7F if n & 0x80 else n)
        n = struct.unpack_from("<H", self.blob, start)[0]
        pos = start + 2
        if n & 0x8000:
            pos += 2
            n = ((n & 0x7FFF) << 16) | struct.unpack_from("<H", self.blob, start + 2)[0]
        return pos, pos + 2 * n

    def get(self, index: int) -> str:
        start, end = self.string_slice(index)
        raw = bytes(self.blob[start:end])
        return raw.decode("utf-8") if self.utf8 else raw.decode("utf-16-le")

    def replace(self, index: int, value: str) -> None:
        """Overwrite string *index* in place; the new value must have the same length."""
        start, end = self.string_slice(index)
        encoded = value.encode("utf-8") if self.utf8 else value.encode("utf-16-le")
        if len(encoded) != end - start:
            raise ValueError(
                f"in-place replacement must keep the same byte length "
                f"({len(encoded)} != {end - start})"
            )
        self.blob[start:end] = encoded


def _parse_string_pool(raw: bytes | bytearray, offset: int) -> StringPool:
    header_size = struct.unpack_from("<H", raw, offset + 2)[0]
    count, _styles, flags, strings_start, _styles_start = struct.unpack_from(
        "<IIIII", raw, offset + 8
    )
    del header_size
    offsets = list(struct.unpack_from(f"<{count}I", raw, offset + 28))
    return StringPool(offset, count, flags, strings_start, offsets, bytearray(raw))


def iter_chunks(raw: bytes | bytearray):
    offset = struct.unpack_from("<H", raw, 2)[0]
    while offset + 8 <= len(raw):
        chunk_type, header_size, size = struct.unpack_from("<HHI", raw, offset)
        if size < 8:
            break
        yield chunk_type, header_size, size, offset
        offset += size



def _encode_length(value: int, *, utf8: bool) -> bytes:
    """Encode a string-pool length prefix (1-2 bytes for UTF-8, 2-4 for UTF-16)."""
    if utf8:
        if value > 0x7F:
            return bytes([0x80 | (value >> 8), value & 0xFF])
        return bytes([value])
    if value > 0x7FFF:
        return struct.pack("<HH", 0x8000 | (value >> 16), value & 0xFFFF)
    return struct.pack("<H", value)


def _encode_pool_string(value: str, *, utf8: bool) -> bytes:
    if utf8:
        encoded = value.encode("utf-8")
        out = _encode_length(len(value), utf8=True) + _encode_length(len(encoded), utf8=True)
        out += encoded + b"\x00"
    else:
        units = len(value.encode("utf-16-le")) // 2
        out = _encode_length(units, utf8=False) + value.encode("utf-16-le") + b"\x00\x00"
    while len(out) % 4:
        out += b"\x00"
    return out


def rename_package(raw: bytes, new_package: str) -> bytes:
    """Rewrite the manifest ``package`` attribute, rebuilding the string pool.

    The package name has to be resolvable as a *new* app id, so its length changes
    and every following string offset has to be recomputed.  Nothing else in the
    binary XML references absolute pool offsets, so the rest of the document is
    copied verbatim.
    """
    pool = None
    for chunk_type, _header_size, _size, offset in iter_chunks(raw):
        if chunk_type == RES_STRING_POOL_TYPE:
            pool = _parse_string_pool(raw, offset)
            break
    if pool is None:
        raise ValueError("no string pool in AndroidManifest.xml")
    if pool.string_count == 0:
        raise ValueError("empty string pool")

    values = [pool.get(i) for i in range(pool.count)]
    index = None
    for i, value in enumerate(values):
        if value == new_package:
            index = i
            break
    if index is None:
        # the package attribute is the string that looks like the current app id
        current = read_manifest_attributes(raw).get("package")
        index = values.index(str(current))

    legacy = values[index]
    values[index] = new_package

    offsets: list[int] = []
    data = bytearray()
    for value in values:
        offsets.append(len(data))
        data += _encode_pool_string(value, utf8=pool.utf8)
    while len(data) % 4:
        data += b"\x00"

    header_size = 28
    strings_start = header_size + 4 * len(values)
    chunk_size = strings_start + len(data)
    new_pool = (
        struct.pack("<HHI", RES_STRING_POOL_TYPE, header_size, chunk_size)
        + struct.pack("<IIIII", len(values), 0, pool.flags, strings_start, 0)
        + b"".join(struct.pack("<I", off) for off in offsets)
        + bytes(data)
    )

    old_size = struct.unpack_from("<I", raw, pool.chunk_offset + 4)[0]
    out = bytearray(raw[:pool.chunk_offset] + new_pool + raw[pool.chunk_offset + old_size:])
    struct.pack_into("<I", out, 4, len(out))
    del legacy
    return bytes(out)


def patch_manifest(
    raw: bytes,
    *,
    version_code: int | None = None,
    version_name: str | None = None,
    package: str | None = None,
) -> bytes:
    """Return *raw* AXML with versionCode / versionName updated in place."""
    if package is not None:
        raw = rename_package(raw, package)
    if version_code is None and version_name is None:
        return raw

    pool: StringPool | None = None
    for chunk_type, _header, _size, offset in iter_chunks(raw):
        if chunk_type == RES_STRING_POOL_TYPE:
            pool = _parse_string_pool(raw, offset)
            break
    if pool is None:
        raise ValueError("no string pool in AndroidManifest.xml")

    for chunk_type, header_size, size, offset in iter_chunks(pool.blob):
        if chunk_type != RES_XML_START_ELEMENT_TYPE:
            continue
        name_index = struct.unpack_from("<I", pool.blob, offset + 20)[0]
        if pool.get(name_index) != "manifest":
            continue
        attr_start, attr_size, attr_count = struct.unpack_from("<HHH", pool.blob, offset + 24)
        base = offset + header_size + attr_start
        for i in range(attr_count):
            attr = base + i * attr_size
            attr_name_index = struct.unpack_from("<I", pool.blob, attr + 4)[0]
            attr_name = pool.get(attr_name_index)
            data = attr + 16  # typed value: size u16, res0 u8, dataType u8, data u32
            if attr_name == "versionCode" and version_code is not None:
                struct.pack_into("<I", pool.blob, data, version_code)
            elif attr_name == "versionName" and version_name is not None:
                raw_index = struct.unpack_from("<I", pool.blob, attr + 8)[0]
                if raw_index == 0xFFFFFFFF:
                    raise ValueError("versionName has no string index")
                pool.replace(raw_index, version_name)
                struct.pack_into("<I", pool.blob, data, raw_index)
        break
    else:
        raise ValueError("<manifest> element not found")

    return bytes(pool.blob)


def read_manifest_attributes(raw: bytes) -> dict[str, object]:
    """Best-effort dump of the ``<manifest>`` attributes (used by the auditor)."""
    pool: StringPool | None = None
    offsets: list[tuple[int, int, int]] = []
    for chunk_type, header_size, size, offset in iter_chunks(raw):
        offsets.append((chunk_type, header_size, offset))
        if chunk_type == RES_STRING_POOL_TYPE and pool is None:
            pool = _parse_string_pool(raw, offset)
        if size and chunk_type == RES_XML_START_ELEMENT_TYPE and pool is not None:
            name_index = struct.unpack_from("<I", raw, offset + 20)[0]
            if pool.get(name_index) == "manifest":
                attr_start, attr_size, attr_count = struct.unpack_from(
                    "<HHH", raw, offset + 24
                )
                base = offset + header_size + attr_start
                result = {}
                for i in range(attr_count):
                    attr = base + i * attr_size
                    name = pool.get(struct.unpack_from("<I", raw, attr + 4)[0])
                    data_type = raw[attr + 15]
                    value = struct.unpack_from("<I", raw, attr + 16)[0]
                    if data_type == TYPE_STRING:
                        value = pool.get(value)
                    result[name] = value
                return result
    return {}
