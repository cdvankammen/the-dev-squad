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
