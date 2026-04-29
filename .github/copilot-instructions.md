<todos title="JSON Repair Layer consolidation and shim improvements" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] audit-repo: Audit repository for json repair & tool registry; located scripts/json-repair.mjs, src/lib/jsonRepair.ts, scripts/tool-registry.mjs, src/lib/tool-registry.json; added targeted retry to shim. 🔴
  _Found runtime scripts and TS port; shim currently uses scripts/json-repair.mjs; duplication risk noted._
- [-] consolidate-json-repair: Consolidate canonical json repair implementation into src/lib and add thin runtime wrapper in scripts/ (build step or dist artifact). 🔴
  _Options: (A) add build step (tsc/esbuild) and have scripts import dist artifact; (B) keep runtime scripts and add parity tests — choose before implementing._
- [x] shim-targeted-retry: Add targeted repair retry in http-runner-shim to request corrected JSON from model when parse fails (one retry). 🔴
  _Implemented minimal retry: pushes user prompt asking for only JSON args and retries once; tracked by argRepairRetries Map._
- [ ] tool-registry-parity: Ensure tool-registry TS API and scripts wrapper are consistent; add tests and verify getToolRegistryEntry is exported and used by shim. 🟡
  _scripts/tool-registry.mjs loads src/lib/tool-registry.json; tests exist (npx tsx scripts/test-tool-registry.mjs). Consider consolidating to src/lib implementation as canonical._
- [ ] ci-tests: Add CI job to run json-repair, tool-registry, and http-runner integration tests (requires npx tsx availability). 🟡
- [ ] docs-json-repair: Write short README for src/lib/jsonRepair.ts and scripts/json-repair.mjs describing how to extend rules, add tool schemas, and enable LM Studio structured outputs. 🟢
</todos>

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