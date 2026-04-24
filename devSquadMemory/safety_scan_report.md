DevSquad - Skill safety scan report
=====================================

Scan date: 2026-04-23
Scope: /memories/devSqauCodeMemory/skills_from_workgithub (selected SKILL.md files copied from local skills-unified)

Summary
-------
I performed a static, grep-style scan of the copied SKILL.md files looking for risky constructs (curl, bash pipes, remote installers, spawn/exec hints, CDP/browser automation, web_fetch/browser tools, eval, sudo, rm -rf, downloads). Below are per-skill findings and recommended actions.

Findings
--------
- rag-implementer
  - Risk: LOW
  - Notes: Documentation-style RAG guidance. No exec/download/install commands found in the skill metadata sample.
  - Action: Safe to stage/install for local testing.

- langchain-dependencies
  - Risk: LOW
  - Notes: Dependency guidance only. No runtime install commands in SKILL.md.
  - Action: Safe to stage/install for local testing.

- langchain-fundamentals
  - Risk: LOW
  - Notes: Educational/usage content; no exec commands.
  - Action: Safe.

- memory-lancedb-pro-openclaw
  - Risk: HIGH
  - Notes: Contains a one-line remote installer:
    curl -fsSL https://raw.githubusercontent.com/CortexReach/toolbox/main/memory-lancedb-pro-setup/setup-memory.sh -o setup-memory.sh
    bash setup-memory.sh
  - Rationale: curl|bash installs are high-risk (remote code execution). This skill also references embedding providers and API keys.
  - Action: DO NOT install automatically. Review the remote script content manually before running; prefer manual `git clone` and inspect repository.

- web-access-claude-skill
  - Risk: HIGH
  - Notes: Provides "full internet access" + CDP browser automation. Browser automation and remote web fetch give the skill powerful capabilities (page navigation, downloads, code execution vectors).
  - Action: Treat as high-risk: review code, restrict capabilities (read-only by default), run behind an isolated environment, and require explicit approval before installing.

- everything-claude-code-harness
  - Risk: MEDIUM
  - Notes: Hooks, commands, and memory-persisting hooks may include side-effecting operations. Review for exec/spawn patterns.
  - Action: Review source for hooks that call shell commands or fetch remote scripts.

- claude-peers-mcp
  - Risk: MEDIUM
  - Notes: Starts a local broker daemon (HTTP on localhost:7899). Network-facing component — moderate risk if misconfigured.
  - Action: Audit the broker code for input validation and auth; run on loopback only.

- openclaw-control-center
  - Risk: LOW-MEDIUM
  - Notes: Dashboard with read-only defaults — lower risk but still review any endpoints that allow writes.
  - Action: Review and test in a sandbox.

- openclaw-rl-training
  - Risk: MEDIUM
  - Notes: Training components may launch subprocesses and manage datasets. Review compute and data access patterns.
  - Action: Review before installation; avoid automatic installs.

- picoclaw-ai-assistant
  - Risk: MEDIUM
  - Notes: Small Go binary build & run. Building binaries from unvetted source is risky on constrained hosts.
  - Action: Audit or cross-compile in an isolated environment.

Recommendations & next steps
----------------------------
1) Install approach (recommended):
   - Use local copies for inspection first. Do NOT run remote installers (curl | bash) without code review.
   - Prefer `git clone` of the skill repository into `~/.openclaw/skills/` or `~/.claude/skills/` for manual review, or copy into a local `skills_local/` folder (already prepared) before installing.

2) Suggested vetted list to stage (safe-first):
   - rag-implementer (LOW)
   - langchain-dependencies (LOW)
   - claude-peers-mcp (MEDIUM - review network broker carefully)
   - openclaw-control-center (LOW-MEDIUM)

3) Skills to NOT auto-install without manual review:
   - memory-lancedb-pro-openclaw (HIGH) — remote install script
   - web-access-claude-skill (HIGH) — full web/CDP access
   - everything-claude-code-harness (MEDIUM) — hooks

4) Exact safe commands (local-first)

   # Copy selected skills from your local skills-unified repo into this repo for review
   ./scripts/copy_local_skills.sh

   # Install a local skill into OpenClaw (manual, review files first):
   mkdir -p ~/.openclaw/skills
   cp -R skills_local/rag-implementer ~/.openclaw/skills/rag-implementer

   # Or install into Claude user folder (some skills use ~/.claude):
   mkdir -p ~/.claude/skills
   cp -R skills_local/rag-implementer ~/.claude/skills/rag-implementer

   # If you trust a remote repo and want to clone it (PREFERRED over curl|bash):
   git clone https://github.com/<owner>/<skill-repo>.git ~/.openclaw/skills/<skill>

5) Safety automation suggestions (next actions)
   - Run a grep-based audit across the full skill source for patterns: exec\(|child_process|spawn\(|curl\s+-|wget\s|bash\s+setup|rm\s+-rf|web_fetch|browser|CDP|open socket|http.listen
   - Optionally run the included OpenClaw `openclaw skills scan` if you have a local OpenClaw installation (v2026.2.6+).

Artifacts I created for you in the workspace
-------------------------------------------
- Model adapter stubs: `src/lib/modelAdapters/*` (Claude CLI adapter + OpenAI HTTP adapter stub)
- Runner hook: added `RunnerOptions.modelProvider?: string` and a warning in `pipeline/runner.ts` to surface provider selection
- RAG helper: `tools/rag/ingest_and_embed.py` and `tools/rag/README.md` (generate JSONL and prepare embedding steps)
- Local skill mirror scaffolding: `skills_local/README.md` and `scripts/copy_local_skills.sh`
- This safety report (this file) was saved to workspace devSquadMemory.
