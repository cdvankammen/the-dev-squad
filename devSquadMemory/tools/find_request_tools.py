#!/usr/bin/env python3
"""
Locate Copilot debug-log folders containing a request id and list nearby tools payload files.

Usage:
  python3 devSquadMemory/tools/find_request_tools.py <request-id>
"""

from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

BASE = Path.home() / "Library" / "Application Support" / "Code - Insiders" / "User" / "workspaceStorage"


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 devSquadMemory/tools/find_request_tools.py <request-id>")
        return 1

    req = sys.argv[1].strip()
    if not req:
        print("Empty request id")
        return 1

    pattern = str(BASE / "*" / "GitHub.copilot-chat" / "debug-logs" / "*" / "main.jsonl")
    matches = []
    for f in glob.glob(pattern):
        p = Path(f)
        txt = read_text(p)
        if req in txt:
            matches.append(p)

    if not matches:
        print(f"No main.jsonl files found containing request id: {req}")
        return 1

    for m in matches:
        folder = m.parent
        print(f"\n=== {folder} ===")
        print(f"main.jsonl: {m}")
        tools_files = sorted(folder.glob("tools_*.json"), key=lambda x: x.stat().st_mtime)
        if not tools_files:
            print("  (no tools_*.json files)")
            continue
        for t in tools_files:
            print(f"  {t.name}\tmtime={t.stat().st_mtime}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
