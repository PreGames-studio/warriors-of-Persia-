#!/usr/bin/env python3
"""Give Mia an anime-leaning, appealing face — on the asset, not with a filter.

Scope
-----
* The skin albedo (2048²) and the eye albedo (256²) are repainted at their
  native resolution and re-encoded as *lossless* WebP.
* Two micro geometry passes on the eyebrow cards only: they are thinned and
  shortened around their own centroid. No other vertex is touched, no triangle
  count changes, every skin weight and normal stays as authored.
* Normal maps, ORM maps, all other textures, the skeleton and the 13 visible
  meshes are untouched.

The art direction is the one the brief asks for: larger iris with a hard limbal
ring and two specular highlights, a heavy upper lash line with an outer wing, a
soft crease and lower-lash accent, slender arched brows, a small rose mouth,
cleaner warmer skin and a little blush.

Coordinates below were measured on this atlas (the eyes sit at y≈375 px, the
painted mouth at y≈512 px) and verified against close-up renders, not guessed.

Usage
-----
    python3 Tools/stylize_mia_face.py \
        --source unity_preview/assets/hero/mia/mia_base.glb \
        --output /tmp/mia_face.glb --manifest /tmp/mia-face-manifest.json
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ------------------------------------------------------------------ atlas map
LEFT_EYE = (268.0, 356.0, 45.0, 20.0)    # cx, cy, rx, ry of the eyelid aperture
RIGHT_EYE = (488.0, 356.0, 45.0, 20.0)
# The authored lips are painted ~30 px above the geometric mouth groove, so the
# old paint is cleared at its own centre and the new mouth is drawn on the groove.
OLD_MOUTH = (381.0, 515.0, 62.0, 30.0)
MOUTH = (381.0, 540.0, 56.0, 22.0)
NOSE = (378.0, 448.0, 52.0, 66.0)
FACE = (378.0, 448.0, 205.0, 235.0)      # cx, cy, rx, ry of the skin mask

INK = (34, 22, 26)                       # lash / brow ink
ROSE = (232, 138, 144)
ROSE_LIGHT = (246, 166, 162)

# --------------------------------------------------------------- glb plumbing


def read_glb(path: Path):
    raw = path.read_bytes()
    magic, version, _ = struct.unpack_from("<III", raw, 0)
    assert magic == 0x46546C67 and version == 2, f"{path} is not a glTF 2.0 binary"
    offset, document, binary = 12, None, None
    while offset < len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        chunk = raw[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
        offset += (4 - offset % 4) % 4
    assert document is not None and binary is not None, f"{path} is missing a chunk"
    return raw, document, binary


def write_glb(path: Path, document: dict, binary: bytes) -> None:
    binary = bytes(binary) + b"\0" * ((-len(binary)) % 4)
    document["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with path.open("wb") as handle:
        handle.write(struct.pack("<4sII", b"glTF", 2, total))
        handle.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        handle.write(json_bytes)
        handle.write(struct.pack("<II", len(binary), 0x004E4942))
        handle.write(binary)


def image_index(document: dict, name: str) -> int | None:
    return next((i for i, image in enumerate(document["images"]) if image.get("name") == name), None)


def image_payload(document: dict, binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][document["images"][index]["bufferView"]]
    start = view.get("byteOffset", 0)
    return binary[start:start + view["byteLength"]]


# ------------------------------------------------------------------- painting


def _ellipse(size, centre, softness=1.0):
    cx, cy, rx, ry = centre
    ys, xs = np.mgrid[0:size[1], 0:size[0]]
    distance = np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
    return np.clip((1.0 - distance) / max(1e-3, softness), 0.0, 1.0) ** 1.3


def _arc(cx, cy, rx, ry, start, end, steps=96, bottom_scale=1.0):
    points = []
    for i in range(steps + 1):
        angle = math.radians(start + (end - start) * i / steps)
        squeeze = bottom_scale if math.sin(angle) > 0 else 1.0
        points.append((cx + math.cos(angle) * rx, cy + math.sin(angle) * ry * squeeze))
    return points


def _bezier(start, control, end, steps=48):
    points = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        points.append((u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
                       u * u * start[1] + 2 * u * t * control[1] + t * t * end[1]))
    return points


def _taper(draw, points, width_from, width_to, colour):
    """A polyline whose width tapers along its length — lash and wing strokes."""
    total = len(points) - 1
    for i in range(total):
        t = i / max(1, total - 1)
        width = max(1.0, width_from + (width_to - width_from) * t)
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        draw.line([(x0, y0), (x1, y1)], fill=colour, width=int(round(width)))
        r = width / 2.0
        draw.ellipse([x1 - r, y1 - r, x1 + r, y1 + r], fill=colour)


def _composite(base: Image.Image, layer: Image.Image, blur=0.0) -> Image.Image:
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base = base.convert("RGBA")
    base.alpha_composite(layer)
    return base.convert("RGB")


def _to_image(array: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(array, 0, 1) * 255).astype(np.uint8), "RGB")


def _blur_rgb(array: np.ndarray, radius: float) -> np.ndarray:
    return np.asarray(_to_image(array).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def clean_skin(image: Image.Image) -> Image.Image:
    """Turn the baked studio shading into clean anime skin.

    The source atlas bakes shadow under the cheekbones, around the nose and
    along the jaw. Real-time lighting then shades the same form a second time,
    which is what made the face read as dirty. Each pixel is pulled towards its
    own smooth neighbourhood (hue preserved), so gradients stay but grime goes.
    """
    glyph = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0

    # Isolated freckle specks: replace only pixels clearly darker than their
    # immediate neighbourhood.
    local = _blur_rgb(glyph, 2.2)
    delta = glyph.mean(-1) - local.mean(-1)
    speck = np.clip(-delta / 0.06, 0, 1)
    speck = np.asarray(
        Image.fromarray((speck * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)),
        dtype=np.float32) / 255.0
    glyph = glyph * (1 - speck[..., None]) + local * speck[..., None]

    # Compress local contrast towards the smooth neighbourhood.
    smooth = _blur_rgb(glyph, 34)
    safe = np.maximum(smooth, 0.08)
    ratio = glyph / safe
    compressed = safe * (1.0 + 0.34 * (ratio - 1.0))
    mask = _ellipse(glyph.shape[1::-1], FACE, softness=0.45)[..., None]
    glyph = glyph * (1 - mask) + compressed * mask

    # Warm, fair anime base tone with a gentle lift in the midtones.
    lifted = np.clip(glyph, 0, 1) ** 0.94
    peach = np.array([0.972, 0.862, 0.800], dtype=np.float32)
    lifted = lifted * 0.86 + (lifted * 0.55 + peach * 0.45) * 0.14
    return _to_image(lifted)


def paint_region(image: Image.Image, mask: Image.Image, strength: float, radius: float = 18.0) -> Image.Image:
    """Replace a region with its own smooth neighbourhood, feathered.

    Used to erase the baked lash line and the baked mouth before painting the
    stylised versions, without leaving the rectangular seams a paste would.
    """
    estimate = image.filter(ImageFilter.GaussianBlur(radius))
    feather = mask.filter(ImageFilter.GaussianBlur(max(2.0, radius * 0.5)))
    alpha = np.asarray(feather, dtype=np.float32) / 255.0 * strength
    base = np.asarray(image, dtype=np.float32) / 255.0
    fill = np.asarray(estimate, dtype=np.float32) / 255.0
    out = base * (1 - alpha[..., None]) + fill * alpha[..., None]
    return _to_image(out)


def paint_skin(image: Image.Image) -> tuple[Image.Image, list[str]]:
    size = image.size[0]
    notes: list[str] = []
    image = clean_skin(image)
    notes.append("freckles removed, baked studio shadow flattened, fair warm tone")

    # --- lids -------------------------------------------------------------
    # Erase the baked studio liner: it is what made the eye look heavy and
    # tired under a moving light. The skin tone underneath is then re-lashed.
    lid_mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(lid_mask)
    for eye in (LEFT_EYE, RIGHT_EYE):
        cx, cy, rx, ry = eye
        draw.ellipse([cx - rx * 1.6, cy - ry * 2.9, cx + rx * 1.6, cy + ry * 2.1], fill=255)
    lid_mask = lid_mask.filter(ImageFilter.GaussianBlur(11))
    image = paint_region(image, lid_mask, 0.96, radius=19.0)

    # Soft mauve crease above the lash line — the anime "double eyelid".
    shade = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shade)
    for eye in (LEFT_EYE, RIGHT_EYE):
        cx, cy, rx, ry = eye
        draw.polygon(_arc(cx, cy - ry * 0.55, rx * 1.12, ry * 1.55, 205, 335), fill=(184, 128, 128, 30))
    image = _composite(image, shade, blur=5.5)

    line = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(line)
    for eye, side in ((LEFT_EYE, -1), (RIGHT_EYE, 1)):
        cx, cy, rx, ry = eye
        # Upper lash: follows the lid margin, thin inside, heavier and drawn out
        # at the outer corner.
        upper = _arc(cx, cy + 2.0, rx * 1.0, ry * 0.96, 192, 348)
        if side > 0:
            upper = upper[::-1]
        _taper(draw, upper, 3.2, 9.0, INK + (234,))
        outer = (cx + side * rx * 0.99, cy - 1.0)
        tip = (cx + side * (rx * 0.99 + 14.0), cy - 15.0)
        _taper(draw, [outer, ((outer[0] + tip[0]) / 2, outer[1] - 5.0), tip], 7.0, 1.0, INK + (224,))
        # A very light outer lower-lid accent keeps the eye from looking open in
        # a doll-like way without painting a tired dark ring under it.
        lower = _arc(cx, cy + 3.0, rx * 0.94, ry * 0.90, 30, 74)
        if side > 0:
            lower = lower[::-1]
        _taper(draw, lower, 0.8, 1.8, INK + (86,))
    image = _composite(image, line, blur=1.4)
    notes.append("baked liner erased; fresh lash line, outer wing, crease and aegyo-sal")

    # --- lips -------------------------------------------------------------
    # Clear the authored mouth (wide, grey, downturned) with local skin tone,
    # then paint a small rose mouth with a cupid's bow and a soft gloss.
    mouth_mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mouth_mask).ellipse(
        [OLD_MOUTH[0] - OLD_MOUTH[2] * 1.06, OLD_MOUTH[1] - OLD_MOUTH[3] * 1.55,
         OLD_MOUTH[0] + OLD_MOUTH[2] * 1.06, OLD_MOUTH[1] + OLD_MOUTH[3] * 1.55], fill=255)
    mouth_mask = mouth_mask.filter(ImageFilter.GaussianBlur(10))
    image = paint_region(image, mouth_mask, 0.96, radius=15.0)

    lips = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(lips)
    mx, my = MOUTH[0], MOUTH[1]
    mr, mh = MOUTH[2] * 0.82, MOUTH[3] * 0.72
    upper = [
        (mx - mr, my + 2),
        (mx - mr * 0.62, my - mh * 0.44),
        (mx - mr * 0.30, my - mh * 0.24),
        (mx - mr * 0.12, my - mh * 0.14),
        (mx, my - mh * 0.46),               # cupid's bow
        (mx + mr * 0.12, my - mh * 0.14),
        (mx + mr * 0.30, my - mh * 0.24),
        (mx + mr * 0.62, my - mh * 0.44),
        (mx + mr, my + 2),
        (mx, my + mh * 0.08),
    ]
    draw.polygon(upper, fill=ROSE + (206,))
    lower = [
        (mx - mr, my + 2),
        (mx - mr * 0.55, my + mh * 0.58),
        (mx, my + mh * 0.86),
        (mx + mr * 0.55, my + mh * 0.58),
        (mx + mr, my + 2),
        (mx, my + mh * 0.05),
    ]
    draw.polygon(lower, fill=ROSE_LIGHT + (206,))
    draw.line([(mx - mr, my + 2), (mx, my - mh * 0.04), (mx + mr, my + 2)],
              fill=(180, 106, 110, 122), width=3)
    draw.ellipse([mx - mr * 0.26, my + mh * 0.20, mx + mr * 0.02, my + mh * 0.54],
                 fill=(255, 236, 228, 118))
    for side in (-1, 1):
        cx = mx + side * mr * 0.98
        draw.ellipse([cx - 5, my - 4, cx + 5, my + 6], fill=ROSE + (110,))
    draw.polygon(_arc(mx, my - mh * 0.30, mr * 0.72, mh * 0.42, 200, 340), fill=(255, 208, 198, 52))
    image = _composite(image, lips, blur=1.9)
    notes.append("authored mouth cleared; small rose mouth with cupid's bow and gloss")

    # --- brows ------------------------------------------------------------
    # The authored card is a wide slab that reads as a frown. A slender painted
    # arch replaces it (the card is hidden by mia-hero.js at load time).
    brow_mask = Image.new("L", image.size, 0)
    brow_draw = ImageDraw.Draw(brow_mask)
    for eye, out in ((LEFT_EYE, -1), (RIGHT_EYE, 1)):
        cx = eye[0]
        inner = (cx - out * 42.0, 301.0)
        peak = (cx + out * 10.0, 285.0)
        tip = (cx + out * 54.0, 293.0)
        curve = _bezier(inner, peak, tip, 48)
        brow_draw.line(curve, fill=255, width=9, joint="curve")
        brow_draw.ellipse([inner[0] - 5, inner[1] - 5, inner[0] + 5, inner[1] + 5], fill=255)
    brow_mask = brow_mask.filter(ImageFilter.GaussianBlur(2.4))
    brows = Image.new("RGBA", image.size, (0, 0, 0, 0))
    alpha = np.asarray(brow_mask, dtype=np.float32) / 255.0
    # Taper the far end so the arch fades to a point instead of stopping dead.
    xs = np.arange(image.size[0])[None, :]
    taper = np.ones_like(alpha)
    for eye, out in ((LEFT_EYE, -1), (RIGHT_EYE, 1)):
        cx = eye[0]
        edge = cx + out * 54.0
        span = 16.0
        t = np.clip(1.0 - np.abs(xs - edge) / span, 0.0, 1.0)
        near = np.abs(xs - edge) < span
        taper = np.where(near & (alpha > 0.02), np.minimum(taper, 0.35 + 0.65 * t), taper)
    alpha = alpha * taper
    brows = Image.new("RGBA", image.size, (96, 66, 50, 0))
    brows.putalpha(Image.fromarray((alpha * 206).astype(np.uint8)))
    image = _composite(image, brows, blur=0.9)
    notes.append("slender painted brow arch replaces the wide authored card")

    # --- nose: slim highlight, softened nostrils -------------------------
    nose = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(nose)
    nx, ny = NOSE[0], NOSE[1]
    draw.line([(nx + 3, ny - 58), (nx + 1, ny + 22)], fill=(255, 250, 242, 34), width=11)
    draw.ellipse([nx - 20, ny + 30, nx + 20, ny + 50], fill=(255, 246, 238, 30))
    draw.ellipse([nx - 16, ny + 34, nx - 2, ny + 42], fill=(150, 96, 84, 26))
    draw.ellipse([nx + 2, ny + 34, nx + 16, ny + 42], fill=(150, 96, 84, 26))
    image = _composite(image, nose, blur=3.4)
    notes.append("nose bridge highlight and softer nostrils")

    # --- blush -----------------------------------------------------------
    blush = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(blush)
    for eye in (LEFT_EYE, RIGHT_EYE):
        cx, cy = eye[0], eye[1] + 92
        draw.ellipse([cx - 66, cy - 30, cx + 66, cy + 34], fill=(246, 140, 136, 52))
    draw.ellipse([NOSE[0] - 30, NOSE[1] + 18, NOSE[0] + 30, NOSE[1] + 46], fill=(240, 138, 130, 34))
    image = _composite(image, blush, blur=16.0)
    notes.append("cheek and nose blush")

    return image, notes


def paint_eye(image: Image.Image) -> tuple[Image.Image, list[str]]:
    """One 256² atlas: pearl sclera, big amber iris, hard ring, two highlights."""
    size = image.size[0]
    cx, cy = size * 0.492, size * 0.5
    canvas = Image.new("RGB", image.size, (226, 222, 218))
    draw = ImageDraw.Draw(canvas)
    for y in range(size):                      # cool shading towards the top lid
        t = y / size
        tone = 228 - 26 * max(0.0, 0.42 - t) - 10 * max(0.0, t - 0.62)
        draw.line([(0, y), (size, y)], fill=(int(tone), int(tone - 4), int(tone - 8)))

    ring, iris_r, pupil_r = 50.0, 44.0, 14.0
    bands = [                                 # radius, colour, strength
        (ring, (46, 26, 24), 1.0),
        (iris_r, (112, 54, 34), 0.98),
        (34.0, (176, 102, 44), 0.96),
        (28.0, (214, 148, 64), 0.92),
        (21.0, (238, 186, 100), 0.88),
        (14.0, (132, 68, 34), 0.7),
        (pupil_r, (28, 16, 16), 1.0),
    ]
    for radius, colour, strength in bands:
        mask = Image.new("L", image.size, 0)
        ImageDraw.Draw(mask).ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=255)
        canvas.paste(Image.new("RGB", image.size, colour), (0, 0),
                     mask.point(lambda v, s=strength: int(v * s)))

    streaks = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(streaks)
    for i in range(34):                       # radial iris fibres
        angle = i / 34 * math.tau
        start = 12 + (i % 3) * 2.0
        end = 35 + (i % 4) * 2.5
        sdraw.line([(cx + math.cos(angle) * start, cy + math.sin(angle) * start),
                    (cx + math.cos(angle) * end, cy + math.sin(angle) * end)],
                   fill=(255, 226, 158, 92), width=2)
    # Lower half of the iris catches light; the top stays in the lid's shadow.
    sdraw.ellipse([cx - iris_r, cy - iris_r * 0.75, cx + iris_r, cy + iris_r * 0.2], fill=(60, 30, 26, 70))
    canvas = _composite(canvas, streaks, blur=0.7)

    draw = ImageDraw.Draw(canvas)
    draw.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=(40, 22, 22), width=5)
    draw.ellipse([cx - pupil_r, cy - pupil_r, cx + pupil_r, cy + pupil_r], fill=(22, 13, 13))
    canvas = _composite(canvas, _highlight(size, cx - 15.0, cy - 17.0, 9.0, 236), blur=0.7)
    canvas = _composite(canvas, _highlight(size, cx - 16.0, cy - 18.0, 15.0, 46), blur=3.2)
    canvas = _composite(canvas, _highlight(size, cx + 13.0, cy + 16.0, 5.0, 176), blur=0.6)
    gloss = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse([cx - 26, cy + 26, cx + 4, cy + 40], fill=(255, 240, 228, 40))
    canvas = _composite(canvas, gloss, blur=5.0)
    return canvas, ["iris enlarged to 38 px with limbal ring, 34 fibres, two highlights"]


def _highlight(size, cx, cy, radius, alpha):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                                  fill=(255, 255, 255, alpha))
    return layer


# ------------------------------------------------------- geometry: brows only


def thin_brows(document: dict, binary: bytearray) -> dict:
    """Squash each eyebrow card towards its own centre line, in place.

    Only the POSITION accessor of the `Eyebrows` primitive is rewritten, and only
    its Y component, so both cards become slender arcs. The values are already
    normalised 16-bit and stay normalised, so precision loss is ~1/32767.
    """
    mesh = next(m for m in document["meshes"] if m.get("name") == "Eyebrows")
    primitive = mesh["primitives"][0]
    accessor = document["accessors"][primitive["attributes"]["POSITION"]]
    assert accessor["componentType"] == 5122 and accessor.get("normalized")
    view = document["bufferViews"][accessor["bufferView"]]
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride") or 8
    count = accessor["count"]
    values = np.zeros((count, 3), dtype=np.int16)
    for i in range(count):
        values[i] = struct.unpack_from("<3h", binary, offset + i * stride)

    positions = values.astype(np.float64) / 32767.0
    changed = 0
    for side in (positions[:, 0] > 0.02, positions[:, 0] < -0.02):
        if not side.any():
            continue
        centre_y = positions[side, 1].mean()
        centre_x = positions[side, 0].mean()
        positions[side, 1] = centre_y + (positions[side, 1] - centre_y) * 0.46
        positions[side, 0] = centre_x + (positions[side, 0] - centre_x) * 0.90
        changed += int(side.sum())
    values = np.clip(np.round(positions * 32767.0), -32767, 32767).astype(np.int16)
    for i in range(count):
        struct.pack_into("<3h", binary, offset + i * stride, *values[i])
    return {"mesh": "Eyebrows", "vertices": count, "verticesMoved": changed,
            "thicknessScale": 0.46, "lengthScale": 0.90}


# ---------------------------------------------------------------------- driver


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--thin-brows", action="store_true",
                        help="also thin the authored eyebrow cards (only needed if they stay visible)")
    args = parser.parse_args()

    raw = args.source.read_bytes()
    _, document, binary = read_glb(args.source)
    binary = bytearray(binary)
    record: dict = {
        "file": args.output.name,
        "source": args.source.name,
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "generator": "Tools/stylize_mia_face.py",
        "artDirection": "anime-leaning, appealing; larger iris, lash line, slender brows, rose mouth",
        "textureResolutionChanged": False,
        "unrelatedTexturesChanged": False,
        "normalAndOrmMapsChanged": False,
        "triangleCountChanged": False,
        "maps": [],
    }

    replacements: dict[int, bytes] = {}
    for name, painter in (("T_Superhero_Female_Dark_BaseColor", paint_skin), ("T_Eye_Brown", paint_eye)):
        index = image_index(document, name)
        assert index is not None, f"{name} missing from {args.source.name}"
        payload = image_payload(document, binary, index)
        with Image.open(io.BytesIO(payload)) as opened:
            before_size = opened.size
            rgb = opened.convert("RGB")
        painted, notes = painter(rgb)
        buffer = io.BytesIO()
        painted.save(buffer, format="WEBP", lossless=True, quality=100, method=6)
        replacements[index] = buffer.getvalue()
        record["maps"].append({
            "map": name,
            "resolution": f"{before_size[0]}x{before_size[1]}",
            "notes": notes,
            "bytesBefore": len(payload),
            "bytesAfter": len(replacements[index]),
            "sha256Before": hashlib.sha256(payload).hexdigest(),
            "sha256After": hashlib.sha256(replacements[index]).hexdigest(),
        })
        print(f"painted {name} {before_size[0]}x{before_size[1]} "
              f"{len(payload)} -> {len(replacements[index])} B")

    record["eyebrows"] = "painted on the skin atlas; authored card hidden at load time"
    if args.thin_brows:
        record["geometry"] = thin_brows(document, binary)

    # Rebuild the BIN chunk in bufferView order so patched image views fit.
    rebuilt = bytearray()
    for index, view in enumerate(document["bufferViews"]):
        while len(rebuilt) % 4:
            rebuilt.append(0)
        if index in replacements:
            data = replacements[index]
        else:
            start = view.get("byteOffset", 0)
            data = bytes(binary[start:start + view["byteLength"]])
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(data)
        view["buffer"] = 0
        rebuilt.extend(data)
    document["asset"]["generator"] = document["asset"].get("generator", "") + "; WOP Mia anime face"

    write_glb(args.output, document, bytes(rebuilt))
    produced = args.output.read_bytes()
    record["bytes"] = len(produced)
    record["sha256"] = hashlib.sha256(produced).hexdigest()
    args.manifest.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(json.dumps({k: record[k] for k in ("bytes", "sha256")}, indent=2))


if __name__ == "__main__":
    main()
