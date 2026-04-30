<todos title="Deep code/security/provider/MCP review" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] baseline-inventory: Capture current branch status, changed files, scripts, environment assumptions, and dev-server state before modifying anything. 🔴
  _Baseline captured: source initially clean; current source changes are security/provider hardening plus todo-sync metadata. Dev artifacts under .next-instances remain noisy and are not intentional source._
- [-] fix-next-enotempty: Fix npm run dev startup failure where Next.js cannot rmdir .next-instances/<port>/dev/static/webpack because stale dev artifacts remain non-empty. 🔴
  _User reported ENOTEMPTY on port 3005. Patch dev-server startup to safely remove known stale webpack/static/cache subtrees for the selected port before launching Next, without deleting unrelated project files._
- [ ] static-code-review: Review changed provider/runtime/UI/orchestrator/control files plus scan source for TODO/FIXME/debug, unsafe patterns, polling hot loops, and fragile parsing/state handling. 🔴
  _Initial scan found providerStorage localStorage API-key persistence, provider-config route storing API keys, missing auth on mutating control routes, and OpenWebUI model-array parsing gap; first patch applied and TypeScript passed._
- [ ] security-review: Audit external endpoints, auth gates, SSR/server fetch behavior, path/workspace controls, process spawning, token handling, and provider configuration persistence. 🔴
  _Prioritize CRITICAL/HIGH issues that could expose local file/process control or remote unauthenticated control surfaces. New requirement: ensure outer shell speaks only to Supervisor over MCP and build directory boundaries are enforced._
- [ ] provider-endpoint-review: Validate LM Studio and OpenWebUI provider model discovery/chat paths with direct endpoint probes and app API probes; record exact reachable/unreachable results. 🔴
  _Run direct network checks separately from app-route checks. Sandbox network failures will be retried unsandboxed only after a sandbox failure as required. User emphasized LM Studio must work now; OpenWebUI should be checked if reachable._
- [ ] model-configuration-review: Exercise multiple model/provider/agent override configurations through storage/API/runtime boundaries and inspect model fallback behavior for invalid/empty model lists. 🔴
  _New requirement: for LM Studio/Ollama-only automated model choice, select from available models, tell Supervisor via MCP which models/config are chosen, and account for unload cooldowns when switching larger models._
- [ ] lmstudio-model-cooldown: Implement or validate LM Studio model-selection cooldown behavior: no cooldown for <=4B/<=8B small models; wait one minute before loading/switching after larger models to avoid VRAM overload. 🔴
  _Need inspect existing runner/orchestrator boundaries and add a central cooldown tracker if not present. Keep policy provider-agnostic enough for Ollama later but test with LM Studio first._
- [ ] mcp-supervisor-flow: Validate MCP/tool-side communication to Supervisor only: choose LM Studio models from discovered list, send the selection/config/build request through MCP, and ensure internal pipeline agents continue automatically. 🔴
  _Outer-shell interaction should call only Supervisor tool APIs; A-E remain read-only/controlled internally. Must verify build directory is set and constrained._
- [ ] make-safe-fixes: Apply every safe, high-confidence code/config/test/documentation improvement found during review without broad rewrites or new branches. 🔴
  _Only ship changes that are directly verifiable and reduce risk/perf bugs; do not introduce speculative architecture churn._
- [ ] isolated-test-suite: Run tests one at a time with hang guards: TypeScript, lint/build if available, unit/custom scripts, provider smoke tests, endpoint probes, and source diff checks. 🔴
  _Commands must be isolated so a hanging live provider/model call cannot block compile/static checks. Use command-level timeout wrappers where appropriate._
- [ ] final-report-memory: Update devSquad memory with review findings, endpoint matrix, validation results, remaining blockers, and exact files changed. 🟡
  _The memory record should distinguish verified LM Studio/OpenWebUI behavior from environment/network blockers and include the dev-server ENOTEMPTY fix and model cooldown/MCP findings._
</todos>

## vexp context tools <!-- vexp v2.0.12 -->

**MANDATORY: use `run_pipeline` — do NOT grep, glob, or read files manually.**
vexp returns pre-indexed, graph-ranked context in a single call.

### Workflow
1. `run_pipeline` with your task description — ALWAYS FIRST (replaces all other tools)
2. Make targeted changes based on the context returned
3. `run_pipeline` again only if you need more context

### Available MCP tools
- `run_pipeline` — **PRIMARY TOOL**. Runs capsule + impact + memory in 1 call.
  Auto-detects intent. Includes file content. Example: `run_pipeline({ "task": "fix auth bug" })`
- `get_skeleton` — compact file structure
- `index_status` — indexing status
- `expand_vexp_ref` — expand V-REF placeholders in v2 output

### Agentic search
- Do NOT use built-in file search, grep, or codebase indexing — always call `run_pipeline` first
- If you spawn sub-agents or background tasks, pass them the context from `run_pipeline`
  rather than letting them search the codebase independently

### Smart Features
Intent auto-detection, hybrid ranking, session memory, auto-expanding budget.

### Multi-Repo
`run_pipeline` auto-queries all indexed repos. Use `repos: ["alias"]` to scope. Run `index_status` to see aliases.
<!-- /vexp -->