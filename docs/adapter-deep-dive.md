## devSquad — Adapter & Pipeline Deep Dive

This document explains where selections and run-time variables are set, how they flow from UI → API → staging/project state → orchestrator → runner → adapter → model backend, and why certain local provider failures occur (CCR, occ, openclaude, Ollama, LM Studio). It also lists remediation steps and quick checks.

---

High-level flow (conceptual):

- UI (React/Next page) — `src/app/page.tsx` / `src/app/squad/page.tsx`
  - Persists choices to localStorage keys:
    - `devsquad.selectedProvider` (the provider id)
    - `devsquad.selectedModel.<provider>` (model choice per-provider)
    - Per-agent overrides: `devsquad.selectedModel.<provider>.<agent>` (added in UI)
  - Calls client hook `usePipelineState` which exposes `sendChat` and `startPipeline`.

- Client hook — `src/lib/use-pipeline.ts`
  - `sendChat()` and `startPipeline()` POST to server routes `/api/chat` and `/api/start-pipeline` and include `model` and `modelProvider` in the request body.
  - `startPipeline()` now accepts an optional `agentModels` argument (per-agent overrides) and sends that to the server.

- Server API
  - `/api/start-pipeline` (server) → `src/lib/pipeline-control.ts` → `startPipelineRun()`
    - Writes `selectedModel`, `selectedProvider`, and `agentModels` into the project's `pipeline-events.json` (staging or project path).
  - `/api/chat` (server) — when invoked in pipeline mode, also persists incoming `model`/`modelProvider` into staging state so orchestrator will see the UI choices.

- Pipeline orchestrator — `pipeline/orchestrator.ts`
  - Loads `pipeline-events.json` as authoritative state.
  - Per-agent selection is resolved like:
    - `activeModel = state.agentModels?.[agent] || state.selectedModel || DEFAULT_MODEL`
    - `modelProvider = state.selectedProvider`
  - The orchestrator calls `runClaudeTurn()` which constructs `RunnerOptions` containing the chosen model and provider and calls the runner.

- Runner layer — `pipeline/runner.ts` (HostRunner / DockerRunner / AutoRunner)
  - Picks an adapter according to `opts.modelProvider` (explicit) or configured provider preferences.
  - Calls adapter.spawn(opts) to actually spawn the provider process or HTTP shim.
  - On adapter/spawn failures, runner writes readable events to `pipeline-events.json` (so UI shows fallback reasons).

- Model Adapters — `src/lib/modelAdapters/*.ts`
  - Each adapter implements discovery (`discoverModels()`), availability (`isAvailable()`), and spawn (`spawn()`)
  - Typical adapters:
    - `claudeCliAdapter` — calls a local `claude` CLI process
    - `claudeCodeRouterAdapter` (`ccr`) — prefers `ccr` CLI but contains `spawnViaHttpShim()` to call an underlying HTTP provider when CCR would block non-Anthropic IDs
    - `openClaudeCodeAdapter` (`occ`) — spawns `occ` or `npx @ruvnet/open-claude-code`
    - `openClaudeAdapter` — spawns `openclaude` CLI (or `npx` wrapper)
    - `ollamaAdapter` — uses `ollama` CLI or HTTP endpoints (default port 11434)
    - `lmStudioAdapter` — uses LM Studio HTTP endpoints (default port 1234) via the http-runner-shim
    - `openaiHttp` / `openaiCompat` — OpenAI-compatible HTTP endpoints via http-runner-shim

---

Where the important variables are set and persisted

- UI-localStorage keys (client):
  - `devsquad.selectedProvider` — set by `page.tsx` when user chooses provider.
  - `devsquad.selectedModel.<provider>` — set by `page.tsx` when user chooses model for a provider.
  - `devsquad.selectedModel.<provider>.<agent>` — per-agent overrides implemented in UI (persisted when user selects a per-agent model).

- API-level persistence (server):
  - `startPipeline()` (client) sends `{ model, modelProvider, agentModels }` to `/api/start-pipeline`.
  - `startPipelineRun()` (server, `src/lib/pipeline-control.ts`) writes `selectedModel`, `selectedProvider`, and `agentModels` into `pipeline-events.json` (staging/project dir). This file is authoritative for the orchestrator.
  - `/api/chat` pipeline handler also writes `model`/`modelProvider` from the request into the staging state to ensure selections are applied even when the run starts via chat.

- Orchestrator read path:
  - `pipeline/orchestrator.ts` reads `pipeline-events.json` on start and when state changes. The orchestrator uses `state.selectedModel`, `state.selectedProvider`, and `state.agentModels` when constructing runner calls.

---

Adapter discovery and spawn logic (per-provider)

1) Claude CLI (claude-cli)
   - Discovery: attempts to call `claude --version` or other lightweight probes via `ModelAdapter` helpers.
   - Spawn: spawns `claude` executable with args. Best for local Anthropic CLI-backed workflows.
   - Failures: `claude` not on PATH → adapter.isAvailable() false → provider shown as unavailable.

2) Claude Code Router (ccr)
   - Discovery: reads `~/.claude-code-router/config.json` and/or `ccr` CLI presence.
   - Spawn: `ccr` CLI will perform model-name validation. If model names are not Anthropic canonical names, `ccr` may reject them.
   - Fallback: `claudeCodeRouterAdapter` implements `spawnViaHttpShim()` — when CCR is configured to route a model to an underlying HTTP provider (e.g., Ollama, LM Studio), this shim starts the `http-runner-shim` pointed at the provider's base URL to run the model without CCR enforcing Anthropic-only names.
   - Common failure modes:
     - `ccr` binary missing
     - `~/.claude-code-router/config.json` missing or not mapping model → no route
     - CCR client-side name validation rejects the model before a request is proxied
   - Remediation:
     - Install `ccr` or add a mapping in `~/.claude-code-router/config.json` that points the model name to an OpenAI-compatible endpoint.
     - Use spawnViaHttpShim (which this code supports) by ensuring CCR config lists the provider base URL.

3) Open-claude-code (occ)
   - Discovery: runs `occ` or `npx` banner probe and attempts to extract any configured model ids (Bedrock ARNs or env-vars like `OCC_MODEL`). It also looks at environment variables for fallback.
   - Spawn: runs `occ` or `npx @ruvnet/open-claude-code` with the requested args.
   - Failure modes: `occ` not installed or `npx` not available; interactive REPL behavior means discovery must be done carefully (the adapter handles that).

4) OpenClaude (openclaude)
   - Discovery: looks for `openclaude` CLI or `npx` variant; also checks `~/.openclaude/config.json`.
   - Spawn: spawns local `openclaude` CLI. If CLI cannot be found or the config is missing/misconfigured, the adapter will be unavailable.
   - Remediation: install openclaude CLI or configure the host and port via provider-config endpoint.

5) Ollama
   - Discovery: tries `ollama` CLI and HTTP endpoints (default port 11434). Also supports API discovery via `/api/tags` or `/v1/models` depending on Ollama version.
   - Spawn: either runs `ollama` CLI or uses `http-runner-shim` pointed at the Ollama HTTP base URL.
   - Common issues:
     - Ollama daemon not running
     - OLLAMA_BASE_URL not set and CLI not on PATH
   - Remediation: start the Ollama service or set `OLLAMA_BASE_URL=http://localhost:11434` in your environment or provider-config.

6) LM Studio
   - Discovery: probes LM Studio HTTP endpoints `http://localhost:1234/api/v1/models` or `.../v1/models`.
   - Spawn: uses `http-runner-shim` to adapt the HTTP model to the multi-turn stream-json runner interface.
   - Remediation: ensure LM Studio is running, set `LM_STUDIO_BASE_URL` or use the UI endpoint config (page -> Endpoint Config -> Save) to point to your running instance.

7) OpenAI-compatible HTTP endpoints (openai-compat / openai-http / openwebui)
   - Discovery: tries `/v1/models` or provider-specific endpoints.
   - Spawn: uses `http-runner-shim` to handle streaming JSON and multi-turn session semantics.

http-runner-shim (scripts/http-runner-shim.mjs)
  - Purpose: adapt OpenAI/HTTP model endpoints to the project's stream-json event model, provide multi-turn session persistence, and act as a bridge for providers that only expose an HTTP API.
  - Usage: adapters call the shim with environment variables that point the shim at a provider base URL and model. The shim emits stream-json events and accepts prompts for multi-turn flows.

---

Why the UI sometimes falls back to `claude-cli` on refresh

- `/api/providers` returns a fixed, known provider ordering. When the stored provider value is missing, invalid, or not yet discovered as available, the code falls back to the first available provider (or the first provider in the known list).
- Root causes for stored provider being ignored:
  - localStorage read fails (rare) or stored value not present
  - adapter.isAvailable() returns false (the adapter reports unavailable because the CLI/binary is missing, or the provider's saved configuration is missing)
  - discovery delay: the UI may initialize selectedProvider before the background discovery fetch completes; when the fetch finishes it chooses the first available provider if the stored one isn't yet in the discovered list.

Remediation / suggestions:

- Make sure the provider adapter is marked available by:
  - Installing the provider CLI (e.g., `ollama`, `occ`, `openclaude`, `ccr`) or
  - Starting the provider service and setting the base URL via env var (e.g., `OLLAMA_BASE_URL`, `LM_STUDIO_BASE_URL`) or use the Endpoint Config UI and click Save.
- If you frequently switch providers, the UI now persists the per-provider model and per-agent overrides so selections survive refreshes.

---

Quick checks and commands

- Which CLIs are available on PATH?
  - which ccr || echo "ccr missing"
  - which occ || echo "occ missing"
  - which openclaude || echo "openclaude missing"
  - which ollama || echo "ollama missing"

- Probe LM Studio / Ollama HTTP endpoints
  - curl -sS 'http://localhost:1234/v1/models' | jq .
  - curl -sS 'http://localhost:11434/api/tags' | jq .

- Check config files:
  - ~/.claude-code-router/config.json
  - ~/.openclaude/config.json
  - check env vars: LM_STUDIO_BASE_URL, OLLAMA_BASE_URL, OPENAI_BASE_URL

---

If you need a short remediation recipe for a failing provider, ask me and I will produce step-by-step OS-specific commands (macOS, Linux) to install the CLI, add config files, or set env vars.

References (code locations)

- UI: `src/app/page.tsx`, `src/app/squad/page.tsx`
- Client hook: `src/lib/use-pipeline.ts`
- API: `src/app/api/start-pipeline/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/providers/route.ts`, `src/app/api/models/route.ts`
- Pipeline control: `src/lib/pipeline-control.ts`
- Orchestrator: `pipeline/orchestrator.ts`
- Runner: `pipeline/runner.ts`
- Model adapters: `src/lib/modelAdapters/*.ts`
- HTTP shim: `scripts/http-runner-shim.mjs`

---

If you'd like, I can also:

- Generate a single troubleshooting checklist per-provider with specific install commands for macOS.
- Add UI improvements to avoid choosing the first provider until discovery completes (small change to the provider selection logic).
- Add a small integration test (CI script) that runs `npx tsx scripts/check-pipeline-state.ts` to validate pipeline persistence on PRs.

Requested next step: tell me which of the three you'd like me to implement now (provider checklist, UI selection improvement, or CI test), or I can proceed with all three.
