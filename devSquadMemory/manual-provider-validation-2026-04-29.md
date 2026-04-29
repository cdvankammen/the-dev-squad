# LM Studio / Universal JSON Middle-Layer Validation — 2026-04-29

## What worked
- LM Studio at `10.2.0.90:1234` is reachable and exposes models successfully.
- The pipeline can now run end-to-end against LM Studio when using the HTTP shim bridge.
- A fresh LM Studio-backed run completed the full chain:
  - A: research / planner pass
  - B: review / question round
  - C: coding handoff
  - D: test rounds
  - E: security audit
- The run completed with `BUILD COMPLETE` after the tester/auditor finished.
- The planner self-review / write step now needs a real `plan.md` file, and the shim can materialize it.
- The new `/api/providers` and `/api/models` routes return live provider metadata and discovered model lists.
- OpenCode model discovery works end-to-end through the new model route.
- Open WebUI is exposed as a provider option and the model route is reachable, even though it returned an empty model list in the current local environment.
- Claude Code Router and OpenClaude Code are also exposed through the provider route; both model routes are reachable, but they returned empty model lists in this environment because no live endpoint was configured yet.
- The office and squad views now both have per-agent model dropdowns and editable pending-message queues.
- The provider runtime hook now persists selected provider, model, working directory, host, port, base URL, API key, and agent model overrides.

## What was broken before the fix
- Manual chat mode could return an empty/invalid response body, causing `res.json()` to crash in the UI.
- The pipeline runner always fell back to the Claude CLI path, so LM Studio provider selection never actually affected live runs.
- The repository did not have a usable `scripts/http-runner-shim.mjs` in the active branch state, so provider runs failed with module-not-found.
- Without a generated `plan.md`, Agent B/C/D could not complete their review/test loops and the run stalled.

## Fixes added locally
- `src/lib/use-pipeline.ts`
  - Added safe JSON parsing for empty/non-JSON responses.
  - Threaded `provider`, `workingDir`, and `agentModels` through chat/start-pipeline requests.
- `src/app/api/chat/route.ts`
  - Manual mode now accepts provider + working directory.
  - Added workspace guard prompts.
  - Added opencode direct-chat path.
- `pipeline/runner.ts`
  - Provider-aware host routing for HTTP-compatible providers.
  - Opencode direct CLI routing.
- `scripts/http-runner-shim.mjs`
  - Added a minimal HTTP provider bridge that can call LM Studio / OpenAI-compatible endpoints.
  - Emits Claude-like JSON events.
  - Auto-writes `plan.md` during the planner write step so the orchestrator can continue.
- `src/lib/pipeline-control.ts` / `pipeline/orchestrator.ts`
  - Added model/provider/workspace persistence and environment handoff.
- `src/app/api/providers/route.ts` / `src/app/api/models/route.ts`
  - Added API endpoints for provider discovery and dynamic model discovery.
- `src/lib/use-provider-runtime.ts`
  - Added shared client-side provider/model/runtime persistence and dynamic loading.
- `src/app/page.tsx` / `src/app/squad/page.tsx`
  - Added dynamic provider/model dropdowns, HTTP connection fields, refresh action, per-agent model selectors, and editable message queues.

## Notes / caveats
- The current shim is a minimal bridge. It proves the pipeline path works, but it is not yet a full tool-calling loop.
- For broader provider support, the next step is a richer middle layer that can execute tool calls, file writes, and bash actions more like Claude Code CLI.
- Open WebUI needs a real endpoint + API key to return model lists; the UI now exposes the required host/port/api-key fields so it can be configured when that server is available.
- The provider UI now writes config locally and posts HTTP-provider settings to the `/api/provider-config` route so the backend and frontend stay aligned.

## Recommended next work
1. Expand the HTTP shim into a real tool loop for LM Studio/Ollama/OpenWebUI.
2. Validate Claude Code Router and OpenClaude Code against the same provider route and settings flow.
3. Add a stronger working-directory contract that is enforced inside the agent prompts and the runtime wrapper.
4. Decide whether Open WebUI should use a dedicated auth/header helper beyond the generic API key field.
5. Keep testing the live LM Studio path after future middle-layer changes so we do not regress the chat/planner/supervisor behavior.

