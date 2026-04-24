# Provider + pipeline functionality answers (direct)

Date: 2026-04-24

## Q1) Is provider selection only UI, or truly used in backend?

It is used in backend.

Manual mode path:

1. UI sets `selectedProvider` / `selectedModel`
2. `usePipelineState.sendChat` sends `modelProvider` + `model`
3. `/api/chat` receives both and calls `streamClaude` with both
4. Runner resolves adapter from provider and spawns that provider

Pipeline mode path:

1. UI sends provider/model to `/api/start-pipeline`
2. `pipeline-control` stores selected provider/model in state
3. Orchestrator reads those values and uses them for runner spawn

## Q2) How does Dev Squad run "5 agents" and make them communicate?

- Orchestrator (`pipeline/orchestrator.ts`) runs a phased workflow.
- It spawns agent turns (`A/B/C/D/S`) as child processes via runner.
- Shared state/events are persisted in pipeline state JSON and emitted as timeline events.
- Communication between agents is not direct socket chat; it is mediated by orchestrator state + prompt/event handoff.

So concurrency/communication is coordinated process orchestration over shared state/events.

## Q3) How to achieve same with openclaude / occ?

Use `modelProvider` as:
- `openclaude` or
- `occ`

As long as that adapter emits Claude-compatible stream-json event lines, orchestration behavior remains the same (same state machine, same event pipeline).

## Q4) Can same outcome be achieved with LM Studio?

Yes, with the current implementation:
- `lm-studio` provider executes through HTTP runner shim (`scripts/http-runner-shim.mjs`)
- shim emits Claude-compatible stream-json events to the runner consumer

So LM Studio does not need to be a CLI tool; it can work as OpenAI-compatible HTTP backend.

## Q5) Is Claude Code Router (`ccr`) usable?

Now added as provider option (`ccr`).

Discovery works and manual provider smoke requests return 200. Stream detail/parity still depends on ccr version/profile and wrapper output shape.

## Q6) Where are provider/model choices decided in code?

- UI state:
  - `src/app/page.tsx`
  - `src/app/squad/page.tsx`
- Manual send payload:
  - `src/lib/use-pipeline.ts`
- Manual chat API:
  - `src/app/api/chat/route.ts`
- Pipeline start:
  - `src/app/api/start-pipeline/route.ts`
  - `src/lib/pipeline-control.ts`
- Pipeline execution:
  - `pipeline/orchestrator.ts`
  - `pipeline/runner.ts`
- Adapter mapping:
  - `src/lib/modelAdapters/index.ts`

## Q7) How are available models chosen?

1. Provider-specific adapter discovery (`discoverModels()`)
2. If discovery empty/fails, provider-specific fallback list in UI/API
3. Optional discovered-only mode can force strict discovered list

Key route:
- `src/app/api/models/route.ts`

## Q8) Offline provider goal status

Goal: allow offline/local providers without losing core orchestration behavior.

Current status:
- Achieved for HTTP-compatible local backends (LM Studio path) via shim.
- Achieved for CLI wrappers that conform to expected stream-json event shape.
- Remaining risk is wrapper-specific output/flag compatibility, not orchestrator design.
