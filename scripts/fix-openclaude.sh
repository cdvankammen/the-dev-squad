#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--diagnose" ]]; then
  "$(dirname "$0")/diag-openclaude.sh"
fi

cat <<'EOF'
OpenClaude remediation helper (non-destructive)
===============================================

1) Verify the binary or npx fallback
   which openclaude || true
   npx @gitlawb/openclaude --help

2) If you want a global install, use the method you normally prefer.
   One common option:
   npm install -g @gitlawb/openclaude

3) Check config if present
   cat ~/.openclaude/config.json
   cat ~/.config/openclaude/config.json

4) Re-run diagnostics
   ./scripts/diag-openclaude.sh
   ./scripts/test-models.mjs openclaude

Notes:
- OpenClaude is a CLI/runtime, not the local model server itself.
- In this repo it is spawned directly as an agent runner.
EOF
