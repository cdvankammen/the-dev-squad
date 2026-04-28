#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
OpenAI HTTP remediation helper (non-destructive)
================================================

1) Verify your saved endpoint config
   cat provider-config.json

2) Or set env vars explicitly before starting the app
   export OPENAI_BASE_URL=http://host:port/v1
   export OPENAI_API_KEY=your-key

3) Verify models endpoint
   curl -sS "$OPENAI_BASE_URL/models"

4) Re-run diagnostics
   ./scripts/diagnose-providers.sh
   ./scripts/test-models.mjs openai-http

Notes:
- This adapter now reads provider-config.json as well as OPENAI_BASE_URL / OPENAI_API_KEY.
EOF
