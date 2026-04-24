#!/usr/bin/env python3
"""
Check duplicate tool names inside a single Copilot tools payload file.

Usage:
  python3 devSquadMemory/tools/check_payload_duplicates.py /path/to/tools_6.json

Exit codes:
  0 = no duplicates
  2 = duplicates found
  1 = invalid input or parse error
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path


def load_tools(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    content = raw.get("content", "[]")
    if isinstance(content, str):
        tools = json.loads(content)
    elif isinstance(content, list):
        tools = content
    else:
        tools = []
    return tools


def get_name(tool: dict) -> str | None:
    if not isinstance(tool, dict):
        return None
    return tool.get("name") or (tool.get("function") or {}).get("name")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 devSquadMemory/tools/check_payload_duplicates.py /path/to/tools_*.json")
        return 1

    p = Path(sys.argv[1]).expanduser()
    if not p.exists():
        print(f"File not found: {p}")
        return 1

    try:
        tools = load_tools(p)
    except Exception as exc:
        print(f"Failed to parse {p}: {exc}")
        return 1

    names = [n for n in (get_name(t) for t in tools) if n]
    counts = Counter(names)
    dups = {k: v for k, v in counts.items() if v > 1}

    print(f"File: {p}")
    print(f"Total tools: {len(tools)}")
    print(f"Unique names: {len(counts)}")
    print(f"Duplicate names: {len(dups)}")

    if dups:
        print("Duplicates:")
        for name, cnt in sorted(dups.items(), key=lambda kv: (-kv[1], kv[0])):
            print(f"- {name}: {cnt}")
        return 2

    print("No duplicates in this payload.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
