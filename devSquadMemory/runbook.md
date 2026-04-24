# Dev Squad memory and provider runbook

Date: 2026-04-24

## 1. Run the web app

```bash
cd /Users/stillbulldog35/Documents/personalGithub/the-dev-squad
npm install
npm run dev
```

Open:

- Office view: `http://localhost:3000/`
- Squad view: `http://localhost:3000/squad`

## 2. Run the core checks

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
npm run test:runner
npm run test:hook
npm run test:runtime
npm run test:planning
npm run test:supervisor
npm run test:supervisor-concept
npm run test:supervisor-intents
```

## 3. Build the local vector memory

Install Python deps into your user environment:

```bash
python3 -m pip install --user -r devSquadMemory/requirements.txt
```

Build the vector files:

```bash
python3 devSquadMemory/build_local_embeddings.py
```

This writes:

- `devSquadMemory/workspace_docs.jsonl`
- `devSquadMemory/workspace_vectors.jsonl`

## 4. Query the local vector memory

```bash
python3 devSquadMemory/query_helper.py --query "how does the runner spawn claude" --topk 5
```

## 5. How chat RAG currently works

When you send a chat message through `/api/chat`:

1. `src/app/api/chat/route.ts` calls `retrieve(...)`
2. `src/lib/rag/localRetriever.ts` loads the JSONL vectors and docs
3. `localRetriever.ts` calls `devSquadMemory/query_embed.py`
4. retrieved snippets are prepended to the prompt as `[RETRIEVED SOURCES]`

There is **not** currently a separate retriever microservice.

## 6. Check provider/model APIs

```bash
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-models.mjs openai-http
npx tsx scripts/test-models.mjs lm-studio
npx tsx scripts/test-chat-logging.mjs
npx tsx scripts/test-start-pipeline.mjs
```

## 7. Use the real executable providers

### Claude Code CLI

Use provider: `claude-cli`

Requirements:

- `claude` installed and logged in
- or Claude Code configured for Bedrock if you use Bedrock

### Open Claude Code (`occ`)

Use provider: `occ`

Install or rely on `npx`:

```bash
npm install -g @ruvnet/open-claude-code
# or
npx @ruvnet/open-claude-code --help
```

### OpenClaude

Use provider: `openclaude`

Install or rely on `npx`:

```bash
npm install -g @gitlawb/openclaude
# or
npx @gitlawb/openclaude --help
```

This is the recommended route for LM Studio / Ollama / OpenAI-compatible backends.

## 8. LM Studio / OpenAI-compatible backends

Use `openclaude` as the Dev Squad provider and point OpenClaude at your backend.

Example:

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:1234/v1
export OPENAI_MODEL=your-model-name
openclaude
```

Then choose provider `openclaude` inside the Dev Squad UI.

## 9. Bedrock with official Claude Code

Official Claude Code supports Bedrock.

Typical env-based setup:

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1
export AWS_BEARER_TOKEN_BEDROCK=your-bedrock-api-key
```

Or use AWS credentials/profile instead of the bearer token.

Then choose provider `claude-cli` inside the Dev Squad UI.

## 10. Docker agent image

Default image:

```bash
docker build -t dev-squad-agent:latest -f pipeline/Dockerfile.agent pipeline/
```

Alternative image with `occ` and `openclaude` installed:

```bash
docker build -t dev-squad-agent:occ -f pipeline/Dockerfile.agent.occ pipeline/
export PIPELINE_DOCKER_AGENT_IMAGE=dev-squad-agent:occ
```

## 11. Known limitations

- `openai-http` and `lm-studio` are discovery-only in this repo right now, not executable runner providers
- no HTTP runner shim yet
- no persistent retriever service yet
- provider discovery depends on your actual local config/credentials
