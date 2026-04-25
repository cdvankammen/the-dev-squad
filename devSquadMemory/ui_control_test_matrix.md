# UI control test matrix (Office + Squad)

Date: 2026-04-24

This matrix distinguishes:

- **API/runtime verified** (scripted)
- **Static path verified** (handler inspected + compile-checked)
- **Needs browser E2E click test** (no Playwright/Cypress suite in repo yet)

## Manual mode controls

| Surface | Control | Expected behavior | Verification status |
|---|---|---|---|
| Office | Provider dropdown | Sets `selectedProvider`, triggers provider-specific model reset + discovery, used by `sendChat` payload | ✅ API/runtime verified (`test-chat-manual-provider-switch`) + static path verified |
| Office | Model dropdown | Sets `selectedModel`, sent in chat payload | ✅ API/runtime verified + static path verified |
| Office | Refresh models button | Re-fetches `/api/models?provider=...` | ✅ Static path verified + models route script verified |
| Office | Discovered-only checkbox | Toggles strict discovered-only behavior | ✅ Static path verified; manual browser click still recommended |
| Office | Chat textarea | Sends message on submit | ✅ API/runtime verified through sendChat scripts |
| Office | Send button | Invokes `handleSend` -> `sendChat` | ✅ Static path verified + backend route verified |
| Squad | Provider dropdown | Same as Office | ✅ API/runtime verified + static path verified |
| Squad | Model dropdown | Same as Office | ✅ API/runtime verified + static path verified |
| Squad | Refresh models button | Same as Office | ✅ Static path verified + models route script verified |
| Squad | Discovered-only checkbox | Same as Office | ✅ Static path verified; manual browser click still recommended |
| Squad | Chat textarea | Sends message on submit | ✅ API/runtime verified through sendChat scripts |
| Squad | Send button | Invokes `handleSend` -> `sendChat` | ✅ Static path verified + backend route verified |

## Pipeline controls

| Surface | Control | Expected behavior | Verification status |
|---|---|---|---|
| Office/Squad | Start pipeline button | Calls `startPipeline` with selected provider/model and settings | ⚠️ Start route verified; full run requires staging precondition (`Talk to S or A first`) |
| Office/Squad | Stop pipeline button | Calls stop endpoint and updates state | ✅ Static path verified; full browser click pending |
| Office/Squad | Resume pipeline button | Calls resume endpoint | ✅ Static path verified; full browser click pending |
| Office/Squad | Stop-after-review toggle | Updates pipeline behavior flag | ✅ Static path verified |
| Office/Squad | Security mode selector | Passed into start-pipeline payload | ✅ Static path verified |
| Office/Squad | Permission mode selector | Passed into start-pipeline payload | ✅ Static path verified |
| Office/Squad | Run goal selector | Passed into start-pipeline payload | ✅ Static path verified |
| Office/Squad | Final audit checkbox | Passed into start-pipeline payload | ✅ Static path verified |

## Agent interaction controls

| Control | Expected behavior | Verification status |
|---|---|---|
| Agent panel message inputs | Send manual message to selected agent | ✅ Backend manual flow verified; UI click E2E pending |
| Approval buttons (bash/tools) | Emits approval decision to pipeline control | ✅ Static path verified; scenario-based E2E pending |
| Security findings actions | Send to C / dismiss / deploy-after-audit flows | ✅ Static path verified; scenario E2E pending |

## Non-UI runtime checks executed

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

## Recommendation to truly satisfy "every textbox/button" requirement

Add browser E2E automation (Playwright) and execute scripted click/type assertions for all controls listed above. Without that harness, CLI/API-level verification can prove backend functionality and state propagation, but not every DOM interaction edge-case.

---

## Rebase-recovery pass (2026-04-24)

- Reconfirmed script-backed controls/functions after branch recovery:
  - model/provider dropdown data flow via `scripts/test-models.mjs` and `scripts/test-chat-manual-provider-switch.mjs`
  - manual send route across real CLI providers via `scripts/test-chat-provider-smoke.mjs`
  - server error surfacing/logging via `scripts/test-chat-logging.mjs`
  - HTTP provider shim behavior via `scripts/test-http-runner.mjs`
- Updated Squad provider status layout so model-status text does not render inline with margin-left offsets near scroll boundaries.

**Note:** true pixel-perfect UI interaction for every textbox/button still requires browser automation (Playwright/Cypress) or manual QA. Current scripts validate backend function wiring and API behavior for those controls.

### Wiring audit script coverage

`npx tsx scripts/test-ui-control-wiring.mjs` currently reports:

- `src/app/page.tsx`: buttons=6 (onClick=6), selects=7 (onChange=7), inputs=2 (onChange=2), textareas=2 (onChange=2)
- `src/app/squad/page.tsx`: buttons=5 (onClick=5), selects=7 (onChange=7), inputs=2 (onChange=2), textareas=2 (onChange=2)

This confirms handler wiring exists for all currently enumerated core interactive controls in both pages.

### Route-backed button coverage

The following button-driven route behaviors are now script-verified:

- Start pipeline -> `scripts/test-pipeline-route-controls.mjs` (`/api/start-pipeline`)
- Stop pipeline -> `scripts/test-pipeline-route-controls.mjs` (`/api/stop-pipeline`)
- Resume pipeline -> `scripts/test-pipeline-route-controls.mjs` (`/api/resume-pipeline`)
- Approve/pause actions -> `scripts/test-pipeline-route-controls.mjs` (`/api/approve`)

### Extended route coverage

`npx tsx scripts/test-api-extended-routes.mjs` covers:
- `/api/plan`
- `/api/pending`
- `/api/pipeline-control` (invalid + supported actions)
- `/api/audit-action` (invalid action contract)
- `/api/reset` (manual + pipeline)

### Wiring audit latest snapshot (2026-04-25)

From latest `scripts/test-ui-control-wiring.mjs` run:

- `src/app/page.tsx`: buttons=27 (onClick=27), selects=3 (onChange=3), inputs=1 (onChange=1), textareas=3 (onChange=3)
- `src/app/squad/page.tsx`: buttons=19 (onClick=19), selects=2 (onChange=2), inputs=1 (onChange=1), textareas=1 (onChange=1)

This supersedes earlier counts recorded before UI/layout changes.
