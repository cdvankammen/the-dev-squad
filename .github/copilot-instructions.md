<todos title="Debug code agents and inspect devSquadMemory" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [-] inspect-devsquadmemory: Inspect `devSquadMemory` contents and confirm embedding/import scripts and vectors file presence. 🔴
  _Start by reading README_MEMORY.md, workspace_vectors.jsonl, and ingest scripts under `devSquadMemory/scripts`._
- [ ] collect-agent-error-logs: Search repository logs and pipeline outputs for recent agent errors and stack traces. 🔴
  _Search `logs/`, `pipeline/`, and test outputs for ERROR/Exception/Traceback entries; collect relevant files and timestamps._
- [ ] trace-agent-responses: Analyze agent prompt/response logs to determine what the agents are responding to and why. 🟡
  _Locate agent runtime code or adapters (pipeline/orchestrator, agent entry points) and inspect logging around requests/responses._
- [ ] verify-monitoring-capabilities: Check codebase for monitoring, telemetry, or observability hooks and whether the assistant can monitor runtime. 🟡
  _Look for logging frameworks, sentry/telemetry integrations, or health endpoints; note what's required to enable live monitoring._
- [ ] propose-fixes-and-tests: Propose fixes, tests, and commands to reproduce and validate agent behavior locally. 🟡
  _Create minimal reproducer steps, unit/e2e tests, and commands to run locally (include environment vars/requirements)._
</todos>

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->


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