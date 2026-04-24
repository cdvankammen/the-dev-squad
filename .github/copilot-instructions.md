<<<<<<< Updated upstream
<<<<<<< Updated upstream
<todos title="model-discovery-enhancements" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] add-discovered-only-toggle: Implement 'discovered-only' toggle in model selection UI that forces replacement of fallback list with discovered models; update Office and Squad pages, persist setting in localStorage, and add unit tests 🟡
  _Default preserves existing fallback; toggle enables strict discovered-only replacement; store preference in localStorage and include in pipeline payloads._
- [-] add-discovery-spinner-ux: Add optional spinner/UX to wait for discovery before showing models; add preference to choose spinner delay or immediate fallback; update tests 🟡
- [ ] implement-http-runner-shim: Create HTTP-runner shim enabling pipelines to use HTTP-backed models (LM Studio/OpenAI) with streaming support and config; update orchestrator to accept provider+model selections 🔴
- [ ] run-provider-tests: Run discovery tests for openclaude, lm-studio, openai-http, and occ locally; document required env vars and fix runtime issues discovered 🟡
- [ ] fix-bugs-along-the-way: Fix any bugs discovered during implementation and tests; run type checks and update CI/README 🔴
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
<todos title="embeddings-and-local-vector-db" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [-] run-sentence-transformers: Run local sentence-transformers pipeline to compute embeddings for devSquadMemory documents and write JSONL 🔴
- [ ] add-api-adapters: Add optional OpenAI/Cohere adapter code (disabled by default; uses env vars) 🟢
- [ ] import-to-lancedb-chroma: Import embeddings into local LanceDB/Chroma and run example similarity queries (Chromadb will be used locally) 🟡
- [ ] verify-scripts: Run smoke tests and scripts to ensure everything works 🟡
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
