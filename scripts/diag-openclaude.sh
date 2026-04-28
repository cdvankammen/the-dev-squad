#!/usr/bin/env bash
set -euo pipefail
echo "=== openclaude / occ diagnostic ==="
if command -v openclaude >/dev/null 2>&1; then
  echo "openclaude CLI: found at $(command -v openclaude)"
  openclaude --help 2>/dev/null || true
else
  echo "openclaude CLI: NOT FOUND"
fi

if command -v occ >/dev/null 2>&1; then
  echo "occ CLI: found at $(command -v occ)"
  occ --help 2>/dev/null || true
else
  echo "occ CLI: NOT FOUND"
fi

echo "Check ~/.openclaude/config.json if present."
if [ -f "$HOME/.openclaude/config.json" ]; then
  jq . "$HOME/.openclaude/config.json" || cat "$HOME/.openclaude/config.json"
fi
