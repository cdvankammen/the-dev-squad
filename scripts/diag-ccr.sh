#!/usr/bin/env bash
set -euo pipefail
echo "=== Claude Code Router (CCR) diagnostic ==="
if command -v ccr >/dev/null 2>&1; then
  echo "ccr CLI: found at $(command -v ccr)"
  echo "ccr model list (try --json if available):"
  ccr model list --json 2>/dev/null || ccr model list 2>/dev/null || echo "ccr CLI present but did not return models"
else
  echo "ccr CLI: NOT FOUND"
fi

CFG="$HOME/.claude-code-router/config.json"
if [ -f "$CFG" ]; then
  echo "Found CCR config at $CFG"
  jq . $CFG || cat $CFG
else
  echo "CCR config not found at $CFG"
fi

echo "If CCR is missing model mappings for your local models, add Provider entries mapping model names to api_base_url in $CFG"
