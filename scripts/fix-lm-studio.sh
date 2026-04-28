#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--diagnose" ]]; then
  "$(dirname "$0")/diag-lm-studio.sh"
fi

cat <<'EOF'
LM Studio remediation helper (non-destructive)
==============================================

1) Start the local server from LM Studio's Developer tab, or use the CLI if installed
   lms server start

2) Verify the model list endpoints
   curl -sS http://localhost:1234/api/v1/models
   curl -sS http://localhost:1234/v1/models

3) If LM Studio runs remotely, save that host/port in the UI Endpoint Config
   or export LM_STUDIO_BASE_URL before starting the app.

4) Re-run diagnostics
   ./scripts/diag-lm-studio.sh
   ./scripts/test-models.mjs lm-studio

Notes:
- This repo discovers via /api/v1/models or /v1/models and executes via /v1/chat/completions through the HTTP shim.
EOF
