Overview — Architecture Deep Dive
=================================

Summary
-------
`the-dev-squad` is a Next.js (app router) TypeScript application that orchestrates a multi-agent "Dev Squad" powered by the `claude` CLI. The product design centers on treating Claude as a team with specialized roles (Supervisor + specialists). Two main modes exist: Pipeline Mode (automated orchestrator running agents) and Manual Mode (human orchestrator spawning Claude sessions directly).

Key technologies & frameworks
----------------------------
- Next.js (version 16) + React 19 (frontend)
- TypeScript for the codebase
- Node.js scripts and small shell helpers (under `scripts/`)
- The project runs Claude via a local `claude` CLI (spawned processes and shell wrappers)
- Orchestration code lives in `pipeline/` and `src/lib/` (pipeline-* helpers)

High-level components
---------------------
- Web UI: `src/app/*` + `components/*` — React components and pages for the Office/Board UI
- API: Server routes under `src/app/api/*` — accepts commands like start/stop/pipeline chat
- Pipeline orchestrator: `pipeline/orchestrator.ts`, `pipeline/runner.ts` — runs pipeline flows and abstracts host vs Docker runners
- Pipeline library: `src/lib/pipeline-*.ts` — planning, runtime state, supervisor and control logic
- Hooks & integration: `.claude/settings.json` and `pipeline/.claude/hooks/approval-gate.sh` are used to gate tool use and implement permission checks
- Scripts: `scripts/probe-auth.sh` and other utilities that check credentials and run the `claude` binary

Where things connect
--------------------
- API endpoints spawn or control the orchestrator/runner. The orchestrator coordinates turns and writes events to staging files (e.g. `.staging/pipeline-events.json`).
- The Runner abstraction (host vs Docker) launches the `claude` CLI processes. The host runner is the default; DockerRunner is present for narrow cases.
- `pipeline-control.ts` copies template `.claude` settings into the project workspace and installs `PreToolUse` hooks to enforce pipeline guardrails.

Runtime & data flow
-------------------
1. User action (UI or API) triggers a pipeline job (e.g., "start pipeline").
2. Orchestrator (pipeline/orchestrator.ts) sets up working dirs, copies `.claude` settings/hooks, and calls the Runner to execute agent turns.
3. Runner spawns `claude` CLI processes (with `--system-prompt` / `--resume` flags) for each agent turn. Output can be stream-json.
4. Agents write pipeline events to staging files; supervisor inspects events and decides orchestrator actions (retries, escalate to host if Docker auth fails).
5. Hooks (`.claude/hooks/approval-gate.sh`) block or allow tool use from within pipeline sessions to enforce role-based restrictions.

Security model & sandboxing
--------------------------
- The system uses hooks and environment gating rather than strong OS-level sandboxing. DockerRunner exists, but Docker is not the default due to Claude subscription auth issues in containers.
- Important guardrails: `approval-gate.sh` (PreToolUse), `PIPELINE_PERMISSION_MODE`, and `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` environment flags are used to limit agent scope.

Quick references (where to look)
--------------------------------
- High-level architecture: `ARCHITECTURE.md`
- Runner & orchestrator: `pipeline/runner.ts`, `pipeline/orchestrator.ts`, `pipeline/README` (if present)
- Pipeline helpers: files under `src/lib/pipeline-*.ts` (planning, runtime, supervisor, control)
- Claude-related scripts: `scripts/probe-auth.sh` and `.claude` templates copied by `src/lib/pipeline-control.ts`
