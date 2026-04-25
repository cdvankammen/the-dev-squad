# Dev Squad verification report (current)

Date: 2026-04-24
Repo: `/Users/stillbulldog35/Documents/personalGithub/the-dev-squad`
Branch: `fix/namespace-tools`

## 1) Critical bug fix status (your reported 500)

### Reported error

`RunnerOptions requires either roleFile or systemPrompt`

### Root cause

Manual chat requests with resumed sessions could omit both `roleFile` and `systemPrompt` in `/api/chat`, violating runner validation.

### Fix applied

- `src/app/api/chat/route.ts`
  - Manual path now **always** passes `systemPrompt` (`MANUAL_PROMPTS[agent]`) regardless of `sessionId`.

### Verification

- `scripts/test-chat-manual-provider-switch.mjs`
  - posts multiple manual chat messages across provider changes and session reuse,
  - confirms 200 responses,
  - confirms provider/model-specific assistant text written to manual event state.

Result: ✅ Reproduced and fixed.

---

## 2) Provider/model dropdown correctness (per-provider isolation)

### Problem addressed

Model choices could appear to leak from one provider into another due non-provider-scoped UI fallback behavior and overly broad model collection.

### Fixes applied

- `src/app/page.tsx`, `src/app/squad/page.tsx`
  - provider-scoped fallback maps (`PROVIDER_FALLBACK_MODELS`)
  - on provider change: reset model options to that provider’s fallback before discovery
  - then run provider-specific discovery and replace list accordingly
  - discovered-only mode preserved
  - provider/model controls rearranged so model status no longer sits under/behind scrollbar
- `src/lib/modelAdapters/openaiHttpAdapter.ts`
- `src/lib/modelAdapters/lmStudioAdapter.ts`
  - removed global configured-model bleed-through in discovery; now use provider-relevant env fallback only.

### Verification

- `npx tsx scripts/test-models.mjs <provider>` across:
  - `claude-cli`, `ccr`, `occ`, `openclaude`, `openai-http`, `lm-studio`
- UI logic validated via state-path tests and source review.

Result: ✅ Provider selection now drives provider-scoped model list behavior.

---

## 3) Added/verified provider support

### Newly wired provider

- `ccr` (Claude Code Router) added as first-class provider option.

Files:
- `src/lib/modelAdapters/claudeCodeRouterAdapter.ts` (new)
- `src/lib/modelAdapters/index.ts` (mapping)
- `src/app/api/providers/route.ts` (dropdown/API visibility)
- `src/app/api/models/route.ts` (defaults)
- page/squad fallback maps include `ccr`

### Execution reality snapshot

- `openclaude`: executes successfully in this environment
- `occ`: discovery works; test script saw minimal/non-assistant stream output in current env
- `ccr`: available on host; manual chat smoke test returns 200 (basic provider path works). Stream detail still wrapper-dependent.
- `openai-http` + `lm-studio`: executable via shim and validated with mock OpenAI-compatible backend

Important: provider runtime success still depends on environment auth/config and each wrapper CLI’s exact stream compatibility.

---

## 4) Full command set executed

```bash
npx tsc --noEmit -p tsconfig.json

npx tsx scripts/test-models.mjs claude-cli
npx tsx scripts/test-models.mjs ccr
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-models.mjs openai-http
npx tsx scripts/test-models.mjs lm-studio

npx tsx scripts/test-chat-manual-provider-switch.mjs
npx tsx scripts/test-chat-provider-smoke.mjs <provider> <model>
npx tsx scripts/test-chat-logging.mjs
npx tsx scripts/test-http-runner.mjs
npx tsx scripts/test-cli-adapters.mjs
npx tsx scripts/test-start-pipeline.mjs
```

Notes:
- `test-start-pipeline` currently returns expected guard error when no staging session exists:
  - `No staging session found. Talk to S or A first.`
- That is a workflow precondition, not a crash.

---

## 5) What is verified vs not fully verified

### Verified now

- Compile/type integrity
- Manual chat API robustness and JSON error handling
- Provider selection propagation from UI -> `sendChat` payload -> API -> runner
- HTTP providers (`openai-http`, `lm-studio`) execution compatibility
- Per-provider model-list handling behavior in UI state logic

### Not fully verified yet

- True browser E2E clicking of **every** button/input (no dedicated Playwright/Cypress suite exists in repo)
- Stable `ccr` execution stream-json parity under automated non-interactive harness
- End-to-end Bedrock inference on all wrappers in this environment (depends on CLI/env/profile setup)

For that gap, see `devSquadMemory/ui_control_test_matrix.md` and `devSquadMemory/runbook.md` for the recommended E2E harness plan.

---

## Rebase recovery re-audit (cli-changes, 2026-04-24 late pass)

### Why this pass happened
A branch switch in GitHub Desktop removed/overrode prior local changes. This pass re-ran core verification on `cli-changes` after re-applying and re-checking behavior.

### Additional fixes made in this re-audit
1. **CCR adapter compatibility fix** (`src/lib/modelAdapters/claudeCodeRouterAdapter.ts`)
   - Added automatic `--verbose` when `--output-format stream-json` is used (required by `ccr`).
   - Changed prompt handoff for `ccr code --print` to pass prompt via **stdin** instead of argv positional prompt (more reliable with CCR parser behavior).
2. **Safer process spawning** (`src/lib/modelAdapters/ModelAdapter.ts`)
   - Switched adapter spawning to `shell: false` to preserve argument boundaries and avoid shell injection/quoting bugs.
3. **Squad UI model-status layout fix** (`src/app/squad/page.tsx`)
   - Moved model-status badge styling off inline `ml-2` classes so status text no longer overlays/gets clipped near the scrollbar.
4. **CCR adapter smoke test quality update** (`scripts/test-cli-adapters.mjs`)
   - Default CCR smoke model changed to `haiku` (valid in this environment) for stable coverage.

### Re-run evidence (post-fix)
- Full regression command completed with `FULL_REGRESSION_OK`:
  - `npx tsc --noEmit -p tsconfig.json`
  - `npx tsx scripts/test-models.mjs claude-cli`
  - `npx tsx scripts/test-models.mjs ccr`
  - `npx tsx scripts/test-models.mjs occ`
  - `npx tsx scripts/test-models.mjs openclaude`
  - `npx tsx scripts/test-models.mjs openai-http`
  - `npx tsx scripts/test-models.mjs lm-studio`
  - `npx tsx scripts/test-chat-manual-provider-switch.mjs`
  - `npx tsx scripts/test-chat-logging.mjs`
  - `npx tsx scripts/test-http-runner.mjs`
  - `npx tsx scripts/test-cli-adapters.mjs`
  - `npx tsx scripts/test-start-pipeline.mjs`
- Direct `/api/chat` provider smoke with real providers returned HTTP 200 and no RunnerOptions validation failure:
  - `claude-cli`, `ccr`, `occ`, `openclaude`.

### Specific bug status updates
- **"RunnerOptions requires either roleFile or systemPrompt"**
  - Could not be reproduced in current branch state with direct provider smoke tests.
  - If this reappears, capture request payload in `logs/server-errors.log` and run `scripts/test-chat-provider-smoke.mjs` immediately for the selected provider.

- **Provider/model dropdown showing stale/same models**
  - API evidence confirms provider-specific model lists are distinct in this environment:
    - `claude-cli`: bedrock arn + haiku
    - `ccr`: bedrock arn + claude + haiku
    - `occ`: bedrock arn + claude-sonnet-4-6 + haiku
    - `openclaude`: bedrock arn + haiku

### Known environment-dependent limits
- `openai-http` and `lm-studio` discovery still return empty when local endpoint/config is not available; HTTP shim tests pass with mock endpoints.
- Start-pipeline verification remains sensitive to existing active run lock in shared pipeline state.

### Additional deep-test pass (continued)

New scripts added and executed:

- `scripts/test-api-surface.mjs`
  - Verifies `/api/health`, `/api/providers`, and `/api/models` JSON contracts.
- `scripts/test-provider-model-isolation.mjs`
  - Verifies `/api/models` provider responses are stable per provider across repeated/interleaved calls.
- `scripts/test-provider-tools-installed.mjs`
  - Verifies provider CLIs on PATH and help probe behavior.
- `scripts/test-ui-control-wiring.mjs`
  - Enumerates interactive UI controls in `page.tsx` and `squad/page.tsx` and confirms handler wiring presence.
- `scripts/test-start-pipeline-provider-selection.mjs`
  - Seeds staging state and verifies `startPipelineRun` persists selected provider/model/discoveredOnly into pipeline state.

Observed highlights:

- Tool availability on this host:
  - present: `claude`, `ccr`, `occ`, `openclaude`, `ollama`
  - missing on PATH: `lmstudio` (LM Studio use remains HTTP endpoint based in this codebase).
- Provider-isolation checks pass: interleaved `/api/models` calls stay provider-specific and do not cross-pollute route responses.
- UI status text class fix applied in both pages to avoid inline overlap near scrollbar zones.

### Deep regression suite command (latest)

```bash
npx tsc --noEmit -p tsconfig.json && \
npx tsx scripts/test-api-surface.mjs && \
npx tsx scripts/test-provider-model-isolation.mjs && \
npx tsx scripts/test-provider-tools-installed.mjs && \
npx tsx scripts/test-models.mjs claude-cli && \
npx tsx scripts/test-models.mjs ccr && \
npx tsx scripts/test-models.mjs occ && \
npx tsx scripts/test-models.mjs openclaude && \
npx tsx scripts/test-models.mjs openai-http && \
npx tsx scripts/test-models.mjs lm-studio && \
npx tsx scripts/test-chat-manual-provider-switch.mjs && \
npx tsx scripts/test-chat-provider-smoke.mjs claude-cli haiku "Say OK" && \
npx tsx scripts/test-chat-provider-smoke.mjs ccr haiku "Say OK" && \
npx tsx scripts/test-chat-provider-smoke.mjs occ claude-sonnet-4-6 "Say OK" && \
npx tsx scripts/test-chat-provider-smoke.mjs openclaude haiku "Say OK" && \
npx tsx scripts/test-http-runner.mjs && \
npx tsx scripts/test-cli-adapters.mjs && \
npx tsx scripts/test-chat-logging.mjs
```

Status: pass in current host environment.

### Pipeline route-control endpoint checks

Added and executed `scripts/test-pipeline-route-controls.mjs` to exercise:

- `GET /api/state?mode=pipeline`
- `POST /api/start-pipeline`
- `POST /api/stop-pipeline`
- `POST /api/resume-pipeline`
- `POST /api/approve`

Result:
- Route contracts return JSON envelopes consistently.
- Known expected error envelopes are handled (e.g., no staging session for start, not-paused resume).
- Invalid approve action currently returns status 200 with `{ success: false }` envelope (documented behavior).

### Super deep suite rerun (post-flake hardening)

After stabilizing `scripts/test-chat-manual-provider-switch.mjs` assertions for retrieved-context prefixes and adding extended route checks, the following full command completed with `SUPER_DEEP_SUITE_OK`:

```bash
npx tsc --noEmit -p tsconfig.json && \
npx tsx scripts/test-api-surface.mjs && \
npx tsx scripts/test-api-extended-routes.mjs && \
npx tsx scripts/test-provider-model-isolation.mjs && \
npx tsx scripts/test-provider-tools-installed.mjs && \
npx tsx scripts/test-ui-control-wiring.mjs && \
npx tsx scripts/test-pipeline-route-controls.mjs && \
npx tsx scripts/test-models.mjs claude-cli && \
npx tsx scripts/test-models.mjs ccr && \
npx tsx scripts/test-models.mjs occ && \
npx tsx scripts/test-models.mjs openclaude && \
npx tsx scripts/test-models.mjs openai-http && \
npx tsx scripts/test-models.mjs lm-studio && \
npx tsx scripts/test-chat-manual-provider-switch.mjs && \
npx tsx scripts/test-chat-provider-smoke.mjs claude-cli haiku "Say OK" && \
npx tsx scripts/test-chat-provider-smoke.mjs ccr haiku "Say OK" && \
npx tsx scripts/test-chat-provider-smoke.mjs occ claude-sonnet-4-6 "Say OK" && \
npx tsx scripts/test-chat-provider-smoke.mjs openclaude haiku "Say OK" && \
npx tsx scripts/test-http-runner.mjs && \
npx tsx scripts/test-cli-adapters.mjs && \
npx tsx scripts/test-chat-logging.mjs && \
npx tsx scripts/test-start-pipeline-provider-selection.mjs
```

Additional notes from this pass:
- `/api/pipeline-control` unsupported action currently returns status **200** with `{ success: false, error: "Unsupported pipeline control action" }`.
- `/api/plan` may return **404** with `{ content: null }` when no active plan context exists.
- `ccr` tool probe is now marked passing via `ccr code --help`.
