#!/usr/bin/env python3
"""Convert the downloaded CC0 Poly Haven glTF props to Unity-friendly OBJ assets.

The source pack is deliberately kept outside the repository. This script reads its
indexed, non-embedded glTF files, applies node transforms, converts glTF's
right-handed coordinates to Unity's left-handed coordinates, and repacks ARM
(AO/roughness/metallic) into Unity Standard's metallic/smoothness + AO maps.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODEL_OUT = ROOT / "Assets" / "Resources" / "BlacksmithExterior" / "Models"
TEXTURE_OUT = ROOT / "Assets" / "Resources" / "BlacksmithExterior" / "Textures" / "Imported"
COMPONENTS = {
    5120: (np.int8, 1), 5121: (np.uint8, 1), 5122: (np.int16, 2),
    5123: (np.uint16, 2), 5125: (np.uint32, 4), 5126: (np.float32, 4),
}
COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def accessor(doc, binary, index):
    spec = doc["accessors"][index]
    view = doc["bufferViews"][spec["bufferView"]]
    dtype, component_size = COMPONENTS[spec["componentType"]]
    count = COUNTS[spec["type"]]
    start = view.get("byteOffset", 0) + spec.get("byteOffset", 0)
    stride = view.get("byteStride", component_size * count)
    raw = np.frombuffer(binary, dtype=dtype, count=spec["count"] * count,
                        offset=start)
    if stride != component_size * count:
        # Interleaved data is uncommon in this pack, but handle it correctly.
        rows = []
        for row in range(spec["count"]):
            rows.append(np.frombuffer(binary, dtype=dtype, count=count,
                                      offset=start + row * stride))
        raw = np.concatenate(rows)
    values = raw.reshape((spec["count"], count)).astype(np.float32, copy=False)
    if spec["componentType"] != 5126:
        # Indices must remain integral; normalized integer attributes are not
        # used by the selected assets.
        if spec["type"] == "SCALAR":
            return raw.astype(np.int64, copy=False)
    return values


def node_matrix(node):
    if "matrix" in node:
        return np.asarray(node["matrix"], dtype=np.float32).reshape((4, 4)).T
    matrix = np.eye(4, dtype=np.float32)
    scale = node.get("scale", [1.0, 1.0, 1.0])
    rotation = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    x, y, z, w = rotation
    rot = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ], dtype=np.float32)
    matrix[:3, :3] = rot @ np.diag(scale)
    matrix[:3, 3] = node.get("translation", [0.0, 0.0, 0.0])
    return matrix


def image_for_texture(doc, texture_index):
    texture = doc["textures"][texture_index]
    return doc["images"][texture["source"]]


def export_material(doc, material, source_dir, used_keys):
    key = "".join(c if c.isalnum() or c in "_-" else "_" for c in material.get("name", "material"))
    pbr = material.get("pbrMetallicRoughness", {})
    paths = {}
    for kind, texture_info in (("normal", material.get("normalTexture")),
                               ("albedo", pbr.get("baseColorTexture")),
                               ("arm", pbr.get("metallicRoughnessTexture"))):
        if not texture_info:
            continue
        image = image_for_texture(doc, texture_info["index"])
        source = source_dir / image["uri"]
        if kind == "albedo":
            target = TEXTURE_OUT / f"{key}_albedo.jpg"
            Image.open(source).convert("RGB").save(target, quality=95, optimize=True)
            paths[kind] = target
        elif kind == "normal":
            target = TEXTURE_OUT / f"{key}_normal.jpg"
            Image.open(source).convert("RGB").save(target, quality=95, optimize=True)
            paths[kind] = target
        else:
            arm = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32) / 255.0
            # glTF ARM: R=AO, G=roughness, B=metallic.
            ao = Image.fromarray(np.uint8(np.clip(arm[..., 0], 0, 1) * 255), "L")
            ao.save(TEXTURE_OUT / f"{key}_ao.png", optimize=True)
            metallic = arm[..., 2]
            smoothness = 1.0 - arm[..., 1]
            packed = np.dstack((metallic, metallic, metallic, smoothness))
            target = TEXTURE_OUT / f"{key}_metallic_smoothness.png"
            Image.fromarray(np.uint8(np.clip(packed, 0, 1) * 255), "RGBA").save(target, optimize=True)
            paths[kind] = target
    used_keys.add(key)
    return key


def convert(source_dir: Path):
    gltf_path = next(source_dir.glob("*.gltf"))
    doc = json.loads(gltf_path.read_text())
    binary = (source_dir / doc["buffers"][0]["uri"]).read_bytes()
    MODEL_OUT.mkdir(parents=True, exist_ok=True)
    TEXTURE_OUT.mkdir(parents=True, exist_ok=True)
    material_keys = {}
    used_keys = set()
    for index, material in enumerate(doc.get("materials", [])):
        material_keys[index] = export_material(doc, material, source_dir, used_keys)

    lines = ["# CC0 Poly Haven prop; converted for Warriors of Persia", f"mtllib {source_dir.name}.mtl"]
    mtl = []
    vertex_offset = 1
    uv_offset = 1
    normal_offset = 1
    all_positions = []
    triangle_count = 0

    def walk(node_index, parent_matrix):
        nonlocal vertex_offset, uv_offset, normal_offset, triangle_count
        node = doc["nodes"][node_index]
        matrix = parent_matrix @ node_matrix(node)
        if "mesh" in node:
            mesh = doc["meshes"][node["mesh"]]
            for primitive_index, primitive in enumerate(mesh["primitives"]):
                if primitive.get("mode", 4) != 4:
                    raise ValueError(f"Only triangle primitives are supported: {source_dir.name}")
                positions = accessor(doc, binary, primitive["attributes"]["POSITION"])
                normals = accessor(doc, binary, primitive["attributes"]["NORMAL"])
                uvs = accessor(doc, binary, primitive["attributes"]["TEXCOORD_0"])
                indices = accessor(doc, binary, primitive["indices"]).reshape(-1)
                homogeneous = np.concatenate((positions, np.ones((len(positions), 1), dtype=np.float32)), axis=1)
                transformed = (matrix @ homogeneous.T).T[:, :3]
                normal_matrix = np.linalg.inv(matrix[:3, :3]).T
                transformed_normals = (normal_matrix @ normals.T).T
                transformed_normals /= np.maximum(np.linalg.norm(transformed_normals, axis=1, keepdims=True), 1e-8)
                # Reflect Z and reverse triangle winding for Unity's left-handed space.
                transformed[:, 2] *= -1
                transformed_normals[:, 2] *= -1
                all_positions.append(transformed)
                lines.append(f"o {source_dir.name}_{node.get('name', 'mesh')}_{primitive_index}")
                lines.extend(f"v {x:.8f} {y:.8f} {z:.8f}" for x, y, z in transformed)
                lines.extend(f"vt {u:.8f} {v:.8f}" for u, v in uvs)
                lines.extend(f"vn {x:.8f} {y:.8f} {z:.8f}" for x, y, z in transformed_normals)
                lines.append(f"usemtl {material_keys.get(primitive.get('material', 0), source_dir.name)}")
                for start in range(0, len(indices), 3):
                    a, b, c = (int(v) for v in indices[start:start + 3])
                    # OBJ indices are one-based and each attribute has its own offset.
                    face = []
                    for v in (a, c, b):
                        face.append(f"{vertex_offset + v}/{uv_offset + v}/{normal_offset + v}")
                    lines.append("f " + " ".join(face))
                    triangle_count += 1
                vertex_offset += len(positions)
                uv_offset += len(uvs)
                normal_offset += len(normals)
        for child in node.get("children", []):
            walk(child, matrix)

    scene = doc["scenes"][doc.get("scene", 0)]
    for node_index in scene["nodes"]:
        walk(node_index, np.eye(4, dtype=np.float32))

    for key in sorted(used_keys):
        mtl.extend([
            f"newmtl {key}", "Kd 1.0 1.0 1.0", "Ka 0.0 0.0 0.0",
            "Ks 0.35 0.35 0.35", "Ns 64", "illum 2",
            f"map_Kd ../Textures/Imported/{key}_albedo.jpg",
            f"map_Bump ../Textures/Imported/{key}_normal.jpg", "",
        ])
    (MODEL_OUT / f"{source_dir.name}.obj").write_text("\n".join(lines) + "\n")
    (MODEL_OUT / f"{source_dir.name}.mtl").write_text("\n".join(mtl))
    bounds = np.concatenate(all_positions, axis=0)
    metadata = {
        "source": f"https://polyhaven.com/a/{source_dir.name}",
        "license": "CC0-1.0",
        "sourcePack": "https://github.com/Eruldin/Gambling-with-the-devil/tree/asset-scan/env-table/assets_external/env-table/polyhaven/" + source_dir.name,
        "triangles": triangle_count,
        "boundsMin": bounds.min(axis=0).tolist(),
        "boundsMax": bounds.max(axis=0).tolist(),
        "materials": sorted(used_keys),
        "coordinateConversion": "glTF (x,y,z) -> Unity (x,y,-z), reversed winding",
    }
    (MODEL_OUT / f"{source_dir.name}.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"{source_dir.name}: {triangle_count:,} triangles; {len(used_keys)} PBR material(s)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Directory containing the downloaded Poly Haven asset directories")
    parser.add_argument("names", nargs="+", help="Asset directory names to convert")
    args = parser.parse_args()
    for name in args.names:
        convert(args.source / name)


if __name__ == "__main__":
    main()
