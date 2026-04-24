<todos title="RAG improvements and retrieval service" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [ ] add-local-retriever-service: Implement a persistent local retrieval microservice (Python FastAPI) that loads devSquadMemory/workspace_vectors.jsonl, computes query embeddings using the same sentence-transformers model used to build vectors, returns top-k results via POST /query, provides /reindex and /health endpoints; integrate src/lib/rag/localRetriever.ts to call this service (env var RETRIEVER_URL); fallback to existing spawn-Python method if service unreachable. 🔴
  _Python FastAPI + sentence-transformers, keep vectors in memory as numpy array; optional Faiss index for larger datasets; listen on localhost by default._
- [x] wire-model-adapter-factory: Implement src/lib/modelAdapters/index.ts to return a ModelAdapter instance for a requested provider and wire pipeline/runner.ts HostRunner.spawn() to use the adapter when available; fall back to claude CLI if adapter missing or spawn fails. 🔴
  _Adapter factory maps 'claude-cli' -> ClaudeCliAdapter, 'openai-http' -> OpenAIHttpAdapter; keep behavior backward-compatible._
- [x] implement-open-claude-code-adapter: Add OpenClaudeCodeAdapter at src/lib/modelAdapters/openClaudeCodeAdapter.ts to spawn occ binary or fall back to npx @ruvnet/open-claude-code when occ is not installed on PATH. 🔴
  _Adapter prefers installed occ, falls back to npx; conforms to ModelAdapter.spawn ChildProcess contract._
- [x] implement-openclaude-adapter: Add OpenClaudeAdapter at src/lib/modelAdapters/openClaudeAdapter.ts to spawn openclaude binary or fall back to npx @gitlawb/openclaude when not installed on PATH. 🔴
  _Adapter prefers installed openclaude, falls back to npx; conforms to ModelAdapter.spawn ChildProcess contract._
- [ ] tune-rag-params: Expose top-k and snippet length as env vars (RETRIEVER_TOP_K, RAG_SNIPPET_LEN) and make defaults configurable in src/lib/rag/localRetriever.ts and in src/app/api/chat/route.ts. 🟡
- [ ] limit-rag-per-agent: Add per-agent and per-phase toggles so RAG runs only when enabled; update src/app/api/chat/route.ts to consult agent config before calling retriever. 🟡
- [ ] test-and-validate: Add integration tests and manual test scripts for the retriever service; measure latency and memory; validate fallback path. 🔴
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
