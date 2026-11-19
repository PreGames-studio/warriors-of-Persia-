#!/usr/bin/env python3
"""Print the JSON payloads the release workflow sends to the GitHub REST API.

Keeping the payload construction in a script (instead of an indented heredoc in
YAML) makes the workflow readable and testable:

    python3 Tools/release_payload.py create --tag v1.0.13 > create.json
    python3 Tools/release_payload.py publish > publish.json
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("create", "publish"))
    parser.add_argument("--tag", default=os.environ.get("TAG", ""))
    parser.add_argument("--title-file", type=Path, required=True)
    parser.add_argument("--notes-file", type=Path, required=True)
    parser.add_argument("--target", default=os.environ.get("GITHUB_SHA", ""))
    args = parser.parse_args()

    payload = {
        "name": read(args.title_file),
        "body": read(args.notes_file),
    }
    if args.mode == "create":
        payload.update({"tag_name": args.tag, "target_commitish": args.target, "draft": True})
    else:
        payload.update({"draft": False, "make_latest": True})
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
