# Providers, terminals, Docker, and local model routing

Date: 2026-04-24

## How Dev Squad actually runs agents (important)

Dev Squad does **not** create five macOS Terminal.app windows by default.

It creates child processes via Node (`runner.spawn(...)`):

- In host mode: each agent turn is a child process on your machine.
- In docker mode: each agent turn is a process inside a container.

So “5 terminals” means up to ~5 concurrent **agent processes/sessions**, not necessarily five visible terminal windows.

## Where this happens in code

- Runner selection/spawn: `pipeline/runner.ts`
- Pipeline orchestration: `pipeline/orchestrator.ts`
- Chat/manual execution path: `src/app/api/chat/route.ts`
- Pipeline start wiring: `src/app/api/start-pipeline/route.ts` → `src/lib/pipeline-control.ts`

## Supported providers (current)

Configured by `modelProvider` (manual chat + pipeline start).

- `claude-cli`
- `occ` / `open-claude-code`
- `openclaude`
- `openai-http`
- `lm-studio`

Provider mapping lives in: `src/lib/modelAdapters/index.ts`

## Current execution behavior by provider

### claude-cli
- Direct CLI execution path (Claude Code CLI).

### occ (open-claude-code)
- Adapter executes `occ` binary if present, otherwise `npx @ruvnet/open-claude-code`.
- Discovery works in this environment.
- Runtime success depends on provider auth/config (Bedrock/Anthropic/etc.).

### openclaude
- Adapter executes `openclaude` binary if present, otherwise `npx @gitlawb/openclaude`.
- Discovery and execution smoke-tested successfully in this environment.

### openai-http
- Now executable via `scripts/http-runner-shim.mjs`.
- Uses OpenAI-compatible `/v1/chat/completions`.
- Can point to OpenAI, OpenRouter-like, local gateways, etc.

### lm-studio
- Now executable via same HTTP shim.
- Uses `LM_STUDIO_BASE_URL` (or `OPENAI_BASE_URL`) and OpenAI-compatible API shape.

## Bedrock note (your specific setup)

Yes, Bedrock can work, but discovery/execution require the environment where Dev Squad runs to have working Bedrock credentials/config.

Typical requirements:

- AWS creds/profile available to the runtime (host process or container)
- Provider/model string valid for the adapter path you are using
- Network access and IAM permissions for Bedrock model listing/inference

If these are missing, discovery may still show configured model IDs (from settings/env), but execution will fail at runtime.

## Docker behavior

Docker mode uses configurable image/command in runner:

- `PIPELINE_DOCKER_AGENT_IMAGE`
- `PIPELINE_DOCKER_AGENT_CMD`

Image variant with `occ` + `openclaude` is available:

- `pipeline/Dockerfile.agent.occ`

Credential/mount setup guidance is documented in:

- `docs/docker-credentials.md`

## Should you use OpenClaude as router or direct endpoints?

You have three viable paths:

1. **OpenClaude router** (`modelProvider=openclaude`)
   - Best when you want provider/profile routing managed by OpenClaude.

2. **Direct OpenAI-compatible endpoint** (`modelProvider=openai-http`)
   - Best for OpenAI/OpenRouter/compatible hosted endpoints.

3. **LM Studio direct** (`modelProvider=lm-studio`)
   - Best for local/offline model serving with OpenAI-compatible API.

All three are now wired in this repo.

## Quick verification commands

```bash
# Discovery checks
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-models.mjs openai-http
npx tsx scripts/test-models.mjs lm-studio

# HTTP-provider execution compatibility (mock server)
npx tsx scripts/test-http-runner.mjs

# CLI provider execution snapshot
npx tsx scripts/test-cli-adapters.mjs
```
