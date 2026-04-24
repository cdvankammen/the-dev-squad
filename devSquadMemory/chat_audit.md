# Dev Squad chat audit (latest)

Date: 2026-04-24

## Scope

This audit re-checks the substantive implementation claims from the pasted Copilot conversation against the current repository state.

I audited meaningful claims (code paths, files, provider behavior, tests, RAG, Docker, UI state), not literal filler wording.

## Verdict summary

## Verified true

- `devSquadMemory/` exists in-workspace and contains research/docs/scripts/vector artifacts.
- Local vector-memory artifacts exist and are queryable (`workspace_docs.jsonl`, `workspace_vectors.jsonl`, embed/query scripts).
- Chat RAG injection is active (`src/app/api/chat/route.ts` + `src/lib/rag/localRetriever.ts`).
- Provider/model APIs and UI controls exist in Office + Squad views.
- Adapter routing exists for `claude-cli`, `occ`, `openclaude`, `openai-http`, `lm-studio`.
- Server-side JSON error handling/logging is present for `/api/chat`.
- Pipeline start persists selected provider/model into staging and orchestrator uses it.

## Verified true after fixes in this pass

- `openai-http` and `lm-studio` are now executable providers (not discovery-only) via:
  - `scripts/http-runner-shim.mjs`
  - `src/lib/modelAdapters/openaiHttpAdapter.ts`
  - `src/lib/modelAdapters/lmStudioAdapter.ts`
- Provider `type:"error"` events are now surfaced (not silently ignored):
  - `src/app/api/chat/route.ts`
  - `pipeline/orchestrator.ts`
- HTTP execution compatibility is validated using a local mock OpenAI-compatible server:
  - `scripts/test-http-runner.mjs`

## Verified partially true

- Bedrock support: possible and wired through provider selection, **but requires runtime AWS/provider credentials/config** in the host/container environment.
- Provider discovery: works, but may include configured model IDs even if backend connectivity/auth is not currently valid.

## Still not implemented / still optional

- Persistent retriever microservice (`RETRIEVER_URL`) remains optional/not required for current RAG path.
- Full provider-specific model catalog fidelity depends on each upstream CLI/API behavior.

## Execution snapshot from latest tests

- `openclaude`: execution smoke test succeeded.
- `occ`: discovery works; execution returned provider auth error in this environment for tested path.
- `openai-http` + `lm-studio`: execution compatibility verified through local mock HTTP backend.

## Practical conclusion

Today’s repo is now coherent for:

- CLI providers (`claude-cli`, `occ`, `openclaude`)
- HTTP-compatible providers (`openai-http`, `lm-studio`) via shim
- Manual + pipeline provider/model selection
- In-workspace RAG/vector memory usage

Final runtime success for cloud/backed providers still depends on your actual credentials/endpoints.
