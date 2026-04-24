<todos title="Fix duplicate tool-name error - implementation" rule="Review steps frequently throughout the conversation and DO NOT stop between steps unless they explicitly require it.">
- [x] implement-tool-uniqueness-check: Add preflight script to detect duplicate tool names (scripts/check-duplicate-tools.py) and run it locally to produce a duplicate report. 🔴
  _Script is dependency-free, exit codes: 0=OK,2=duplicates,1=error. Path: scripts/check-duplicate-tools.py_
- [x] add-ci-check: Add GitHub Actions workflow to run the duplicate checker on PRs (.github/workflows/check-tools.yml). 🔴
  _Workflow runs python3 scripts/check-duplicate-tools.py on push/PR to main._
- [x] run-local-check: Run preflight checker across workspace manifests and local Copilot debug snapshots and collect results. 🔴
  _Found repo duplicates in skills_local/rag-implementer/manifest.yaml and many duplicates in Copilot debug-logs (tools_*.json)._
- [x] namespace-workspace-tools: Namespace workspace-declared tool names (e.g., similarity-search-tool -> skill.rag-implementer.similarity-search, embedding-tool -> skill.rag-implementer.embedding) and apply edits in manifest(s). 🔴
  _Applied deterministic namespace convention: skill.<folder>.<tool>. Updated skills_local/rag-implementer/manifest.yaml._
- [ ] update-references: Search and update code and manifest references to renamed tools across the repository to use the new names. 🟡
  _Use grep/jq to find occurrences and replace safely; consider creating PR for review._
- [ ] finalize-and-verify: Re-run the duplicate checker, create a branch, commit changes, open PR, let CI run, and attempt to reproduce the Copilot failure to confirm the 400 is resolved. 🔴
  _If renaming fixes workspace-sourced duplicates, continue to next step; if runtime duplicates remain, prepare support report._
- [ ] prepare-support-report: If duplicates persist due to Copilot/runtime-sourced tool names, gather tools_*.json payloads and prepare a bug report for Copilot support including Copilot Request id and GH Request Id. 🟡
  _Attach merged tools payload (tools_*.json) and request IDs (fae91038-..., GH Request Id F25A:18DC54:4EE08C4:57B7AD5:69EBC947)._
</todos>

<!-- Auto-generated todo section -->
<!-- Add your custom Copilot instructions below -->
