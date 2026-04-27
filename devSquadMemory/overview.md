Overview — Architecture Deep Dive
=================================

**Last updated: 2026-07-13** (http-runner-shim v2 + CCR adapter local-model bypass + per-agent/mid-run research)

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

HTTP Runner Shim v2 — Multi-Turn Agent Loop (April 2026)
---------------------------------------------------------
The `scripts/http-runner-shim.mjs` was completely rewritten from a ~197-line single-shot
script into a ~500-line multi-turn agent loop with full tool-calling support.

**Problem:** Local models (Ollama, LM Studio) were treated as "manual mode" — they would
receive a single prompt, return one text response, and exit. Agents couldn't read files,
write code, or interact with the codebase. This made local models unable to participate
as pipeline squad members.

**Solution:** The shim now implements a complete agent loop with:

| Feature | Details |
|---------|---------|
| Tool calling | OpenAI function calling format: Read, Write, Edit, Bash, Glob, Grep |
| Multi-turn loop | Up to MAX_AGENT_TURNS (default 30) conversation turns |
| Tool execution | `executeTool()` handles all tool types with safety limits |
| System prompts | `--system-prompt-file` flag reads role files (role-a.md, role-b.md, etc.) |
| Stream-json | Emits orchestrator-compatible events (system, assistant, user/tool_result, result) |
| Graceful fallback | Falls back to single-shot if provider doesn't support tools (HTTP 400/422) |
| Safety limits | TOOL_OUTPUT_LIMIT=12000 chars, BASH_TIMEOUT_MS=60000ms |
| Debug mode | `HTTP_SHIM_DEBUG=1` env var for verbose logging |

**Tested with:** Ollama `llama3.2:latest` — tool calling works (Read, Glob, Bash), system
prompts work (model correctly identifies as Agent A Planner). Exit code 0 on success.

**Dependencies:** Node.js built-ins only (crypto, fs, path, child_process, readline).
**Backup:** `scripts/http-runner-shim.mjs.bak.YYYYMMDD_HHMMSS`

CCR Adapter Local-Model Bypass (April 2026)
--------------------------------------------
**Problem:** `ccr code --model llama3.2:latest` fails because Claude Code CLI v2.1.119
validates model names client-side. Non-Anthropic identifiers are rejected before any
network request is made. Error: `"API Error: 400 The provided model identifier is invalid."`

**Root causes:**
1. Claude CLI rejects non-Anthropic model names (e.g., `llama3.2:latest`, `qwen/qwen3.5-35b-a3b`)
2. CCR's `/v1/chat/completions` endpoint returns "Provider 'undefined' not found" (CCR bug)
3. Model shorthands like "haiku", "sonnet", "opus" were not recognized as Anthropic models

**Solution (in `src/lib/modelAdapters/claudeCodeRouterAdapter.ts`):**

1. **`isAnthropicModelName(model)`** — detects full IDs (`claude-*`) and shorthands (haiku, sonnet, opus)
2. **`findCcrProviderForModel(model)`** — looks up model in CCR config.json providers' model arrays
3. **`readCcrRouterDefault()`** — reads CCR Router's default route as a last-resort fallback
4. **`spawnViaHttpShim(opts, args, provider)`** — spawns http-runner-shim pointed at provider's endpoint

**Flow in spawn():**
```
Model requested → isAnthropicModelName?
  YES → pass to `ccr code` as normal (Claude CLI handles it)
  NO  → findCcrProviderForModel(model)?
    FOUND → spawnViaHttpShim (bypass ccr code entirely)
    NOT FOUND → readCcrRouterDefault()?
      FOUND → use Router default model/provider via spawnViaHttpShim
      NOT FOUND → fall through to `ccr code` (will fail, error visible)
```

CCR Configuration (April 2026)
-------------------------------
LAN IP corrected from 192.168.1.90 to **10.2.0.90** for the lmstudio-lan provider.

CCR Router routes:
- default: lmstudio,qwen/qwen3.5-35b-a3b
- background: ollama,llama3.2:latest
- think: lmstudio,qwen/qwen3.5-35b-a3b
- longContext: lmstudio,google/gemma-4-31b
- webSearch: lmstudio,google/gemma-4-31b
- image: lmstudio,google/gemma-4-31b

Per-Agent Model Selection — Research Notes (April 2026)
--------------------------------------------------------
**Current state:** All 5 pipeline agents (A→B→C→D→E) use the SAME model and provider,
set once per pipeline run via `PipelineState.selectedModel` and `PipelineState.selectedProvider`.

**Architecture for per-agent selection:**
- `PipelineState` (orchestrator.ts ~line 226) would need:
  ```typescript
  agentModels?: Record<PipelineAgentId, { model: string; provider: string }>;
  ```
- `runClaudeTurn()` (orchestrator.ts ~line 482) currently uses `state.selectedModel || DEFAULT_MODEL`.
  Would need to check `state.agentModels?.[agent]?.model` first.
- UI changes: `src/app/squad/page.tsx` currently has ONE model dropdown. Would need a model
  selector per agent card, or a configuration panel.
- API changes: `StartPipelineOptions` in pipeline-control.ts currently has `model?: string`.
  Would need `agentModels?: Record<string, { model: string; provider: string }>`.

**Feasibility:** Medium complexity. The orchestrator already receives the agent ID for each
turn, so routing per-agent is straightforward. Main work is UI + state management.

Mid-Run Provider Switching — Research Notes (April 2026)
---------------------------------------------------------
**Current state:** Provider and model are locked for the entire pipeline run.
`pipeline-signal.ts` implements structured signal parsing but has no "change-provider" signal type.

**Architecture for mid-run switching:**
- The orchestrator's `claude()` function reads `state.selectedModel` and `state.selectedProvider`
  on EVERY agent call. If these values were updated mid-run (e.g., by writing to pipeline-events.json),
  subsequent agents would pick up the new values automatically.
- A new API endpoint (e.g., `/api/pipeline/set-model`) could write the new model/provider to the
  state file. The orchestrator would see the updated values on the next agent turn.
- No new signal type needed — the orchestrator already re-reads state values per turn.
- For immediate switching (mid-agent-turn), would need to kill the active child process and
  re-spawn with the new provider. This is more complex and risky.

**Feasibility:** Easy for between-agent switching (just update state file). Complex for
mid-agent-turn switching (process management).

