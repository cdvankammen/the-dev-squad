# Dev Squad chat audit

Date: 2026-04-24

## Scope

This is a verification audit of the substantive implementation claims made in the pasted Copilot chat.
I did **not** try to validate every filler sentence literally word-for-word; I audited every meaningful claim about files, code paths, tests, providers, RAG, Docker, and UI behavior against the current repository.

## Verdict summary

### Verified true

- `devSquadMemory/` exists in the workspace and contains the research docs, embedding scripts, and vector artifacts.
- Local vector-memory files exist:
  - `devSquadMemory/workspace_docs.jsonl`
  - `devSquadMemory/workspace_vectors.jsonl`
  - `devSquadMemory/build_local_embeddings.py`
  - `devSquadMemory/query_helper.py`
  - `devSquadMemory/query_embed.py`
- Chat RAG injection exists in `src/app/api/chat/route.ts` and uses `src/lib/rag/localRetriever.ts`.
- Provider/model UI exists in both:
  - `src/app/page.tsx`
  - `src/app/squad/page.tsx`
- Provider/model APIs exist:
  - `src/app/api/providers/route.ts`
  - `src/app/api/models/route.ts`
  - `src/app/api/health/route.ts`
- Adapter files exist:
  - `src/lib/modelAdapters/claudeCliAdapter.ts`
  - `src/lib/modelAdapters/openClaudeCodeAdapter.ts`
  - `src/lib/modelAdapters/openClaudeAdapter.ts`
  - `src/lib/modelAdapters/openaiHttpAdapter.ts`
  - `src/lib/modelAdapters/lmStudioAdapter.ts`
- Docker support exists for the default Claude image and a second image file exists at `pipeline/Dockerfile.agent.occ`.
- Persistent server-side error logging exists in `src/lib/server-logging.ts` and `/api/chat` now returns JSON errors instead of crashing the client parser.

### Verified partially true

- **Model/provider switching exists, but only fully works for CLI-style providers**.
  - Working executable providers in the repo today: `claude-cli`, `occ`, `openclaude`.
  - `openai-http` and `lm-studio` existed only as discovery stubs, not executable runner providers.
- **Bedrock support is real**, but only when the runtime environment or Claude settings already contain the necessary Bedrock configuration.
  - This repo can surface/select configured Bedrock model IDs.
  - It cannot magically discover account-specific Bedrock availability without the same credentials/settings your local Claude/OpenClaude installation uses.
- **Model discovery existed**, but the original implementation over-parsed CLI output and produced junk model IDs. This was tightened during the audit.
- **Pipeline model selection existed**, but `/api/chat` pipeline turns were still hardcoded to `claude-opus-4-6`. This was fixed during the audit.

### Verified false before this audit

These claims were overstated or untrue when I checked the repo:

- “OpenAI HTTP / LM Studio are usable as runner providers.”
  - False before audit. Those adapters threw stub errors and silently fell back.
- “Provider fallback to `npx` is implemented for `occ` and `openclaude`.”
  - False before audit. The command detection used `spawn('which', ...)`, which does not validate exit codes, so the fallback logic was unreliable.
- “The repo build is good with the current workspace memory setup.”
  - False before audit. `devSquadMemory/.venv` broke `npm run build` because Turbopack traversed the workspace and hit invalid symlinks.
- “HTTP-runner shim exists.”
  - False. It was planned, not implemented.
- “Persistent retriever service using `RETRIEVER_URL` exists.”
  - False. It was described/planned, but `localRetriever.ts` still uses local JSONL + Python query embedding directly.
- “Top-k and snippet length are configurable via env vars.”
  - False. The current retriever path does not implement those env controls.

## Fixes applied during this audit

I corrected the most misleading issues while auditing:

- Fixed provider command detection and `npx` fallback logic.
- Marked direct HTTP adapters as discovery-only, not executable runner providers.
- Made `/api/chat` and `/api/start-pipeline` reject unsupported providers honestly instead of silently falling back.
- Made pipeline chat turns honor the selected model instead of always using `claude-opus-4-6`.
- Removed the build-breaking `devSquadMemory/.venv` and updated docs to avoid recreating that problem.
- Updated package test scripts to use `npx tsx` instead of unsupported `node --experimental-strip-types` flags.
- Tightened model-discovery parsing to reduce junk results.

## Remaining limitations

These are still not implemented:

- A real HTTP runner shim for OpenAI-compatible / LM Studio direct execution.
- A persistent retriever microservice (`RETRIEVER_URL`).
- Strong provider-specific model discovery for every backend.
- First-class direct pipeline execution against plain HTTP model endpoints.

## Practical conclusion

If you want this repo to behave truthfully today:

- Use `claude-cli`, `occ`, or `openclaude` as the actual executable providers.
- Use `openclaude` if you want LM Studio, Ollama, OpenRouter, Groq, DeepSeek, or other OpenAI-compatible/local backends.
- Use official Claude Code (`claude`) if you want native Bedrock support through Anthropic’s documented Bedrock flow.
