#!/usr/bin/env python3
"""
devSquadMemory/tools/dedupe_tools.py
Scan workspace manifests and local Copilot debug snapshots, merge tool entries and deduplicate by name.
Writes:
  devSquadMemory/diagnostics/merged_tools_deduped.json
  devSquadMemory/diagnostics/merged_summary.txt

No external deps required.
"""

import os
import sys
import glob
import json
import re
from collections import OrderedDict, defaultdict

# Determine workspace root (script lives in devSquadMemory/tools)
HERE = os.path.abspath(os.path.dirname(__file__))
workspace_root = os.path.abspath(os.path.join(HERE, '..', '..'))

out_dir = os.path.join(workspace_root, 'devSquadMemory', 'diagnostics')
os.makedirs(out_dir, exist_ok=True)
merged_json_path = os.path.join(out_dir, 'merged_tools_deduped.json')
summary_path = os.path.join(out_dir, 'merged_summary.txt')

collected = []

# Helper to add a tool dict from any source
def add_tool(tool_obj, source):
    name = None
    if isinstance(tool_obj, dict):
        name = tool_obj.get('name') or tool_obj.get('id')
        obj = dict(tool_obj)
    else:
        name = str(tool_obj)
        obj = {'name': name}
    if not name:
        return
    name = str(name)
    obj.setdefault('_sources', [])
    obj['_sources'].append(source)
    collected.append(obj)

# 1) Scan YAML-like manifests heuristically (no PyYAML)
def scan_yaml_like_files():
    patterns = [
        os.path.join(workspace_root, 'skills_local', '**', '*.yaml'),
        os.path.join(workspace_root, 'skills_local', '**', '*.yml'),
        os.path.join(workspace_root, '**', 'manifest.yaml'),
        os.path.join(workspace_root, '**', '*.yaml'),
        os.path.join(workspace_root, '**', '*.yml'),
    ]
    for pat in patterns:
        for p in glob.glob(pat, recursive=True):
            if any(x in p for x in ('node_modules', '.venv', '.git')):
                continue
            try:
                with open(p, 'r', encoding='utf8') as f:
                    lines = f.readlines()
            except Exception:
                continue
            for i, line in enumerate(lines):
                if re.match(r'^\s*tools\s*:\s*$', line):
                    for j in range(i+1, min(len(lines), i+500)):
                        m = re.match(r'^\s*-\s*(.+)$', lines[j])
                        if m:
                            raw = m.group(1).strip()
                            raw = re.sub(r"\s*#.*$", "", raw).strip()
                            raw = raw.strip('"\'')
                            if raw:
                                add_tool({'name': raw, 'from_manifest': os.path.relpath(p, workspace_root)}, f'{p}:{j+1}')
                        else:
                            if re.match(r'^\s*$', lines[j]):
                                continue
                            if re.match(r'^\s*[A-Za-z0-9_-]+\s*:', lines[j]):
                                break

# 2) scan JSON files in repo that contain a top-level 'tools' array
def scan_repo_json_files():
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
                        add_tool(t, p)
                    elif isinstance(t, str):
                        add_tool({'name': t}, p)
        except Exception:
            for m in re.finditer(r'"name"\s*:\s*"([^\"]+)"', text):
                add_tool({'name': m.group(1)}, p)

# 3) scan Copilot debug tools_*.json snapshots (Code - Insiders path)
def scan_copilot_debug_snapshots():
    home = os.path.expanduser('~')
    base = os.path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User', 'workspaceStorage')
    glob_pat = os.path.join(base, '*', 'GitHub.copilot-chat', 'debug-logs', '*', 'tools_*.json')
    for p in glob.glob(glob_pat):
        try:
            with open(p, 'r', encoding='utf8') as f:
                obj = json.load(f)
        except Exception:
            continue
        entries = []
        if isinstance(obj, list):
            entries = obj
        elif isinstance(obj, dict):
            entries = [obj]
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            content = entry.get('content') or entry.get('tools')
            if not content:
                continue
            tools_arr = None
            if isinstance(content, str):
                try:
                    tools_arr = json.loads(content)
                except Exception:
                    tools_arr = None
            elif isinstance(content, list):
                tools_arr = content
            if isinstance(tools_arr, list):
                for t in tools_arr:
                    if isinstance(t, dict) and 'name' in t:
                        t_copy = dict(t)
                        t_copy['_copilot_snapshot'] = os.path.relpath(p, workspace_root)
                        add_tool(t_copy, p)
                    elif isinstance(t, str):
                        add_tool({'name': t, '_copilot_snapshot': os.path.relpath(p, workspace_root)}, p)

# Run scans
scan_yaml_like_files()
scan_repo_json_files()
scan_copilot_debug_snapshots()

# Deduplicate preserving first-seen order (stable)
by_name = OrderedDict()
name_sources = defaultdict(list)
for t in collected:
    nm = t.get('name')
    if not nm:
        continue
    if nm not in by_name:
        by_name[nm] = t
    else:
        existing = by_name[nm]
        existing.setdefault('_sources', [])
        existing['_sources'].extend(t.get('_sources', []))
    name_sources[nm].extend(t.get('_sources', []))

merged_list = list(by_name.values())
unique_count = len(merged_list)
raw_count = len(collected)
duplicate_names = [n for n, srcs in name_sources.items() if len(set(srcs)) > 1]

summary_lines = []
summary_lines.append(f'Total tool-like entries collected: {raw_count}')
summary_lines.append(f'Unique tool names after dedupe: {unique_count}')
summary_lines.append(f'Names with multiple sources: {len(duplicate_names)}')
if duplicate_names:
    summary_lines.append('\nDuplicates (name -> sample sources):')
    for n in sorted(duplicate_names):
        sample = list(dict.fromkeys(name_sources[n]))[:6]
        summary_lines.append(f'- {n} -> {sample}')

# Write files
try:
    with open(merged_json_path, 'w', encoding='utf8') as f:
        json.dump(merged_list, f, indent=2)
    with open(summary_path, 'w', encoding='utf8') as f:
        f.write('\n'.join(summary_lines))
except Exception as e:
    print('Failed to write outputs:', e, file=sys.stderr)
    sys.exit(1)

# Print short summary
print('\n'.join(summary_lines))
print('\nWrote:')
print(' -', os.path.relpath(merged_json_path, workspace_root))
print(' -', os.path.relpath(summary_path, workspace_root))

sys.exit(0)
