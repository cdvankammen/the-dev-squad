File map — key files and responsibilities
=========================================

Top-level docs
---------------
- `ARCHITECTURE.md` — conceptual overview: Supervisor + specialists, pipeline vs manual modes, runner abstraction, security notes.
- `README.md` — repo-level instructions (top-level)

Pipeline & orchestrator
------------------------
- `pipeline/orchestrator.ts` — orchestrator that runs pipeline jobs (sets up working dirs, invokes runners)
- `pipeline/runner.ts` — runner abstraction (HostRunner, DockerRunner)
- `pipeline/*` — CI/runner scripts used when performing isolated runs

Pipeline libraries (core runtime)
---------------------------------
- `src/lib/pipeline-planning.ts` — planning detection, prompts construction, research/write/self-review helpers
- `src/lib/pipeline-runtime.ts` — runtime state shapes, resume logic, stall detection
- `src/lib/pipeline-supervisor.ts` — supervisor logic and retry/escalation behavior (mentions Claude auth fallback)
- `src/lib/pipeline-control.ts` — copies `.claude` templates into project dir, manages pkill/cleanup and process lifecycle control
- `src/lib/pipeline-signal.ts` — signaling helpers (start/stop/resume)
- `src/lib/use-pipeline.ts` — runtime hooks for UI to interact with pipeline state

API & server
------------
- `src/app/api/*` — API endpoints for pipeline control and chat: `start-pipeline`, `stop-pipeline`, `resume-pipeline`, `chat`, `pipeline-control`, `plan`, etc.

Frontend
--------
- `src/app/*` — Next.js app router entries (pages): `page.tsx`, `layout.tsx`, `globals.css`
- `src/components/*` — React components for UI (agents, mission scenes, shared components)

Scripts & utilities
-------------------
- `scripts/probe-auth.sh` — probes `claude` binary and `~/.claude.json` for local auth; runs `claude` with model flags to check access
- `scripts/*.mjs` — test scripts that exercise pipeline planning, runtime, supervisor behaviors

CLAs and templates
------------------
- `.claude/*` (templates under `BUILDUI_DIR/.claude`) — settings and hook scripts copied into project by `pipeline-control.ts` at job start

Notes
-----
Check the `src/lib/*` files for behavior details and `ARCHITECTURE.md` for the high-level mental model. The `scripts/` folder contains helpers used by the pipeline and tests to validate authentication and runtime invariants.
