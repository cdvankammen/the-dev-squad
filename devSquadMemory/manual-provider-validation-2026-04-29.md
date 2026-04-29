# Manual Provider Validation — 2026-04-29

## Real runs performed

### 1. Claude pipeline run via live server
- Server started locally with `npm run dev`
- Real supervisor message sent to `/api/chat` in pipeline mode:
  - "Make a tic tac toe game with a simple UI and reset button."
  - then: "start planning"

### Initial failure observed
- Pipeline started but Agent A failed immediately in planning.
- Actual error from real run:
  - `API Error (claude-opus-4-6): 400 The provided model identifier is invalid`
- Root cause:
  - pipeline mode was not propagating selected model/provider
  - orchestrator and chat route still used hardcoded Claude model IDs

### Fixes applied after real run
- threaded selected `model` / `provider` through:
  - `src/lib/use-pipeline.ts`
  - `src/app/api/start-pipeline/route.ts`
  - `src/lib/pipeline-control.ts`
  - `src/app/api/state/route.ts`
  - `pipeline/orchestrator.ts`
  - `src/app/api/chat/route.ts`
- switched Claude defaults to model IDs that actually work in this environment:
  - `us.anthropic.claude-sonnet-4-5-20250929-v1:0`
  - `us.anthropic.claude-opus-4-1-20250805-v1:0`

### Second Claude failure observed
- Planner began but tried to read wrong file paths and then attempted blocked Bash.
- Root cause:
  - research prompt referenced template/checklist implicitly instead of using exact project paths

### Fix applied
- updated planning prompt builder to reference exact absolute project file paths:
  - `build-plan-template.md`
  - `checklist.md`

### Result after fixes
- Claude real run progressed through:
  - concept capture
  - planning research
  - plan writing
  - plan self-review
  - plan approval by B
  - coder C start
- New downstream issue discovered:
  - Tester D drifts into problematic test behavior:
    - tries unsupported MCP/browser tools
    - tries writing files even though D is read-only
    - runs brittle inline Node scripts
  - This is a real remaining bug in the testing phase/prompting/guardrail strategy.

## Additional real issue discovered
- Reusing the same concept reuses the same project directory slug under `~/Builds/...`
- That can pollute later runs with stale `plan.md` or other artifacts.
- This affected repeated provider tests and should be addressed explicitly.

## 2. OpenCode direct execution validation
- Verified local OpenCode is installed.
- Real command executed successfully:
  - `TERM=dumb opencode run 'reply with the word OK' --format json --pure --model opencode/gpt-5-nano --dir "$PWD"`
- Observed real JSON event stream with:
  - `step_start`
  - `text`
  - `step_finish`
- This confirms OpenCode can be driven programmatically on this machine.

## 3. LM Studio connectivity validation
- Real endpoints confirmed reachable at `10.2.0.90:1234`
- Verified both:
  - `GET /v1/models`
  - `GET /api/v1/models`
- Live app endpoint `/api/models?provider=lm-studio` now returns discovered models from that host.

## 4. LM Studio pipeline validation (real, live)
- Real provider-config saved through the app route:
  - provider: `lm-studio`
  - host: `10.2.0.90`
  - port: `1234`
- Real supervisor concept + `start planning` commands sent through `/api/chat`

### LM Studio failure sequence observed
1. initial failure: shim path resolved relative to build dir instead of repo root
2. next failure: copied shim wrappers missing generated runtime files
3. next failure: generated tool-registry expected generated JSON artifact

### Fixes applied
- copied local-provider shim assets from the `cli-changes` branch:
  - `scripts/http-runner-shim.mjs`
  - `scripts/json-repair.mjs`
  - `scripts/tool-registry.mjs`
  - generated runtime files
  - `src/lib/providerConfig.ts`
  - `src/app/api/provider-config/route.ts`
- fixed runner shim path resolution to use repo root, not build dir
- added generated tool-registry JSON artifact expected by runtime module

### Current LM Studio status
- Real LM Studio run now progresses into planning.
- Observed real planning events from Agent A:
  - `READ build-plan-template.md`
  - `READ checklist.md`
  - `SEARCH simple tic tac toe game implementation html css javascript`
  - `SEARCH CSS neon glow effect orange`
- This proves the LM Studio path is no longer failing immediately at startup and is reaching tool-use in the planning phase.
- It is slower than Claude and still needs longer observation to confirm full autonomous completion.

## Remaining high-priority work
1. make LM Studio run all the way through planning/review/coding/testing reliably
2. fix D/tester prompt/tool strategy so tests don’t drift into blocked or brittle actions
3. address stale project directory reuse for repeated runs with similar concepts
4. add visible host/port/api key fields in Office + Squad views
5. add proper queue/editable pending messages UX
6. expand provider list further (OpenWebUI, Ollama, CCR, OpenClaude, Open Claude Code) on this branch or follow-up branch
7. keep structured-output/JSON middle layer stable for local providers

## Additional fixes and findings later on 2026-04-29

### 5. LM Studio planning-write hardening
- The local-provider planning flow was carrying too much research context into the write step.
- Fix applied in `pipeline/orchestrator.ts`:
  - non-Claude providers now use a compact write-only planning turn based on the extracted research summary instead of always resuming the full research session.
- Additional local-provider runtime tuning added for LM Studio:
  - longer HTTP shim request timeout
  - lower retained session chars
  - lower tool-output retention

### 6. HTTP shim `Glob` bug found and fixed
- Real local-model run surfaced a `Glob error: Invalid regular expression: /^**/*$/: Nothing to repeat`.
- Root cause:
  - naive glob-to-regex conversion in `scripts/http-runner-shim.mjs` broke on normal patterns like `**/*`, `*`, and `**/*.md`.
- Fix applied:
  - replaced it with an explicit glob parser for `**`, `*`, and `?`
  - also skipped heavy directories during Glob traversal (`.git`, `.next`, `node_modules`, `.turbo`, `dist`, `build`, `coverage`)
- This also reduces the chance of runaway local scans that can spike machine load.

### 7. Tester D prompt drift reduced
- Real Claude run showed D trying:
  - browser/MCP tools
  - `open index.html`
  - brittle `node -e` scripts
  - writing helper files despite read-only rules
- Fixes applied:
  - tightened `pipeline/role-d.md`
  - tightened D testing prompts in `pipeline/orchestrator.ts`
- New doctrine for D:
  - Read + read-only Bash only
  - no ToolSearch/Web/MCP/browser tools
  - no GUI launching
  - no writing temp files
  - if multi-line logic is needed, use inline heredoc runtime checks only

### 8. Provider connection UI added
- Added visible saved provider connection controls to both Office and Squad provider sections:
  - host
  - port
  - API key (where applicable)
- Backed by:
  - local storage persistence (`src/lib/providerStorage.ts`)
  - `/api/provider-config`
- This replaces the need to configure LM Studio only through ad-hoc curl commands.

### 9. Page 500 / local crash cause identified
- Office and Squad temporarily returned 500, but the cause was NOT the new UI code itself.
- Actual root cause:
  - Turbopack tried to read `.vexp/daemon.sock` inside the repo and crashed with:
    - `Operation not supported on socket (os error 102)`
- Immediate local mitigation:
  - removing `.vexp/daemon.sock` restored page loads
- Durable local mitigation added:
  - `package.json` dev script now removes that socket before startup
  - dev server switched from Turbopack to webpack for stability on this machine

### 10. Provider discovery hangs hardened
- While broadening providers, Open WebUI discovery exposed that provider-model listing could block the whole Next server because it used synchronous child-process calls without a hard total timeout.
- Fixes applied in `src/lib/provider-catalog.ts`:
  - `execFileSync` provider probes now have a hard timeout
  - curl-based provider discovery now uses `--max-time`
  - Open WebUI default port changed away from app port `3000` to avoid self-recursive calls
  - added a self-call guard so provider discovery skips endpoints that point back at the Next app itself

### 11. Repeated concept directory pollution fixed
- Real rerun proved the same concept slug would reuse the same directory and inherit stale `plan.md`.
- Fix applied in `src/lib/pipeline-control.ts`:
  - fresh starts now allocate a new sibling directory (`-2`, `-3`, etc.) when a slug already exists
- Validation performed:
  - repeated concept now started at `/Users/.../make-a-tic-tac-toe-game-with-a-neon-oran-2`
  - stale `plan.md` was no longer silently reused

### 12. Provider catalog broadened on this branch
- Added provider options and discovery plumbing for:
  - Ollama
  - Open WebUI
  - OpenAI-Compatible
- `pipeline/runner.ts` now routes non-Claude HTTP-style providers through the same shim path.
- `/api/providers` now exposes them to the UI.
- Verified:
  - Ollama model discovery returned at least one model (`llama3.2:latest`) on this machine.
  - Open WebUI route now returns promptly instead of hanging, even when no server is configured.

### 13. LM Studio milestone reached after compact-write + fresh-dir fixes
- On the restarted webpack dev server, a real LM Studio run with:
  - provider: `lm-studio`
  - model: `google/gemma-4-e4b`
  - concept: neon-orange keyboard-accessible tic-tac-toe
- now progresses through:
  - planning research
  - compact write-only planning turn
  - actual `WRITE plan.md`
  - self-review
  - handoff from A to B
  - B review start
- Real evidence captured from the live project directory:
  - fresh directory: `.../make-a-tic-tac-toe-game-with-a-neon-oran-2`
  - `plan.md` exists
  - `plan.md` size ~7 KB
- This is the first strong proof on this branch that LM Studio is no longer dying in the planning write step for this workflow.

### 14. Per-agent model override path wired end-to-end
- The branch now carries per-agent model override plumbing through:
  - `src/lib/use-pipeline.ts`
  - `src/app/api/chat/route.ts`
  - `src/app/api/start-pipeline/route.ts`
  - `src/app/api/state/route.ts`
  - `src/lib/pipeline-control.ts`
  - `pipeline/orchestrator.ts`
- Resolution rule:
  - `agentModels[agent]` wins
  - otherwise provider/global selected model is used
- UI exposure added in both Office and Squad control areas as “Per-Agent Models” sections.
- This is not yet deeply live-validated across a full mixed-model run, but the plumbing and controls now exist on this branch.

## Important conclusion
- No, the app is **not** fully finished yet.
- However, real manual/live testing has already found and fixed multiple non-mock bugs:
  - model propagation into pipeline
  - invalid hardcoded Claude model IDs
  - planner path ambiguity for required project files
  - LM Studio shim path and generated-module boot failures
- The branch is now materially closer to the user's requested behavior and has real evidence, not just mock tests.
