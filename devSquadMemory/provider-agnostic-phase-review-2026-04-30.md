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

## Additional hardening completed after phase review draft

### Phase 19 / 20 / 21 updates
1. **PID-first orchestrator lifecycle control** (`src/lib/pipeline-control.ts`)
  - Launch now stores `runtime.orchestratorPid` and `runtime.orchestratorStartedAt`.
  - Stop paths prefer PID-owned termination before pattern fallback.
  - Runtime records `orchestratorStoppedAt` and clears PID on stop.

2. **Recency-aware state merge semantics** (`src/app/api/chat/route.ts`)
  - Merge now compares latest event timestamps between current/incoming states.
  - Session/status/provider/model fields avoid stale overwrite from older snapshots.

3. **Fail-closed orchestration signal parsing** (`pipeline/orchestrator.ts`)
  - Unparseable reviewer/test/audit output no longer auto-approves.
  - Invalid/unstructured outputs generate explicit follow-up issues/failures/findings.

4. **Auth hardening expanded to control APIs**
  - `/api/chat`, `/api/state`, `/api/reset` now require token OR explicit localhost dev bypass.
  - Centralized in `authorizeLocalOrTokenRequest`.
  - `skill-runtime` internal fetches now forward token headers automatically when configured.

5. **Unsafe dev-open default removed**
  - If `DEV_SQUAD_API_TOKEN` is unset, access is denied unless
    `DEV_SQUAD_ALLOW_UNAUTH_LOCAL=1` **and** request resolves to localhost.
  - This prevents silent open access from non-local contexts.

6. **Process kill pattern narrowing**
  - Orchestrator/opencode/runner stop patterns are scoped to Build invocation context where possible to reduce accidental host process termination.

### Current local env expectation
- Recommended secure setup:
  - `DEV_SQUAD_API_TOKEN=<secret>`
- Optional local-only dev bypass (not recommended beyond localhost):
  - `DEV_SQUAD_ALLOW_UNAUTH_LOCAL=1`

### Validation after latest hardening
- `npx tsc --noEmit` ✅
- `npx tsx scripts/test-runner.mjs` ✅
- Post-hardening CRITICAL/HIGH audit on orchestrator/control/chat/state/reset/skill-runtime: **none found**.

## Real-world validation follow-up (late 2026-04-30)

### Live LM Studio end-to-end build
- Re-ran a real Supervisor-led build against the local app using LM Studio provider `10.2.0.90:1234`.
- Concept used: build a browser Tic-Tac-Toe game with HTML/CSS/JS and real local files.
- Initial failure mode discovered:
  - Planner A sometimes wrote `index.html` instead of `plan.md` during the planning phase.
  - Coder C could also narrate code without creating implementation artifacts.
- Fixes applied in `pipeline/orchestrator.ts`:
  - strict planning write-step recovery when A writes the wrong file
  - implementation-artifact enforcement for C so the run cannot claim progress without real files
  - stricter JSON retry/fail-closed handling for reviewer/tester turns
- Confirmed successful outcome after the fix:
  - real `index.html`, `style.css`, and `script.js` were created under the build project directory
  - pipeline advanced through planning, coding, review, testing, security audit, and deploy/complete flow
  - final state reported `pipelineStatus: complete` and `buildComplete: true`

### Browser-driven GUI validation
- Playwright package installation was blocked in this environment, so GUI testing was completed using headless Chrome + raw Chrome DevTools Protocol automation instead of API-only smoke tests.
- Proven by actual browser interaction:
  1. **Squad provider/model switching works**
     - switching to LM Studio loaded 25 models in the model dropdown
     - selected model persisted in the visible control
  2. **Squad manual send works**
     - typed into the visible input
     - clicked the real Send button
     - observed `/api/chat` request and visible user message in the page
  3. **Office manual send works**
     - typed into the visible Office input
     - clicked the real Send button
     - observed `/api/chat` request and visible user message in the page

### Render / polling / route-speed corrections
- Root causes confirmed from code and logs:
  - overly frequent `/api/state` polling
  - additional `/api/pending` polling from both Office and Squad
  - heavy Office scene mounting on route switch
  - stale `.next-instances/*` TS type globs inflating dev watch churn
- Fixes applied:
  - `use-pipeline` default poll interval raised from 400ms to 3000ms
  - Office/Squad polling now uses slower cadence (`5000ms` pipeline / `10000ms` manual)
  - pending-approval polling now skips hidden tabs and backs off to 12s/30s
  - `LunarOfficeScene` is lazy-loaded to reduce route-switch blocking
  - wildcard `.next-instances/*` type globs removed from `tsconfig.json`

### Provider UI simplification confirmed
- Base URL input removed from Office and Squad.
- Current model is:
  - provider + model + refresh on one row
  - host/IP + port on the row beneath for HTTP providers
  - derived gray `Full URL in use` hint beneath
  - API key field only when provider type needs it

### Still not fully proven from this environment
- **Open WebUI**
  - config save path works
  - host `10.2.0.22:8080` was not reachable from this test environment during direct validation
  - model discovery therefore remained empty here
- **Ollama**
  - localhost `11434` was not reachable from this test environment during direct validation
  - model discovery therefore remained empty here

### Practical conclusion
- LM Studio is now proven for:
  - model discovery
  - manual chat
  - supervisor pipeline start
  - real file creation during a build
  - browser-observed UI interaction in both Office and Squad views
- Open WebUI and Ollama wiring remain implemented, but live provider reachability still needs validation from a network context that can actually reach those hosts.
