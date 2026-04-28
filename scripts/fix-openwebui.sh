#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
Open WebUI remediation helper (non-destructive)
===============================================

1) Save the host/API key in the UI Endpoint Config, or export:
   export OPENWEBUI_BASE_URL=http://host:port
   export OPENWEBUI_API_KEY=your-key

2) Verify model listing
   curl -sS "$OPENWEBUI_BASE_URL/api/models"

3) Re-run diagnostics
   ./scripts/diagnose-providers.sh
   ./scripts/test-models.mjs openwebui

Notes:
- This repo treats Open WebUI as an OpenAI-compatible HTTP backend and runs it through the HTTP shim.
EOF
