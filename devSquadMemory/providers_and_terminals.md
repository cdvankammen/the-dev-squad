# Providers, terminals, and concurrency behavior

Date: 2026-04-24

## How Dev Squad runs “5 agents”

Dev Squad does not require 5 separate macOS Terminal windows.

It runs multiple child processes from Node:

- Manual/API flows: process per run via `createRunner('host').spawn(...)`
- Pipeline flows: orchestrator spawns per-phase/per-agent runs
- Docker mode: same idea, but process runs inside container

So the “5 at once” behavior is concurrent process/session orchestration, not necessarily 5 visible terminals.

## Where provider/model selection actually happens

### Manual mode

1. UI dropdowns set `selectedProvider` and `selectedModel`
2. `usePipelineState.sendChat` sends both in POST `/api/chat`
3. `/api/chat` passes `modelProvider` and `model` to `streamClaude`
4. `runner.ts` resolves adapter from provider and spawns matching CLI/shim

### Pipeline mode

1. UI start action sends provider/model in POST `/api/start-pipeline`
2. `pipeline-control` stores them in staging state
3. `pipeline/orchestrator.ts` reads `state.selectedProvider` / `state.selectedModel`
4. Runner uses those values for all subsequent agent spawns

## Current provider options

- `claude-cli`
- `ccr` (Claude Code Router)
- `occ` (Open Claude Code)
- `openclaude`
- `openai-http`
- `lm-studio`

## Provider execution reality (current env snapshot)

- `claude-cli`: available on host
- `ccr`: available on host; discovery works; manual provider smoke calls succeed (200). Output format can still vary by ccr profile/version.
- `occ`: available on host; discovery works; assistant stream may be sparse/non-standard depending env/profile
- `openclaude`: available and executed successfully in smoke tests
- `openai-http`: executable via HTTP shim
- `lm-studio`: executable via HTTP shim


## Host-installed tool snapshot (this machine)

Command checks run:

```bash
which claude
which ccr
which occ
which openclaude
which ollama
which lmstudio
```

Observed paths in this environment:

- `claude` -> `/Users/stillbulldog35/.local/bin/claude`
- `ccr` -> `/opt/homebrew/bin/ccr`
- `occ` -> `/opt/homebrew/bin/occ`
- `openclaude` -> `/opt/homebrew/bin/openclaude`
- `ollama` -> `/usr/local/bin/ollama`
- `lmstudio` -> not found on PATH (HTTP endpoint mode still possible)

## Can LM Studio work without a CLI wrapper?

Yes.

`lm-studio` provider is implemented through an OpenAI-compatible HTTP shim, so it does **not** require a Claude-compatible CLI binary to execute.

## Can Claude Code Router be used as provider?

Yes, now wired as `ccr` provider.

Notes:
- It is wrapper-driven, so CLI behavior depends on your ccr version and how it forwards arguments/output.
- Discovery and execution are treated separately; discovery can work even if execution stream format needs adjustment.

## Bedrock answer

Yes, Bedrock-backed model identifiers can be used with CLI wrappers if runtime AWS/provider auth is valid in the environment that executes the process (host or container).

Without valid credentials/profile, discovery can still show configured IDs while execution fails.
