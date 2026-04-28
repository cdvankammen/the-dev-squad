#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
OpenAI-compatible remediation helper (non-destructive)
=====================================================

1) Save the endpoint in the UI Endpoint Config, or export:
   export OPENAI_COMPAT_BASE_URL=http://host:port
   export OPENAI_COMPAT_API_KEY=optional-key

2) Verify model listing
   curl -sS "$OPENAI_COMPAT_BASE_URL/v1/models"

3) Re-run diagnostics
   ./scripts/diagnose-providers.sh
   ./scripts/test-models.mjs openai-compat

Notes:
- This provider is intended for vLLM, LocalAI, Aphrodite, text-generation-webui, and other OpenAI-compatible backends.
EOF
