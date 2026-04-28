<todos title="Monitor and Analyze devSquad Application" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] enable-logging: Enable maximum logging in the application 🔴
- [x] build-code: Build the code if necessary 🔴
- [x] examine-logs: Examine existing log files for errors and flow 🔴
- [x] run-monitor: Run the application and monitor live outputs 🔴
- [x] analyze-codebase: Analyze codebase for agent communication and flow 🔴
- [x] explain-findings: Explain findings, errors, and internal workings 🔴
- [x] save-analysis: Save comprehensive analysis to memory file 🔴
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