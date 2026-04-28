# Done

## TASK-001: make it so that other providers work with theDevSquad in pipeline mode
**Priority:** P0 | **Assignee:** me
**Updated:** 2026-04-28 10:20

all providers must be able to work with the 5 agents, send their thoughts and actions to the llm provider and be able to choose the avilable models from a drop down which i choose. as well as be able to choose bot models

### Plan
- Audit the full provider execution chain (UI → API → pipeline state → orchestrator → runner → adapter/provider) and close any remaining parity gaps that still make non-Claude providers fail in pipeline mode.
- Harden the HTTP-backed local-provider path so LM Studio, Ollama, OpenAI-compatible, and CCR-routed local models can sustain multi-turn 5-agent runs: normalize tool outputs, normalize resumed session history, and enforce pipeline guardrails/approval behavior consistently.
- Keep provider/model selection authoritative and visible: preserve per-provider and per-agent choices across reloads, surface the exact resolved endpoint used for discovery/execution, and ensure dropdown choices remain aligned with the active provider.
- Verify behavior with targeted smoke runs and Playwright coverage, then move the task to Done when pipeline-mode provider parity is implemented and validated locally.

### Completed
- Persisted provider/model/per-agent selections end-to-end from UI → API → pipeline state → orchestrator.
- Added per-agent model dropdown wiring so each agent can use its own selected model.
- Hardened the HTTP runner shim for local providers: fresh follow-up turns for fragile providers, resumed-history normalization, noisy tool-name normalization, directory-safe reads, and non-string tool payload handling.
- Mirrored important pipeline guardrails for HTTP-backed providers so local runs respect agent write/bash restrictions.
- Fixed LM Studio pipeline regressions: correct shim path resolution from build directories, endpoint-consistent model discovery, stale smoke-project cleanup, and crash-free plan/write/review progression in smoke runs.
- Improved provider health reporting and remediation helpers; OCC now reports unavailable when the CLI exists but Anthropic/AWS/Bedrock credentials are not visible to the dev server.
- Validated locally with typecheck, targeted Playwright provider persistence tests, HTTP runner integration tests, provider-selection scripts, wrapper-CLI smoke (CCR/OpenClaude healthy here; OCC requires external credentials), and LM Studio pipeline smoke that now advances into plan writing/review instead of failing on resume/template errors.
