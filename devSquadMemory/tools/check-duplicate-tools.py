#!/usr/bin/env python3
"""
Copy of scripts/check-duplicate-tools.py saved under devSquadMemory/tools for local use.
"""

# Original script follows

#!/usr/bin/env python3
"""
scripts/check-duplicate-tools.py
Lightweight checker for duplicate tool names declared in repository manifests and Copilot runtime snapshots.
Exits 0 when no duplicates found, 2 when duplicates exist, 1 for other errors.

Usage:
  python3 scripts/check-duplicate-tools.py

It scans:
 - YAML files (manifest.yaml / *.yml / *.yaml) for a `tools:` list with `- item` entries
 - JSON files that contain a top-level `tools` array (and `name` keys)
 - Copilot debug `tools_*.json` files under the standard Code Insiders workspaceStorage path (local only)

This script intentionally avoids external dependencies (no PyYAML required) and uses simple heuristics to detect list items under `tools:`.
"""

import os
import sys
import glob
import json
import re
from collections import defaultdict

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

names_locations = defaultdict(list)

def record(name, path):
    if not name:
        return
    names_locations[name].append(path)

# Heuristic: parse YAML-like lists under a 'tools:' key
def scan_yaml_like_file(p):
    try:
        with open(p, 'r', encoding='utf8') as f:
            lines = f.readlines()
    except Exception:
        return
    for i, line in enumerate(lines):
        if re.match(r'^\s*tools\s*:\s*$', line):
            # gather subsequent '- item' lines
            for j in range(i+1, min(len(lines), i+500)):
                m = re.match(r'^\s*-\s*(.+)$', lines[j])
                if m:
                    raw = m.group(1).strip()
                    raw = re.sub(r"\s*#.*$", "", raw).strip()
                    raw = raw.strip('"\'')
                    record(raw, f"{p}:{j+1}")
                else:
                    # skip blank lines
                    if re.match(r'^\s*$', lines[j]):
                        continue
                    # break on next top-level key or content that isn't a list item
                    if re.match(r'^\s*[^\s-]', lines[j]):
                        break

# 1) scan YAML/manifest files in workspace (skip heavy folders)
for pattern in [
    os.path.join(workspace_root, 'skills_local', '**', '*.yaml'),
    os.path.join(workspace_root, 'skills_local', '**', '*.yml'),
    os.path.join(workspace_root, '**', 'manifest.yaml'),
    os.path.join(workspace_root, '**', '*.yaml'),
    os.path.join(workspace_root, '**', '*.yml'),
]:
    for p in glob.glob(pattern, recursive=True):
        if any(x in p for x in ('node_modules', '.venv', '.git')):
            continue
        scan_yaml_like_file(p)

# 2) scan JSON files in repo that contain a top-level 'tools' array
for p in glob.glob(os.path.join(workspace_root, '**', '*.json'), recursive=True):
    if any(x in p for x in ('node_modules', '.venv', '.git')):
        continue
    try:
        with open(p, 'r', encoding='utf8') as f:
            text = f.read()
    except Exception:
        continue
    if '"tools"' not in text:
        continue
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and 'tools' in obj and isinstance(obj['tools'], list):
            for t in obj['tools']:
                if isinstance(t, dict) and 'name' in t:
                    record(t['name'], p)
                elif isinstance(t, str):
                    record(t, p)
    except Exception:
        # best-effort regex capture for name fields
        for m in re.finditer(r'"name"\s*:\s*"([^\"]+)"', text):
            record(m.group(1), p)

# 3) scan Copilot debug tools_*.json snapshots in standard Code - Insiders workspaceStorage (local only)
home = os.path.expanduser('~')
copilot_debug_base = os.path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User', 'workspaceStorage')
for candidate in glob.glob(os.path.join(copilot_debug_base, '*', 'GitHub.copilot-chat', 'debug-logs', '*')):
    for j in glob.glob(os.path.join(candidate, 'tools_*.json')):
        try:
            with open(j, 'r', encoding='utf8') as f:
                d = json.load(f)
        except Exception:
            continue
        content = d.get('content', '[]')
        try:
            arr = json.loads(content)
        except Exception:
            arr = []
        for item in arr:
            if isinstance(item, dict) and 'name' in item:
                record(item['name'], j)

# Summarize
if not names_locations:
    print('No tool-like names discovered in workspace manifests or JSON snapshots.')
    sys.exit(0)

unique_count = len(names_locations)
dups = {n: locs for n, locs in names_locations.items() if len(locs) > 1}

print(f'Found {unique_count} unique tool-like names; {len(dups)} duplicates.')
if dups:
    print('\nDuplicates:')
    for name, locs in sorted(dups.items(), key=lambda kv: -len(kv[1])):
        print(f'- {name} ({len(locs)} occurrences)')
        for p in locs:
            print(f'    {p}')
    sys.exit(2)
else:
    print('No duplicates found.')
    sys.exit(0)
