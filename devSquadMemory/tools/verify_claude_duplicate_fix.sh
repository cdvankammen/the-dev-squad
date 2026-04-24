#!/usr/bin/env bash
set -euo pipefail

REQ_ID="${1:-}"
if [[ -z "$REQ_ID" ]]; then
  echo "Usage: bash devSquadMemory/tools/verify_claude_duplicate_fix.sh <copilot-request-id>"
  exit 1
fi

ROOT="$HOME/Library/Application Support/Code - Insiders/User/workspaceStorage"

python3 - "$REQ_ID" "$ROOT" <<'PY'
import glob, json, os, sys
from pathlib import Path
from collections import Counter

req = sys.argv[1]
root = Path(sys.argv[2])

main_files = glob.glob(str(root / '*' / 'GitHub.copilot-chat' / 'debug-logs' / '*' / 'main.jsonl'))
matches = []
for mf in main_files:
    try:
        txt = Path(mf).read_text(encoding='utf-8', errors='ignore')
    except Exception:
        continue
    if req in txt:
        matches.append(Path(mf))

if not matches:
    print(f'No main.jsonl containing request id: {req}')
    sys.exit(1)

# choose most recently modified matching folder
matches.sort(key=lambda p: p.stat().st_mtime, reverse=True)
chosen = matches[0].parent
tools_files = sorted(chosen.glob('tools_*.json'), key=lambda p: p.stat().st_mtime, reverse=True)
if not tools_files:
    print(f'No tools_*.json in {chosen}')
    sys.exit(1)

latest = tools_files[0]
raw = json.loads(latest.read_text(encoding='utf-8'))
content = raw.get('content', '[]')
if isinstance(content, str):
    tools = json.loads(content)
else:
    tools = content if isinstance(content, list) else []

names = []
for t in tools:
    if isinstance(t, dict):
        n = t.get('name') or (t.get('function') or {}).get('name')
        if n:
            names.append(n)

counts = Counter(names)
dups = {k:v for k,v in counts.items() if v > 1}

print(f'Request id: {req}')
print(f'Folder: {chosen}')
print(f'Payload: {latest}')
print(f'Total tools: {len(tools)}')
print(f'Unique names: {len(counts)}')
print(f'Duplicate names: {len(dups)}')
if dups:
    print('Duplicates:')
    for k, v in sorted(dups.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f'- {k}: {v}')
    sys.exit(2)

print('OK: no duplicate tool names in latest payload for this request id.')
sys.exit(0)
PY
