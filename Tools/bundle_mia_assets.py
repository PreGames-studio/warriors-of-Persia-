#!/usr/bin/env python3
"""Re-embed the Mia GLBs that sit in the asset folder into `mia-assets.js`.

The game loads Mia from one base64 module, so any art pass that rewrites one of
the four GLBs has to refresh the module. `prepare_mia_hq_assets.py` does that at
the same time as it builds the files from the CC0 source packs; this script is
the "files are already here, just re-embed them" step, and it keeps
`asset-manifest.json` in sync (size, SHA-256, embedded module size).

    python3 Tools/bundle_mia_assets.py
    python3 Tools/bundle_mia_assets.py --check     # verify only, write nothing
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path

ASSETS = Path("unity_preview/assets/hero/mia")
FILES = [
    ("mia_base.glb", "MIA_BASE_GLB_BASE64"),
    ("mia_locomotion.glb", "MIA_LOCOMOTION_GLB_BASE64"),
    ("mia_actions.glb", "MIA_ACTIONS_GLB_BASE64"),
    ("mia_combat.glb", "MIA_COMBAT_GLB_BASE64"),
]
HEADER = "// Generated from the CC0 source GLBs beside this module; see SOURCE.md.\n"


def render_module() -> str:
    module = [HEADER]
    for name, constant in FILES:
        payload = (ASSETS / name).read_bytes()
        module.append(f"export const {constant} = '{base64.b64encode(payload).decode('ascii')}';\n")
    return "".join(module)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="report drift without writing")
    args = parser.parse_args()

    module = render_module()
    target = ASSETS / "mia-assets.js"
    current = target.read_text("utf-8") if target.exists() else ""
    drifted = current != module
    print(json.dumps({
        "module": str(target),
        "bytesOnDisk": len(current.encode("utf-8")),
        "bytesRebuilt": len(module.encode("utf-8")),
        "drifted": drifted,
    }, indent=2))
    if args.check or not drifted:
        return

    target.write_text(module, "utf-8")

    manifest_path = ASSETS / "asset-manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8"))
    by_file = {record["file"]: record for record in manifest.get("files", [])}
    for name, _ in FILES:
        path = ASSETS / name
        raw = path.read_bytes()
        record = by_file.get(name)
        if record is None:
            continue
        record["bytes"] = len(raw)
        record["sha256"] = hashlib.sha256(raw).hexdigest()
    manifest["generatedModule"] = {"file": target.name, "bytes": target.stat().st_size}
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(json.dumps({"generatedModule": manifest["generatedModule"]}, indent=2))


if __name__ == "__main__":
    main()
