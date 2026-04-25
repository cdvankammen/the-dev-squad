# Branch baseline analysis (main vs current)

Date: 2026-04-24
Current branch: `cli-changes`
Baseline branch requested as `master`: **not present** in this repo.
Actual baseline used: `main`.

## Git facts

- `master` lookup fails (`fatal: Needed a single revision`)
- Available branches include: `main`, `cli-changes`, `fix/namespace-tools`
- `git diff --name-status main...HEAD` currently reports **81 files** changed.

## High-impact delta areas relative to `main`

1. Multi-provider adapter layer added under `src/lib/modelAdapters/*`
2. Runner/provider routing behavior changed in `pipeline/runner.ts`
3. Chat API/provider/model wiring changed in `src/app/api/chat/route.ts`
4. Pipeline start model/provider wiring changed in `src/app/api/start-pipeline/route.ts` + `src/lib/pipeline-control.ts` + `pipeline/orchestrator.ts`
5. Manual UI provider/model controls changed in:
   - `src/app/page.tsx`
   - `src/app/squad/page.tsx`
6. Provider/model API endpoints added:
   - `src/app/api/providers/route.ts`
   - `src/app/api/models/route.ts`
   - `src/app/api/health/route.ts`
7. RAG/local memory files/scripts added under `devSquadMemory/*` and `src/lib/rag/localRetriever.ts`
8. Verification/diagnostic scripts added under `scripts/*`
9. Docker provider variant added (`pipeline/Dockerfile.agent.occ`)

## Risk summary from divergence

- **Positive**: Provider extensibility and diagnostics are much improved.
- **Risk**: With this much divergence from baseline, regression risk is primarily in:
  - provider/session state propagation,
  - discovery fallback behavior,
  - UI consistency between Office and Squad pages,
  - CLI argument compatibility (`claude` vs wrappers like `ccr`, `occ`, `openclaude`).

## Immediate recommendation

Before merge/deploy, lock these as required gates:

1. `npx tsc --noEmit -p tsconfig.json`
2. `npx tsx scripts/test-models.mjs <provider>` across all providers
3. `npx tsx scripts/test-chat-manual-provider-switch.mjs`
4. `npx tsx scripts/test-http-runner.mjs`
5. `npx tsx scripts/test-start-pipeline.mjs`
6. `npx tsx scripts/test-cli-adapters.mjs --strict` in an environment where provider auth is configured

---

## Re-check snapshot after branch recovery (2026-04-24)

Current working branch: `cli-changes`

`main..cli-changes` currently includes many commits and ~81 changed files (name-status diff snapshot). This is no longer a single-commit delta.

### Notable functional deltas carried by `cli-changes`
- Provider/adapters added (`claude-cli`, `ccr`, `occ`, `openclaude`, `openai-http`, `lm-studio`).
- Model discovery routes and provider routes added.
- Manual/pipeline provider-model propagation added.
- HTTP runner shim and related test scripts added.
- Local RAG/dev memory scripts + docs added.

### Practical implication
Treat `cli-changes` as an integration branch with broad behavior changes (API/UI/pipeline/tooling), not a small patch branch.

### Suggested workflow
1. Keep `cli-changes` local for ongoing verification (as requested).
2. Continue using scripted regressions before any merge/cherry-pick.
3. Cherry-pick only tested slices when upstreaming to `main`.

### Current delta snapshot (2026-04-24, latest re-check)

- branch: `cli-changes`
- commits ahead of `main`: 11
- files changed vs `main`: 122
- diffstat summary: `122 files changed, 447937 insertions(+), 78 deletions(-)`

This confirms `cli-changes` remains a large integration branch (provider adapters + memory artifacts + test tooling), not a narrow patch branch.
