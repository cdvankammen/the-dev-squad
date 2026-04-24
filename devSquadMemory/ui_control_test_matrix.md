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
