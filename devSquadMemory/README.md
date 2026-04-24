DevSquad Code Memory
=====================

Created: 2026-04-23

Purpose
-------
Curated developer memory and reference for the `the-dev-squad` repository. This folder contains the notes, helper scripts, and artifacts produced during analysis and RAG preparation so everything stays inside the workspace.

Contents (files included in this folder)
--------------------------------------
- `overview.md` — high-level architecture and how the system works
- `file-map.md` — mapping of important files to their responsibilities
- `claude-connections.md` — precise evidence and notes on how the code talks to Claude and where credentials/configs live
- `ingest_guide.md` — instructions for converting these notes into a RAG index
- `rag_ingest_example.py` — example script that bundles these notes into a JSONL for embedding
- `safety_scan_report.md` — results of the static safety scan I ran
- `skills_local_copy_report.md` — report of what local skills were copied for review
- `skills_index.md` — index of SKILL.md files copied into memory
- `skills_install_suggestions.md` — suggested install workflow and candidate skills
- `deep_dive_questions.md` & `deep_dive_questions_2.md` — guided questions for maintainers
- `chat_audit.md` — verified audit of the prior Copilot chat claims vs the actual repo
- `providers_and_terminals.md` — how Dev Squad uses Claude/other CLIs, Docker, terminals, Bedrock, and local-model routing
- `verification_report.md` — commands run and the current verified status of builds/tests/providers
- `runbook.md` — step-by-step commands for app startup, tests, vector memory, providers, and Docker
- `scripts/` — helper scripts (moved here from workspace root)
- `skills_local/` — local skill mirror README (moved here)

How to use
----------
1. Read `overview.md` and `file-map.md` to get oriented.
2. Use `rag_ingest_example.py` to create a JSONL ready for embedding:

```bash
python3 devSquadMemory/rag_ingest_example.py --source devSquadMemory --out devsquad_memory.jsonl
```

3. Use a local embedding model (sentence-transformers) if you want to avoid cloud uploads.

4. Read `chat_audit.md` before trusting earlier implementation claims. It records which claims were true, partially true, or false when verified against the repo.

5. Read `providers_and_terminals.md` if you want to use Bedrock, OpenClaude, Open Claude Code (`occ`), LM Studio, Ollama, or OpenAI-compatible endpoints.

Notes
-----
- I moved research .md and helper scripts from temporary memory into this folder so nothing important is left outside the workspace.
- Sensitive data (e.g., `.claude/settings.json`, credential files) were not copied here and were explicitly excluded from ingestion.
- Do **not** keep a live Python virtualenv under `devSquadMemory/.venv`; Next/Turbopack traverses the workspace and symlinks inside a venv can break `npm run build`. Use your user Python, an external venv, or recreate a temporary venv only when you need it and delete it afterward.

Local embedding quickstart
-------------------------
1. Install Python deps into your user environment:

```bash
pip3 install --user -r devSquadMemory/requirements.txt
```

2. Build embeddings for the workspace (writes `devSquadMemory/workspace_docs.jsonl` and `devSquadMemory/workspace_vectors.jsonl`):

```bash
python3 devSquadMemory/build_local_embeddings.py
```

3. Run quick queries against the generated embeddings:

```bash
python3 devSquadMemory/query_helper.py --query "how does the runner spawn claude" --topk 5
```

Provider reality check
----------------------
- Executable providers in this repo today: `claude-cli`, `occ`, `openclaude`, `openai-http`, `lm-studio`
- `openai-http` and `lm-studio` execute through `scripts/http-runner-shim.mjs` (OpenAI-compatible HTTP bridge).
- For LM Studio, Ollama, OpenRouter, Groq, DeepSeek, or other OpenAI-compatible backends, you can use either:
  - `openclaude` as router, or
  - direct `openai-http` / `lm-studio` provider selection.
- Runtime success still depends on environment credentials/endpoints (Bedrock/AWS, Anthropic/OpenAI keys, local server availability, etc.).
