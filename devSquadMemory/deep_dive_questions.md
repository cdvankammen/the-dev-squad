100 Deep-Dive Questions for the-dev-squad repository
====================================================

1. What is the authoritative entrypoint for starting the pipeline orchestrator (file and CLI command)?
2. What are the exact responsibilities of `pipeline/orchestrator.ts` vs `pipeline/runner.ts`?
3. How does the Runner abstraction choose between `HostRunner` and `DockerRunner` in code and configuration?
4. What environment variables control runner behavior (e.g., `PIPELINE_AGENT`, `PIPELINE_PERMISSION_MODE`, `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`)?
5. Where are per-job `.claude` templates kept (location of `BUILDUI_DIR/.claude`) and how are they managed?
6. How are `.claude/hooks/approval-gate.sh` and other hooks injected into the runtime and invoked by Claude sessions?
7. What exact format and schema does `BUILDUI_DIR/.claude/settings.json` use, and how does `pipeline-control.ts` transform or validate it?
8. How does `scripts/probe-auth.sh` determine whether the `claude` binary is available and authenticated?
9. What credentials does Claude expect (e.g., `~/.claude.json`), and how is precedence determined between global and per-project settings?
10. How are agent sessions spawned (which API route or internal call triggers `claude` process spawn)?
11. What are the canonical `claude` CLI flags used across the codebase (`--permission-mode`, `--model`, `--system-prompt`, `--output-format`)?
12. Where are `--system-prompt` and `--resume` messages constructed and persisted between turns?
13. How are pipeline events written, stored, and consumed (file paths such as `.staging/pipeline-events.json`)?
14. How does the supervisor make retry/escalation decisions when a Docker worker fails to authenticate?
15. What state is stored in staging vs persisted storage, and what is the retention policy for staging artifacts?
16. How are longer running pipeline jobs monitored and what metrics are recorded (timers, stalls, auto-resume counts)?
17. How does the code detect and handle a stalled turn (see `TURN_IDLE_TIMEOUT_MS` and `shouldMarkTurnStalled` logic)?
18. What is the exact format of the stream-json output from the `claude` CLI, and how does the host parse it?
19. How do the API endpoints in `src/app/api/*` interact with the orchestrator process (REST vs direct function calls)?
20. Which pages in `src/app/` call `use-pipeline` hooks and how is UI state synchronized with runtime state?
21. Where is the `Supervisor`’s decision logic implemented and how testable is it in unit tests (e.g., `pipeline-supervisor.ts`)?
22. How are permission checks performed inside sessions beyond `approval-gate.sh` (e.g., `--permission-mode` classifier)?
23. What are the exact security assumptions and threat model described in `SECURITY.md` and `SECURITY-ROADMAP.md`?
24. How are tool call policies represented, authored, and updated (hook scripts, policies in `.claude` templates)?
25. How do pipeline sessions isolate filesystem access between different agents or phases?
26. What files and directories are allowed to be written by which agent (Supervisor vs A/B/C/D/E roles)?
27. How does the `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` flag affect bash `cd` behavior inside session shells?
28. How does the code instrument and surface permission prompt responses from Claude (recording allow/deny decisions)?
29. Which parts of the UI show permission prompts and how do they map to `PIPELINE_PERMISSION_MODE` settings?
30. How are tests structured for the pipeline behavior (see `scripts/test-*`), and what parts are unit vs integration tests?
31. What are the expected developer workflows for local development vs CI (npm scripts, environment variables, mock credentials)?
32. Which dependencies in `package.json` are critical to the pipeline orchestration (e.g., `sharp` minor, `next`, `react`)?
33. Where are build and runtime artifacts stored during a pipeline run (temporary directories or `~/Builds/`)?
34. How are background processes killed and cleaned up on pipeline stop (`pkill -f "claude.*--output-format.*stream-json"` usage)?
35. How is concurrency handled when multiple pipeline jobs or manual sessions co-exist?
36. Are there any mechanisms to prevent race conditions between orchestrator and manual `claude` sessions? If so, what are they?
37. How are logs emitted (stdout vs file), where are they collected, and what is the suggested log retention and rotation strategy?
38. Where are telemetry and usage metrics emitted — any central aggregator or file format expected?
39. What will happen on a Claude binary crash mid-turn, and how does the orchestrator recover or compensate?
40. Are there known failure modes documented (e.g., subscription auth in Docker) and what remediation is automated?
41. How does the Runner construct the runtime environment for `claude` processes (env vars, working dir, mounts)?
42. What safeguards are implemented to avoid `claude` sessions from exfiltrating secrets from the host environment?
43. How are third-party skills meant to be installed into a workspace and what gating exists (manual review, `openclaw skills scan` analog)?
44. Where do `skills` live for workspace runs vs global user-level runs (e.g., `~/.openclaw/skills/` vs project-level `/skills`)?
45. How can an operator blacklist or allowlist specific skills at runtime for a pipeline job?
46. How does the codebase support running non-claude backends (OpenAI/HuggingFace/local models) — are there abstractions for pluggable backends?
47. Which files or modules reference `openclaw`, `openclaw.json`, or other gateway integrations (if any)?
48. How are system prompts and role-specific prompts maintained, versioned, and updated across the repo?
49. How is prompt templating implemented (e.g., variable substitution, snippets repository)?
50. Where are sensitive files (keys, tokens) explicitly redacted or excluded from memory and RAG ingestion in the repo scripts?
51. How do the test scripts simulate Claude behavior for offline CI runs (mocking CLI or using fixtures)?
52. Which CLI utilities (scripts under `scripts/`) are intended to be run by humans vs by CI agents?
53. How are configuration changes (like `PIPELINE_PERMISSION_MODE`) surfaced to running pipelines without restart?
54. Where are pipeline policies and checklists stored (templates under `pipeline/`), and how are they used at runtime?
55. How does the system decide when to retry on the host vs when to fail a Docker worker permanently?
56. What is the developer feedback loop when a pipeline job stalls — how are developers alerted or able to intervene?
57. How can an operator reproduce a failing run locally, given the code and helper scripts present?
58. How is `plan.md` produced and where is the template (see `pipeline/build-plan-template.md`)?
59. How does planning flow (research -> write -> self-review) interact with the file system and the Write tool?
60. How are agent identities (A, B, C, D, E, S) defined, where is their role documentation stored, and how are they created in a run?
61. What is the source of truth for agent prompts and skills mapping to agents (e.g., Supervisor uses certain skills)?
62. How are user-initiated manual chats (`POST /api/chat`) distinguished from pipeline automated turns?
63. How does `src/lib/use-pipeline.ts` expose runtime controls to React components, and what client-server synchronization is implemented?
64. What security checks happen when copying templates into a project `.claude` directory (permissions, content validation)?
65. How are shell hook scripts instrumented to return structured signals to the orchestrator (exit codes, JSON payloads)?
66. How are differences between phases (planning, code, review, testing, security) represented in event logs and prompts?
67. What are the minimal steps to enable Cooperator-style MCP tools for non-claude backends (e.g., register an MCP tool for Ollama)?
68. What telemetry should be captured for RAG retrieval quality (query text, returned doc ids, embedding distances)?
69. How are embedding models chosen and pinned for reproducibility and cost control?
70. Where are examples of recommended `npx skills add` or `clawhub` install commands recorded or automated in the repo?
71. What is the recommended governance workflow for adding a new skill to a shared `skills/` repo (review, approvals, tests)?
72. How does the pipeline interact with Git operations (create PRs, commit generated files) — are there helper utilities?
73. Are there safeguards to avoid committing secrets into generated files or commit history (pre-commit hooks, scanners)?
74. How are user preferences (e.g., model selection, permission mode) persisted between sessions and overrides applied?
75. How does the codebase support experimentation (A/B tests) across prompts, models, or skills during runs?
76. What debugging utilities are available to inspect a failed turn's raw input, model output, and hook responses?
77. What are the best places to add instrumentation or hooks to support integrating other model runtimes (ollama, LM Studio)?
78. Which components need to be added to support multiple model providers concurrently (adapter layer, config, per-job selection)?
79. How can conversation/session continuity be preserved when switching model backends mid-run?
80. How does the system currently discover installed skills and map them into agent capabilities at runtime?
81. How would you implement a skill-review automation that scans new skills for risky patterns (`exec`, `web_fetch`, `spawn`)?
82. What telemetry should be captured for RAG retrieval quality (query text, returned doc ids, embedding distances)?
83. How are embedding models chosen and pinned for reproducibility and cost control?
84. Where are examples of recommended `npx skills add` or `clawhub` install commands recorded or automated in the repo?
85. What is the recommended governance workflow for adding a new skill to a shared `skills/` repo (review, approvals, tests)?
86. How does the pipeline interact with Git operations (create PRs, commit generated files) — are there helper utilities?
87. Are there safeguards to avoid committing secrets into generated files or commit history (pre-commit hooks, scanners)?
88. How are user preferences (e.g., model selection, permission mode) persisted between sessions and overrides applied?
89. How does the codebase support experimentation (A/B tests) across prompts, models, or skills during runs?
90. What debugging utilities are available to inspect a failed turn's raw input, model output, and hook responses?
91. What are the top three architectural risks or technical debt items that could block integrating additional model providers?
92. Which code owners or maintainers should be consulted for changes to runner, hooks, or skills governance (names, files, contact points)?
93. How are system-level prompts assembled with injected RAG context and conversation history—what code merges these parts?
94. Where is conversation context trimmed to respect token limits and how is that period/log handled?
95. How are non-text artifacts (images, sprites) handled when referenced by agents—are they chunked or linked by URL?
96. Where are UI-level controls implemented to pause/resume a running pipeline from the front-end code?
97. What constraints or best practices exist for writing new hook scripts (exit codes, JSON vs stdout conventions)?
98. How is localization handled in UI strings or skill descriptions—are translations present or pluggable?
99. How do pipeline events represent structured outputs (JSON) vs free-text outputs from the model, and how are they parsed?
100. What is the governance policy for accepting external skills from `awesome-copilot` or other community sources—who signs off and what tests must pass?

Notes
-----
These questions are designed for maintainers and engineers running the system to answer. They will help produce additional targeted documentation and code modifications for multi-model support, improved security, and robust RAG integration.
