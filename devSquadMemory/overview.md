Overview — Architecture Deep Dive
=================================

**Last updated: 2026-05-23** (model propagation fix + pipeline-control helper exports)

Summary
-------
`the-dev-squad` is a Next.js (app router) TypeScript application that orchestrates a multi-agent "Dev Squad" powered by the `claude` CLI and now configurable LLM providers. The product design centers on treating Claude as a team with specialized roles (Supervisor + specialists). Two main modes exist: Pipeline Mode (automated orchestrator running agents) and Manual Mode (human orchestrator spawning Claude sessions directly).

Key technologies & frameworks
----------------------------
- Next.js (version 16) + React 19 (frontend)
- TypeScript for the codebase
- Node.js scripts and small shell helpers (under `scripts/`)
- The project runs Claude (or remote LLMs) via local CLI / HTTP shim (spawned processes)
- Orchestration code lives in `pipeline/` and `src/lib/` (pipeline-* helpers)

High-level components
---------------------
- Web UI: `src/app/*` + `components/*` — React components and pages for the Office/Board UI
- API: Server routes under `src/app/api/*` — accepts commands like start/stop/pipeline chat
- Pipeline orchestrator: `pipeline/orchestrator.ts`, `pipeline/runner.ts` — runs pipeline flows and abstracts host vs Docker runners
- Pipeline library: `src/lib/pipeline-*.ts` — planning, runtime state, supervisor and control logic
- Hooks & integration: `.claude/settings.json` and `pipeline/.claude/hooks/approval-gate.sh` are used to gate tool use and implement permission checks
- Scripts: `scripts/probe-auth.sh` and other utilities that check credentials and run the `claude` binary
- Multi-provider adapters: `src/lib/modelAdapters/` — 9 provider adapters with model discovery and execution

Multi-Provider LLM System (added April 2025)
---------------------------------------------
The app supports 9 LLM providers selectable from both pipeline and manual modes:

| Provider     | Status         | Host/Endpoint                      | Models |
|--------------|----------------|-------------------------------------|--------|
| claude-cli   | ✅ LIVE        | local ~/.claude                     | 2 |
| ccr          | ✅ LIVE        | localhost:3456 (proxy to LM Studio) | 25 |
| occ          | ✅ LIVE        | AWS Bedrock via local claude        | 3 |
| openclaude   | ✅ LIVE        | local claude binary                 | 2 |
| ollama       | ✅ LIVE        | localhost:11434                     | 2 |
| lm-studio    | ✅ LIVE        | 192.168.1.90:1234 + 10.2.0.90:1234 | 23 |
| openwebui    | ✅ LIVE        | localhost:3000 (via some port)      | 1 |
| openai-compat| ⚠️  No server  | configurable                        | 0 |
| openai-http  | ⚠️  No key     | api.openai.com                      | 0 |

LM Studio Dual-Host Configuration (April 2026)
-----------------------------------------------
LM Studio is accessible via two network interfaces on the same machine (192.168.1.90):
- **Primary**: `http://192.168.1.90:1234` (LAN interface)
- **Secondary**: `http://10.2.0.90:1234` (VPN/second interface)

Both are auto-detected from `~/.claude-code-router/config.json` (CCR config).
The adapter (`src/lib/modelAdapters/lmStudioAdapter.ts`) tries ALL CCR-configured LM Studio
hosts and merges their unique model lists. The primary URL is used for execution.

LM Studio Model Inventory (live as of 2026-04-25, 23 models):
- allenai/olmo-3-32b-think
- baidu/ernie-4.5-21b-a3b
- claude-3.7-sonnet-reasoning-gemma3-12b
- essentialai/rnj-1
- glm-4.7-flash-claude-opus-4.5-high-reasoning-distill-v2-heretic-i1
- google/gemma-3-27b, google/gemma-3n-e4b, google/gemma-4-26b-a4b, google/gemma-4-31b
- ibm/granite-3.2-8b
- lfm2.5-1.2b-distilled-claude-4.6
- liquid/lfm2-1.2b, liquid/lfm2-24b-a2b, liquid/lfm2.5-1.2b
- meta/llama-3.3-70b
- mineru2.5-pro-2604-1.2b-i1, minimax-m2.5
- nvidia/nemotron-3-nano-4b
- qwen/qwen3.5-35b-a3b, qwen/qwen3.5-9b
- qwopus3.5-27b-v3
- text-embedding-nomic-embed-text-v1.5
- zai-org/glm-4.6v-flash

Pipeline Mode Provider/Model Selection (added April 2026)
----------------------------------------------------------
Both `src/app/page.tsx` and `src/app/squad/page.tsx` now show the provider & model picker
in BOTH pipeline and manual modes (was previously hidden in pipeline mode).
Controls lock (disabled) once pipeline starts (`securityModeLocked`), same as Security/Permission Mode.
The selected model+provider flows through: UI → usePipelineState → startPipeline →
pipeline-control.ts saves to state file → orchestrator reads selectedModel per agent.

Key configuration files
-----------------------
- `~/.claude-code-router/config.json` — CCR router config, includes lmstudio + lmstudio-10.2 providers
- `provider-config.json` (project root) — user-saved endpoint host/port overrides per provider
- `src/lib/providerConfig.ts` — reads above, exports `getLmStudioUrlsFromCcrConfig()` (plural, returns both hosts)
- `src/app/api/models/route.ts` — model discovery API, DEFAULT_MODELS has all 23 LM Studio models as fallback

Where things connect
--------------------
- API endpoints spawn or control the orchestrator/runner. The orchestrator coordinates turns and writes events to staging files (e.g. `.staging/pipeline-events.json`).
- The Runner abstraction (host vs Docker) launches the `claude` CLI processes. The host runner is the default; DockerRunner is present for narrow cases.
- `pipeline-control.ts` copies template `.claude` settings into the project workspace and installs `PreToolUse` hooks to enforce pipeline guardrails.

Runtime & data flow
-------------------
1. User action (UI or API) triggers a pipeline job (e.g., "start pipeline").
2. Orchestrator (pipeline/orchestrator.ts) sets up working dirs, copies `.claude` settings/hooks, and calls the Runner to execute agent turns.
3. Runner spawns `claude` CLI processes (with `--system-prompt` / `--resume` flags) for each agent turn. Output can be stream-json.
4. Agents write pipeline events to staging files; supervisor inspects events and decides orchestrator actions (retries, escalate to host if Docker auth fails).
5. Hooks (`.claude/hooks/approval-gate.sh`) block or allow tool use from within pipeline sessions to enforce role-based restrictions.

Security model & sandboxing
--------------------------
- The system uses hooks and environment gating rather than strong OS-level sandboxing. DockerRunner exists, but Docker is not the default due to Claude subscription auth issues in containers.
- Important guardrails: `approval-gate.sh` (PreToolUse), `PIPELINE_PERMISSION_MODE`, and `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` environment flags are used to limit agent scope.

Quick references (where to look)
--------------------------------
- High-level architecture: `ARCHITECTURE.md`
- Runner & orchestrator: `pipeline/runner.ts`, `pipeline/orchestrator.ts`, `pipeline/README` (if present)
- Pipeline helpers: files under `src/lib/pipeline-*.ts` (planning, runtime, supervisor, control)
- Claude-related scripts: `scripts/probe-auth.sh` and `.claude` templates copied by `src/lib/pipeline-control.ts`
- Provider adapters: `src/lib/modelAdapters/` — each provider has its own adapter file
- Full provider test: `scripts/test-all-providers.mjs` — runs live model discovery for all 9 providers

Model Propagation Fix (May 2026)
---------------------------------
Resolved the `selectedModel: None` bug that caused all 5 pipeline agents (A–E) to always run
with the DEFAULT_MODEL (`claude-opus-4-6`) regardless of user selection.

**Root causes fixed:**

1. **`pipeline/orchestrator.ts` — `PipelineState` interface** (lines 226–227):
   Added `selectedModel?: string` and `selectedProvider?: string` to the typed interface.
   Previously the fields were accessed as `(state as any).selectedModel` — always `undefined`
   because they were never copied into the explicitly-initialised state object.

2. **`pipeline/orchestrator.ts` — state initialisation** (resume path ~line 258, fresh-start ~line 307):
   Both paths now explicitly copy `selectedModel`/`selectedProvider` from the parsed JSON.
   Fresh-start path uses `existingSelectedModel`/`existingSelectedProvider` local vars first.

3. **`pipeline/orchestrator.ts` — stale agent status on crash** (`run().catch()`):
   Any agents left at `'active'` or `'working'` are reset to `'idle'` before the failure state
   is flushed.  Prevents UI from showing permanently-spinning agents after a crashed run.

4. **`src/lib/pipeline-control.ts` — `setStopAfterReview` declaration lost** (~line 225):
   The function body was accidentally orphaned (missing `export function ...{` header) in a
   prior edit.  Declaration re-added; TypeScript now clean (TSC: 0 errors).

5. **`src/lib/pipeline-control.ts` — new programmatic exports** (lines 444–499):
   - `createStagingSession(projectDir, opts)` — writes a minimal pipeline-events.json for tests
   - `resetPipelineState(projectDir)` — deletes pipeline-events.json (test teardown)
   - `loadPipelineState(projectDir)` — alias for `readPipelineState` (test assertion helper)
   These are required by `scripts/test-pipeline-provider-selection.mjs`.

**Verified:** `npx tsc --noEmit` ✅ and all 10 test scripts ✅ as of 2026-05-23.

