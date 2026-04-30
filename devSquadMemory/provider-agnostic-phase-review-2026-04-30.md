# Provider-Agnostic Phase Review — 2026-04-30

## Scope completed
- Executed phases 1 through 18 on local branch `feature/provider-agnostic-v2` without creating new branches.
- Validated compile and scripted checks:
  - `npx tsc --noEmit`
  - `npx tsx scripts/test-runner.mjs`
- Ran live LM Studio flow matrix against `http://10.2.0.90:1234` using multiple model-size combinations.

## Key runtime findings

### What worked
1. Provider + model APIs return dynamic model inventories for LM Studio.
2. Per-agent override persistence and provider-level model memory function through pipeline state and UI.
3. Skill/MCP endpoints are operational (`/api/skill/dev-squad`, `/api/mcp`) and preserve Supervisor-only external control.
4. Pipeline flow works with mixed-size model selections and can progress without Claude Code CLI.

### What failed and was fixed
1. **Intermittent pipeline start failure** (`No build concept found yet`) when concept and start were sent back-to-back after paused/old project context.
   - Root cause: concept messages could be routed to a non-running prior project instead of staging.
   - Fix in `src/app/api/chat/route.ts`:
     - Stage concept when Supervisor message arrives while prior project is non-running.
     - Fallback concept resolution for `start-run` from current state when staging concept is absent.

2. **External control surfaces had no optional access gate**.
   - Hardening fix in `src/lib/skill-runtime.ts`, `src/app/api/skill/dev-squad/route.ts`, `src/app/api/mcp/route.ts`:
     - Added optional token auth via `DEV_SQUAD_API_TOKEN`.
     - Supports `Authorization: Bearer <token>` and `x-dev-squad-token`.
     - Default local behavior remains unchanged when token env var is not set.

## Branch differences review (Phase 11)

### `main` -> `feature/provider-agnostic-v2`
- 34 source files changed.
- ~5.8k insertions / ~181 deletions in targeted source paths.
- Major additions:
  - Provider catalog/config/storage/runtime hooks
  - HTTP runner shim for openai-compat providers
  - MCP/Skill + health routes
  - Per-agent model UI/runtime plumbing

### `feature/json-provider-layer` -> `feature/provider-agnostic-v2`
- Divergence focused on:
  - Enhanced shim/orchestrator integration
  - MCP/Skill/health layers
  - Additional chat route adaptive handling

### `cli-changes` -> `feature/provider-agnostic-v2`
- Current branch intentionally drops adapter-class-heavy architecture and large unused scripts.
- Retains provider-agnostic outcome with smaller, cleaner runtime dispatch.

## Adversarial debate summary (Phase 17)

### Against reviewer (highlights)
- Called out authn/authz gap on external control routes.
- Highlighted fail-open parsing risk and concurrent state write concerns.
- Raised workspace-boundary/read-policy consistency concerns.

### Positive reviewer (highlights)
- Validated Supervisor-only external control pattern.
- Endorsed provider-agnostic dispatch + dynamic model discovery.
- Endorsed phase-gated doctrine and local-first fallback behavior.

### Decisions from debate
- **Adopted now:** optional token gate for MCP/skill routes.
- **Logged for next hardening cycle:** fail-closed parser escalation improvements, stronger shared-state concurrency model, expanded path policy consistency.

## Final line audit (Phase 18)
- Ran grep scan for TODO/FIXME/HACK/debugger and unexpected debug remnants.
- Reviewed all modified tracked source files line-by-line in final patch set.
- Remaining dirty runtime artifacts are under `.next-instances` and are expected local dev outputs.

## Local operator notes
- Keep using LM Studio endpoint `10.2.0.90:1234` for variation tests across small/medium/large model mixes.
- For exposed MCP/Skill usage, set:
  - `DEV_SQUAD_API_TOKEN=<secret>`
- If no token env var is set, endpoints remain local-open for developer convenience.
