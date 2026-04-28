#!/usr/bin/env bash
set -euo pipefail
echo "Running provider diagnostics..."
./scripts/diag-ccr.sh || true
./scripts/diag-lm-studio.sh || true
./scripts/diag-ollama.sh || true
./scripts/diag-openclaude.sh || true

echo "Done. Review output above for each provider's status."
