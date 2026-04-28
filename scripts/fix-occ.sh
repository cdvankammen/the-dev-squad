#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--diagnose" ]]; then
  "$(dirname "$0")/diag-openclaude.sh"
fi

cat <<'EOF'
occ remediation helper (non-destructive)
========================================

1) Verify the binary or npx fallback
   which occ || true
   npx @ruvnet/open-claude-code --help

2) If you want a global install, one common option is:
   npm install -g @ruvnet/open-claude-code

3) Verify provider credentials/environment if using Bedrock or another remote backend
   env | grep -E 'OCC_MODEL|AWS_|ANTHROPIC_BEDROCK_MODEL' || true

4) Re-run diagnostics
   ./scripts/diag-openclaude.sh
   ./scripts/test-models.mjs occ

Notes:
- occ is a CLI/runtime, not an HTTP model server.
- Discovery is mostly config/env driven rather than a clean list-models API.
EOF
