# Providers, terminals, Docker, Bedrock, and local models

Date: 2026-04-24

## How Dev Squad actually runs agents

Dev Squad does **not** literally open 5 visible terminal windows in your macOS desktop.

It creates **child processes** from the Next.js server/runtime:

- Manual chat mode: `/api/chat` -> `streamClaude(...)` -> `runner.spawn(...)`
- Pipeline mode: `/api/start-pipeline` -> `pipeline/orchestrator.ts` -> `runClaudeTurn(...)` -> `runner.spawn(...)`

Those spawned children are either:

- **Host processes** (`claude`, `occ`, `openclaude`) on your machine, or
- **Docker container processes** running the agent CLI inside a container

So the real mental model is:

- one Dev Squad web UI
- one Next.js app/server
- multiple child agent processes
- optional Docker isolation for some agents
- streamed JSON events written back into pipeline/manual state files

## What the Docker container is for

The Docker runner exists to isolate some agents from your main host machine.

Current design:

- `pipeline/runner.ts` has `HostRunner`, `DockerRunner`, and `AutoRunner`
- `AutoRunner` prefers Docker for some agents (`C` and `D`) when Docker is available
- `pipeline/Dockerfile.agent` installs the official Claude Code CLI in a Node image
- `pipeline/Dockerfile.agent.occ` installs official Claude Code plus `occ` and `openclaude`

Why Docker exists:

- keep certain agent runs isolated
- control mounts and credentials
- make network policy/firewall behavior more predictable
- separate some build/test operations from your host shell

What Docker is **not** doing:

- it is not rendering GUI terminal windows
- it is not the same as “5 tabs opened for me”
- it does not by itself solve provider auth unless the needed credentials are mounted into the container

## How current Dev Squad uses Claude Code

The core runner logic is in:

- `pipeline/runner.ts`
- `pipeline/orchestrator.ts`
- `src/app/api/chat/route.ts`

The important parts:

1. `buildClaudeArgs(...)` builds Claude-Code-style CLI arguments:
   - `-p <prompt>`
   - `--model <model>`
   - `--output-format stream-json`
   - `--system-prompt` or `--system-prompt-file`
   - `--resume`
   - `--effort`
   - `--json-schema`

2. `HostRunner.spawn(...)` launches a provider adapter or falls back to `claude`
3. `DockerRunner.spawn(...)` launches `docker run ... <agent image> <agent cmd> ...`
4. `streamClaude(...)` / `runClaudeTurn(...)` read line-delimited JSON from stdout and append structured events back into state files

That means Dev Squad is built around a **Claude-Code-like CLI contract**:

- stream JSON events
- support prompts, system prompts, resume IDs, model selection
- perform tool-using coding turns

## Which providers actually work today

### Fully usable as executable runner providers

- `claude-cli`
- `occ` (`@ruvnet/open-claude-code`)
- `openclaude` (`@gitlawb/openclaude`)

### Present in the codebase, but discovery-only / not executable runners

- `openai-http`
- `lm-studio`

Why those two are not first-class runners yet:

- Dev Squad expects a Claude-Code-like tool loop and stream-json process contract
- plain OpenAI-compatible chat endpoints do not automatically provide that same process/runtime contract
- the earlier chat planned an HTTP runner shim, but that shim is still not implemented

## Best design for offline/local models

If you want local/offline or OpenAI-compatible providers, the best current design is:

### Use `openclaude` as the Dev Squad provider

Then point OpenClaude at:

- LM Studio
- Ollama
- OpenRouter
- Groq
- DeepSeek
- other OpenAI-compatible endpoints
- Bedrock / Vertex / Foundry where OpenClaude supports them

Why this is the best current route:

- OpenClaude already provides the CLI/tool-agent layer Dev Squad expects
- Dev Squad only needs to spawn `openclaude`
- OpenClaude handles the provider-routing problem for you

## Recommended setups

### 1. Official Claude Code with Bedrock

Best when you want the official Claude Code behavior and native Bedrock support.

Official docs confirm Claude Code on Bedrock supports:

- AWS credentials
- AWS profiles / SSO
- Bedrock API keys (`AWS_BEARER_TOKEN_BEDROCK`)
- pinned model IDs and model picker configuration
- startup checks against accessible Bedrock models

Key env/settings from Anthropic docs:

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1
# plus one of:
export AWS_BEARER_TOKEN_BEDROCK=your-bedrock-api-key
# or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
```

Use Dev Squad provider: `claude-cli`

### 2. OpenClaude with LM Studio / Ollama / OpenAI-compatible endpoints

Best when you want a Claude-Code-like CLI but backed by your own/local models.

Examples from OpenClaude upstream docs:

```bash
# OpenAI-compatible / LM Studio / OpenRouter style
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:1234/v1
export OPENAI_MODEL=your-model-name
openclaude
```

```bash
# Ollama example from upstream docs
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b
openclaude
```

Use Dev Squad provider: `openclaude`

### 3. Open Claude Code (`occ`)

Best when you specifically want the `occ` reimplementation and its multi-provider CLI behavior.

Upstream docs show:

```bash
npm install -g @ruvnet/open-claude-code
occ -m claude-opus-4-6 "hello"
```

Also documented upstream:

```bash
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... occ -m bedrock/claude-sonnet "hello"
```

Use Dev Squad provider: `occ`

## Can Dev Squad discover Bedrock models automatically?

### Short answer

Only if the runtime environment already has access to the same Bedrock config/credentials.

### What that means in practice

To show Bedrock-related models in Dev Squad, one of these must already be true:

- your official Claude Code settings already pin / expose models
- your shell exports Bedrock-related env vars
- your OpenClaude / OCC runtime is already configured with provider access
- the Docker container also receives those credentials/settings if Docker is used

Without that, Dev Squad cannot know which Bedrock models your account is allowed to invoke.

## Why the model list can change over time

The model list is a best-effort discovery result. It can change because:

- provider CLI discovery returns nothing
- local env vars changed
- `~/.claude/settings.json` changed
- the selected provider is discovery-only / unsupported
- the provider backend itself is unreachable

During this audit, discovery parsing was tightened and the UI was adjusted so it does not silently oscillate as badly as before.

## Practical recommendation

If your goal is “Claude-Code-style agent team, but using my own models”:

### Best current answer

Use:

- Dev Squad provider: `openclaude`
- OpenClaude backend: LM Studio / Ollama / OpenAI-compatible server / Bedrock

That gives you the closest thing to “same Dev Squad workflow, different underlying models” without needing Dev Squad itself to re-implement the full Claude Code tool runtime over raw HTTP.

## What is still missing

The repo still does **not** have:

- a real HTTP runner shim for plain OpenAI-compatible endpoints
- a first-class direct LM Studio runner that can replace Claude-Code-style CLI sessions in pipeline mode
- exact provider-aware Bedrock discovery without the relevant credentials/settings

So today:

- use `claude-cli` for official Claude Code
- use `openclaude` for LM Studio/Ollama/OpenAI-compatible/local-routing scenarios
- use `occ` if you prefer that CLI
