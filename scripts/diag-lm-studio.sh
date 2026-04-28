#!/usr/bin/env bash
set -euo pipefail
echo "=== LM Studio diagnostic ==="
echo "Probe LM Studio OpenAI-compat endpoints (localhost:1234)"
curl -sS http://localhost:1234/v1/models || echo "No response from http://localhost:1234/v1/models"
curl -sS http://localhost:1234/api/v1/models || echo "No response from http://localhost:1234/api/v1/models"

echo "If LM Studio runs on another host, set LM_STUDIO_BASE_URL or use the UI provider config." 
