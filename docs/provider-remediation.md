Provider troubleshooting & remediation (macOS)
============================================

Quick purpose
-------------
This guide helps you diagnose and fix common local-provider failures (CCR / occ / openclaude / Ollama / LM Studio / OpenAI-compat).

General checks
--------------
- Verify CLI availability on PATH:

  ```bash
  which claude || echo "claude missing"
  which ccr || echo "ccr missing"
  which occ || echo "occ missing"
  which openclaude || echo "openclaude missing"
  which ollama || echo "ollama missing"
  ```

- Check provider-config saved by UI (project root) — shown to the UI and used by adapters:

  ```bash
  cat provider-config.json
  ```

- Check CCR config (used to map local models to LM Studio / Ollama):

  ```bash
  cat ~/.claude-code-router/config.json
  ```

Ollama
------
- Check if Ollama CLI is present and the daemon is running:

  ```bash
  which ollama
  ollama list
  curl -sS http://localhost:11434/api/tags | jq .
  ```

- Remediation:
  - If `ollama` is missing, install via Homebrew if available:

    ```bash
    brew install ollama
    # or follow Ollama install instructions from their site
    ```

  - Ensure Ollama daemon is started: `ollama serve` (or use the macOS app if available).
  - If running on a non-default host, set the UI Endpoint Config (Provider panel) or export `OLLAMA_BASE_URL`.

LM Studio
---------
- Probe LM Studio endpoints (tries CCR-configured hosts + localhost fallback):

  ```bash
  curl -sS http://localhost:1234/api/v1/models | jq .
  curl -sS http://192.168.1.90:1234/api/v1/models | jq .
  ```

- Remediation:
  - Start LM Studio on the host machine and ensure the port (1234) is reachable.
  - If LM Studio runs on another host, add it to `~/.claude-code-router/config.json` or set `LM_STUDIO_BASE_URL` or use the UI Endpoint Config.

Claude Code Router (CCR)
------------------------
- Check CCR CLI and config:

  ```bash
  which ccr
  ccr code --help
  cat ~/.claude-code-router/config.json
  ```

- Common CCR failure modes and fixes:
  - Model name validation: CCR/`ccr code` validates Anthropic-style names and will reject non-Anthropic local model identifiers (e.g. `llama3.2:latest`).
    - Fix: map the non-Anthropic model to a CCR provider in `~/.claude-code-router/config.json` so the router knows which host to proxy to.
    - Example mapping entry (CCR `Providers` element):

      ```json
      {
        "name": "lmstudio",
        "api_base_url": "http://192.168.1.90:1234/v1/chat/completions",
        "models": ["llama3.2:latest", "...other models..."]
      }
      ```

  - If CCR cannot be used for a local model, the codebase falls back to an HTTP shim that calls the mapped provider directly (no CCR). Ensure CCR config contains the provider mapping or use the UI endpoint to point directly to the LM Studio/Ollama host.

openclaude / occ
----------------
- Quick probes:

  ```bash
  which openclaude || echo "openclaude missing"
  openclaude --help
  which occ || echo "occ missing"
  occ --help
  ```

- Remediation:
  - `occ` is available as `@ruvnet/open-claude-code` (npm) or as a platform binary in some package managers — install per the adapter's docs.
  - `openclaude` may be installed via a project-provided installer or `npx @gitlawb/openclaude` as a fallback (adapter supports `npx`).
  - Ensure any Bedrock/AWS credentials required by `occ`/`openclaude` are present in the process environment where the runner spawns (host/container).

OpenAI-compatible / HTTP providers (LM Studio, OpenWebUI, LocalAI, vLLM)
---------------------------------------------------------------------
- Discovery & execution checks:

  ```bash
  # try OpenAI-style model list
  curl -sS "${OPENAI_BASE_URL:-http://localhost:1234}/v1/models" | jq .
  ```

- Remediation:
  - If discovery returns empty, configure the Endpoint in the UI (Provider panel) and click Save. This persists `provider-config.json` used by adapters.
  - Set env vars for quick debugging: `export OPENAI_BASE_URL=http://localhost:1234; export OPENAI_API_KEY=...` then re-run `/api/models`.

Diagnostic commands (summary)
-----------------------------

```bash
# Which CLIs?
which claude ccr occ openclaude ollama || true

# Probe HTTP endpoints
curl -sS http://localhost:11434/api/tags | jq . || true   # Ollama
curl -sS http://localhost:1234/api/v1/models | jq . || true  # LMStudio native
curl -sS http://localhost:1234/v1/models | jq . || true      # LMStudio OpenAI-compat

# Check CCR config
cat ~/.claude-code-router/config.json

# Check app provider-config (saved via UI)
cat provider-config.json
```

If you want, I can generate step-by-step install commands for each provider (Homebrew / npm / apt / manual), or open a PR that adds a `docs/troubleshooting` checklist with per-provider commands tailored to your macOS environment. Which do you prefer me to do next?

Quick diagnostic scripts
------------------------
Run the bundled non-destructive diagnostic scripts to quickly check your environment:

```bash
./scripts/diagnose-providers.sh

# Or run individual checks
./scripts/diag-ollama.sh
./scripts/diag-lm-studio.sh
./scripts/diag-ccr.sh
./scripts/diag-openclaude.sh
```

