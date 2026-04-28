#!/usr/bin/env bash
set -euo pipefail
echo "=== Ollama diagnostic ==="
if command -v ollama >/dev/null 2>&1; then
  echo "ollama CLI: found at $(command -v ollama)"
  echo "ollama list:"; ollama list || true
else
  echo "ollama CLI: NOT FOUND"
fi

echo "Probe HTTP endpoint http://localhost:11434/api/tags"
curl -sS http://localhost:11434/api/tags || echo "No response from http://localhost:11434"

echo "If Ollama is not running, start it or set OLLAMA_BASE_URL to your host."
