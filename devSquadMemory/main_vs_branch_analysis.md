# Branch baseline analysis (main vs current)

Date: 2026-04-24
Current branch: `fix/namespace-tools`
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
