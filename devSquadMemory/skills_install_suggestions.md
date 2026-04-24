Skills copied and install suggestions
=====================================

What I copied into memory (from `/Users/stillbulldog35/Documents/workgithub/skills-unified`):
- `rag-implementer`
- `langchain-rag`
- `langchain-dependencies`
- `langchain-fundamentals`
- `memory-lancedb-pro-openclaw`
- `claude-peers-mcp`
- `openclaw-config`
- `openclaw-control-center`
- `everything-claude-code-harness`
- `openclaw-rl-training`
- `picoclaw-ai-assistant`
- `web-access-claude-skill`
- `metaclaw-evolving-agent`
- `clui-cc-claude-overlay`

Status: These SKILL.md docs are now saved under `devSquadMemory/skills_from_workgithub/` for RAG and quick reference.

Suggested install workflow (safe & auditable)
---------------------------------------------
1. Inspect SKILL.md content and run a local static analysis to flag risky patterns (calls to `exec`, `spawn`, `curl` with unsanitized inputs).
2. If safe, install to local skills dir for Claude Code:

```bash
# Manual safe install (preferred)
mkdir -p ~/.claude/skills
git clone <repo-url> ~/.claude/skills/<skill-name>
```

3. Or use Skills CLI where available:

```bash
npx skills find <keyword>
npx skills add <owner/repo@skill> -g -y
```

High-value candidates to install (recommendation list)
-----------------------------------------------------
- `rag-implementer` — ingestion & retrieval patterns (install/consult before building vector DB)
- `langchain-rag` & `langchain-dependencies` — if you plan to use LangChain for retrieval/agent flows
- `memory-lancedb-pro-openclaw` — production memory plugin pattern for OpenClaw
- `web-access-claude-skill` — if you need browser automation for web research
- `everything-claude-code-harness` — general harness & rules for secure agent usage
- `claude-peers-mcp` — useful for running multiple Claude instances and inter-session messaging

What I did NOT install yet
-------------------------
- I only copied SKILL.md files into `devSquadMemory/skills_from_workgithub/`.
- I did not run `npx skills add` or `openclaw plugins install` — I can if you approve.

If you want me to proceed
-------------------------
- I can run `npx skills find <keyword>` to locate canonical package names in the public Skills registry and then run `npx skills add` to install the chosen ones.
- I can also `git clone` specific skill repos into `~/.claude/skills/` or into the workspace for local development/test.
