<todos title="devSquadMemory embedding and importer work" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] inspect-devsquadmemory: Inspect `devSquadMemory` contents and confirm embedding/import scripts 🔴
- [x] verify-fallback-vectors: Verify fallback vectors file and backup presence (`devSquadMemory/workspace_vectors.jsonl` and backups) 🟡
- [x] add-sbert-and-chroma-scripts: Add or update SBERT embedding script and Chroma import (if missing) 🟡
- [x] provide-run-instructions: Provide run instructions and quick verification commands 🔴
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