#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--diagnose" ]]; then
  "$(dirname "$0")/diag-ollama.sh"
fi

cat <<'EOF'
Ollama remediation helper (non-destructive)
===========================================

1) Verify the CLI / daemon
   which ollama || true
   ollama list

2) If the daemon is not running, start it
   ollama serve

3) Verify HTTP endpoints
   curl -sS http://localhost:11434/api/tags
   curl -sS http://localhost:11434/v1/models

4) If needed, pull the model you expect to use
   ollama pull <model>

5) If Ollama runs on another host, save that host/port in the UI Endpoint Config
   or export OLLAMA_BASE_URL before starting the app.

6) Re-run diagnostics
   ./scripts/diag-ollama.sh
   ./scripts/test-models.mjs ollama
EOF
