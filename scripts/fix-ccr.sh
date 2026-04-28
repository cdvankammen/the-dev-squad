#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--diagnose" ]]; then
  "$(dirname "$0")/diag-ccr.sh"
fi

cat <<'EOF'
CCR remediation helper (non-destructive)
=======================================

1) Verify the CLI exists
   which ccr
   ccr code --help

2) Verify router config exists and contains your local-model mappings
   cat ~/.claude-code-router/config.json

3) For local non-Anthropic model names (for example llama/qwen/deepseek IDs),
   make sure they appear in Providers[*].models and point at a real api_base_url.

4) After editing config, restart CCR before retrying.

5) Re-run diagnostics:
   ./scripts/diag-ccr.sh
   ./scripts/test-models.mjs ccr

Notes:
- This repo will bypass CCR and use the HTTP shim when CCR would reject a non-Anthropic model name.
- If the model is not present in CCR config, the bypass still has nothing to route to.
EOF
