File map — key files and responsibilities
=========================================

**Last updated: 2026-04-25**

Top-level docs
---------------
- `ARCHITECTURE.md` — conceptual overview: Supervisor + specialists, pipeline vs manual modes, runner abstraction, security notes.
- `README.md` — repo-level instructions (top-level)

Pipeline & orchestrator
------------------------
- `pipeline/orchestrator.ts` — orchestrator that runs pipeline jobs (sets up working dirs, invokes runners). Reads `state.selectedModel` + `state.selectedProvider` to assign model to each agent.
- `pipeline/runner.ts` — runner abstraction (HostRunner, DockerRunner)
- `pipeline/*` — CI/runner scripts used when performing isolated runs

Pipeline libraries (core runtime)
---------------------------------
- `src/lib/pipeline-planning.ts` — planning detection, prompts construction, research/write/self-review helpers
- `src/lib/pipeline-runtime.ts` — runtime state shapes, resume logic, stall detection
- `src/lib/pipeline-supervisor.ts` — supervisor logic and retry/escalation behavior (mentions Claude auth fallback)
- `src/lib/pipeline-control.ts` — copies `.claude` templates into project dir, manages pkill/cleanup and process lifecycle control. Saves `selectedModel`+`selectedProvider` to state on pipeline start.
- `src/lib/pipeline-signal.ts` — signaling helpers (start/stop/resume)
- `src/lib/use-pipeline.ts` — runtime hooks for UI to interact with pipeline state. Passes `model`+`provider` to startPipeline.

Provider Config & Adapters (NEW — April 2025/2026)
----------------------------------------------------
- `src/lib/providerConfig.ts` — shared server-side config utility
  - `getLmStudioUrlsFromCcrConfig()` — returns ALL LM Studio URLs from CCR config (e.g. ["http://192.168.1.90:1234", "http://10.2.0.90:1234"])
  - `getLmStudioUrlFromCcrConfig()` — returns first (primary) LM Studio URL
  - `getBaseUrlForProvider(id)` — priority: env → saved provider-config.json → CCR auto-detect → default
  - `getProviderConfig(id)` — reads provider-config.json with 5s cache TTL
- `provider-config.json` (project root, gitignored) — saved host/port/apiKey per provider from UI config panel
- `src/lib/modelAdapters/` — individual adapter files:
  - `ModelAdapter.ts` — base interface + `captureCommandOutput` helper
  - `lmStudioAdapter.ts` — LM Studio native API + OpenAI compat, tries ALL CCR hosts for model discovery
  - `openAICompatAdapter.ts` — generic OpenAI-compat (vLLM, LocalAI, TGI, etc.), 4-URL discovery
  - `ollamaAdapter.ts` — Ollama local server
  - `openWebUIAdapter.ts` — OpenWebUI
  - `ccrAdapter.ts` — Claude Code Router
  - `claudeCliAdapter.ts` — direct claude CLI
  - `occAdapter.ts` — OCC/Bedrock
  - `openClaudeAdapter.ts` — openclaude
  - `openAIHttpAdapter.ts` — api.openai.com
  - `index.ts` — adapter registry, maps provider id → adapter instance

API & server
------------
- `src/app/api/*` — API endpoints for pipeline control and chat: `start-pipeline`, `stop-pipeline`, `resume-pipeline`, `chat`, `pipeline-control`, `plan`, etc.
- `src/app/api/models/route.ts` — GET /api/models?provider=X. Runs adapter.discoverModels() with DEFAULT_MODELS fallback (includes all 23 LM Studio models as hardcoded fallback)
- `src/app/api/providers/route.ts` — GET /api/providers. Lists all 9 registered providers with availability status.
- `src/app/api/provider-config/route.ts` — GET/POST for endpoint host/port/apiKey config panel.

Frontend
--------
- `src/app/page.tsx` — Main page: both pipeline+manual modes. Provider & model picker visible in BOTH modes, locked during active pipeline.
- `src/app/squad/page.tsx` — Squad/office view. Same provider & model picker, same lock behavior.
- `src/app/layout.tsx` — root layout
- `src/app/globals.css` — global styles
- `src/components/*` — React components for UI (agents, mission scenes, shared components)

Scripts & utilities
-------------------
- `scripts/probe-auth.sh` — probes `claude` binary and `~/.claude.json` for local auth; runs `claude` with model flags to check access
- `scripts/test-all-providers.mjs` — **NEW** live test of all 9 providers against /api/models, shows discovery status
- `scripts/test-models.mjs` — tests model discovery for occ provider
- `scripts/*.mjs` — test scripts that exercise pipeline planning, runtime, supervisor behaviors

Configuration files
-------------------
- `~/.claude-code-router/config.json` — CCR router config with 2 LM Studio providers:
  - `lmstudio` → http://192.168.1.90:1234 (23 models)
  - `lmstudio-10.2` → http://10.2.0.90:1234 (23 models — same server, two network interfaces)
  - Router port: 3456, default model: lfm2.5-1.2b-distilled-claude-4.6

CLAs and templates
------------------
- `.claude/*` (templates under `BUILDUI_DIR/.claude`) — settings and hook scripts copied into project by `pipeline-control.ts` at job start

Notes
-----
Check the `src/lib/*` files for behavior details and `ARCHITECTURE.md` for the high-level mental model. The `scripts/` folder contains helpers used by the pipeline and tests to validate authentication and runtime invariants.
