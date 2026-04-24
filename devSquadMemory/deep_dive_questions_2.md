100 Additional Deep-Dive Questions (Implementation, Models, Deployment, RAG, Security)
=============================================================================

1. Where in the code are `claude` process stdio and JSON streams parsed and normalized into pipeline events? (filename and function)
2. What exact schema is used for pipeline events (fields, types, example JSON)?
3. How are write operations (file edits) recorded in events and what tool writes them to disk?
4. How are multi-file write transactions handled to avoid partial commits if an agent fails mid-write?
5. Which modules are responsible for serializing/deserializing `stream-json` output from the `claude` CLI?
6. How are prompt tokens counted and cost charged/attributed in telemetry (file or module)?
7. Where is the code that spawns `claude` sessions—what spawn options and stdio modes are used (spawn vs execFile)?
8. How are environment variables transmitted into DockerRunner vs HostRunner—what mount/bind strategies are used?
9. What is the expected OS-level user that runs the orchestrator in production and what file permissions are required for `.claude` copies?
10. How are working directories created/cleaned per-run and what is the canonical location for build artifacts (`~/Builds/` vs `.staging`)?
11. Where is the code that manages subagent lifecycle and what RPC channels or files are used for subagent communication?
12. Which modules rehydrate previous session state (`--resume`) and how are partial session transcripts stored and reopened?
13. How is concurrency controlled when multiple UI users issue pipeline commands simultaneously? Are queue semantics implemented?
14. What happens if `pkill -f "claude.*--output-format.*stream-json"` kills a non-pipeline Claude process—are there safeguards to avoid collateral kills?
15. How are agent-level secrets (e.g., API keys) scoped so that only the correct agent instance can read them?
16. Where is the logic that decides to retry a Docker worker on the host exactly implemented, and what criteria are used (exit codes, error messages)?
17. Which codepath handles the admin API to 'stop-pipeline' and what checks are performed to ensure graceful shutdown?
18. How would you add a configurable timeout per agent turn (per-phase) and where would it be enforced?
19. Are there health-check endpoints for the orchestrator and Runner, and what path/port are they exposed on?
20. How are agent role labels (A/B/C/D/E/S) mapped to concrete prompt templates and skills in the codebase?
21. Which files are authoritative for skill-to-agent mapping (i.e., which skill(s) each agent can call)?
22. How are system-level prompts assembled with injected RAG context and conversation history—what code merges these parts?
23. Where is conversation context trimmed to respect token limits and how is that period/log handled?
24. How are non-text artifacts (images, sprites) handled when referenced by agents—are they chunked or linked by URL?
25. Where are UI-level controls implemented to pause/resume a running pipeline from the front-end code?
26. How is authentication for the API routes (`src/app/api`) implemented—are requests validated/authorized?
27. How are audit logs for user actions and agent decisions written and where are they stored?
28. How are the shell hook scripts instrumented to return structured JSON to the pipeline process for decisions?
29. Which functions build `--system-prompt` payloads and where are those payload templates stored or authored?
30. How does the code ensure consistent `--permission-mode` across agent spawns, and where is it configurable?
31. How are text encodings (UTF-8 normalization) enforced across files written by different OS-level shells/agents?
32. What is the approach to snapshotting a run (save workspace + events) for later replay/debugging?
33. How are code-edit diffs generated and applied—are patches applied atomically using Git or direct fs writes?
34. How would you add git-backed write operations (create commit, open PR) after agents modify files—where to insert hooks?
35. Which components are responsible for test orchestration (scripts/test-*) and how do they simulate typical pipeline inputs?
36. How are coverage and test artifacts collected and reported back to agent reviewers (e.g., D's testing phase)?
37. Where should new instrumentation points be added to capture model latencies per-turn and per-chunk?
38. How is the `approval-gate.sh` invoked by the `claude` process—where does the hook registration happen in `.claude` templates?
39. What constraints or best practices exist for writing new hook scripts (exit codes, JSON vs stdout conventions)?
40. How is localization handled in UI strings or skill descriptions—are translations present or pluggable?
41. How do pipeline events represent structured outputs (JSON) vs free-text outputs from the model, and how are they parsed?
42. Where are the definitions for the "phases" of a pipeline run stored and how easy is it to add a new phase?
43. How are permissions enforced when an agent attempts to use `exec` or network tools—are calls proxied or blocked by hooks?
44. What is the format and retention policy for `.staging/pipeline-events.json`—how is it rotated or pruned?
45. How are long-running CPU-bound tasks (e.g., embedding large docs) offloaded—background worker, container, or external service?
46. How are per-job quotas (compute, disk, time) enforced on Runner and orchestrator level?
47. What is the recovery story when the host machine restarts while a pipeline was mid-run—how does it resume or fail gracefully?
48. Where are deployment manifests (Dockerfiles, k8s) if any exist—what is the recommended production deployment path?
49. How are scheduled cron jobs represented in `pipeline/cron` or `~/.claude/cron`—what is the format for job payloads?
50. Where can you configure the model selection policy (e.g., prefer cheaper models for development runs)?
51. How would you add a fallback provider (OpenAI) for specific queries—where to intercept and route requests?
52. How are streaming responses from `claude` presented to the UI—what websocket or SSE endpoints are used?
53. Where is the client-side code that consumes streamed model outputs and updates UI components incrementally?
54. How does the code handle rate limiting or backoff for model providers that return 429 / quota errors?
55. Are there any implemented safeguards for prompt injection (sanitize user-provided files before inclusion)? If not, where to add them?
56. How are sensitive project files excluded from RAG ingestion by default (e.g., keys, .claude/settings.json)?
57. What is the intended owner workflow for adding a new skill—where to add SKILL.md and how to register it?
58. Where is the `BUILDUI_DIR` constant defined and how does it map to repo layout or templates?
59. How are skill triggers discovered by the agent runtime (description-based matching vs explicit registration)?
60. What is the process for auditing third-party skills for malicious constructs (pattern scanning, static analysis)?
61. How are embeddings stored and referenced in the memory schema used by `memory-lancedb-pro` or similar integrations?
62. What metadata fields should be included when indexing files for RAG to maximize recall and traceability?
63. How can we test retrieval precision using ground-truth question/answer pairs (evaluation harness location)?
64. Where would you place hooks for capturing user feedback on RAG responses to enable supervised retraining or fine-tuning?
65. How can we instrument and record attribution of retrieved sources to model outputs (which chunk informed which claim)?
66. What access controls do we need for the vector DB's HTTP endpoints and what networking model is recommended (private subnet)?
67. How are the embedding model, dimension, and vector schema pinned to avoid drift in retrieval quality?
68. What fallback strategies exist when a local embedding provider (Ollama) is offline—use remote embeddings or approximate? Where to plug fallback?
69. How would you implement per-agent memory isolation across projects and users to avoid cross-contamination? Which module to change?
70. What logging and observability do we need for RAG: query logs, retrieval latency, returned docs, and relevance scores? Where to add collectors?
71. How can we run offline/in-memory tests of retrieval with small datasets to validate RAG config before productionizing?
72. Where should we add integration tests that validate the end-to-end RAG generation (ingest -> vector DB -> retrieve -> answer)?
73. How do we ensure reproducible embeddings across upgrades to embedding models or providers (version pinning strategy)?
74. Where are the points to implement differential privacy or PII redaction before ingestion into vector stores?
75. How do we measure hallucination rate post-RAG and where to surface those metrics to model selection logic?
76. How would we add adapter support for Ollama or LM Studio—what interface must an adapter implement (sync/async, streaming)?
77. How can we support local GPU inference for embeddings (e.g., sentence-transformers) and where to orchestrate hardware scheduling?
78. How to add a developer-mode that bypasses hooks safely for local testing, and where to gate such a mode (env var, flag)?
79. What are the minimal steps to enable Cooperator-style MCP tools for non-claude backends (e.g., register an MCP tool for Ollama)?
80. How can we integrate a cross-encoder reranker step into retrieval without adding significant latency—where to insert it?
81. How to safely enable multi-model experimentation (A/B) for prompts and measure comparative fidelity—what telemetry to collect?
82. How to implement canary deployments for model changes across pipeline runs to limit blast radius?
83. Where to put model provider cost tracking and per-query cost attribution so budget teams can monitor usage?
84. How to implement role-based access controls for skills that can execute harmful shell commands—where to centralize policy enforcement?
85. How would you design a "skill sandbox" that runs skills with limited filesystem/network access on the host runner (not Docker)?
86. How are unit-tests for prompt templates and skill outputs implemented—can we have snapshot tests for LLM outputs?
87. How can we automatically detect and flag skills that call `exec` or raw shell commands during a security scan? Where to run such scans?
88. What CI checks should run on every skill addition to the repo (lint, security scan, behavioral smoke tests)? Where to add them?
89. How to securely store and rotate per-skill API keys without embedding them in SKILL.md files or repo templates?
90. Where to add training data collection hooks to capture question-answer pairs and user corrections for later fine-tuning?
91. Where to add automated canaries that run simple queries each hour to verify the vector DB health and retrieval quality?
92. How to expose RAG retrieval explanations in the UI so users can see which documents affected the result?
93. What access controls do we need for the vector DB's HTTP endpoints and what networking model is recommended (private subnet)?
94. How are the embedding model, dimension, and vector schema pinned to avoid drift in retrieval quality?
95. What fallback strategies exist when a local embedding provider (Ollama) is offline—use remote embeddings or approximate? Where to plug fallback?
96. What profiling and optimization steps can we take to reduce token usage in system prompts while preserving context fidelity?
97. Where to add automated canaries that run simple queries each hour to verify the vector DB health and retrieval quality?
98. How to expose RAG retrieval explanations in the UI so users can see which documents affected the result?
99. How to design governance for accepting community skills and what tests must pass prior to install?
100. Which code owners or maintainers should be consulted for changes to runner, hooks, or skills governance (names, files, contact points)?

Notes: Answering these will produce a concrete engineering plan to support multi-provider models, safe skill installation, and an evaluation plan for RAG and memory management.
