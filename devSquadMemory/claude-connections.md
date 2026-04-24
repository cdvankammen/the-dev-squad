How the code connects to Claude (evidence & notes)
===============================================

Summary
-------
The repository uses the `claude` CLI as the primary LLM execution path. Claude sessions are spawned as child processes by the Runner/orchestrator or by shell scripts. Key integration points copy `.claude` settings into the project workspace and install `PreToolUse` hooks to enforce pipeline guardrails.

Evidence (file excerpts & locations)
------------------------------------
- `scripts/probe-auth.sh` — sets `CLAUDE_BIN` (default `claude`) and `CLAUDE_JSON="${HOME}/.claude.json"`. The script invokes the `claude` binary to verify authentication and uses flags like `--permission-mode auto --model claude-sonnet-4-6`.
  - Path: `scripts/probe-auth.sh`
  - Example usage in script: `CLAUDE_BIN...` and `"$CLAUDE_BIN" -p "$PROMPT_TEXT" --permission-mode auto --model claude-sonnet-4-6 --output-format "$OUTPUT_FORMAT"`

- `src/lib/pipeline-control.ts` — responsible for copying `.claude` templates into the project directory and making `approval-gate.sh` executable:
  - Copies `BUILDUI_DIR/.claude/settings.json` to `projectDir/.claude/settings.json`
  - Copies `BUILDUI_DIR/.claude/hooks/approval-gate.sh` into the project and runs `chmod +x` on it
  - Uses `pkill -f "claude.*--output-format.*stream-json"` to tidy up running Claude processes when stopping a pipeline
  - Path: `src/lib/pipeline-control.ts`

- `src/lib/pipeline-supervisor.ts` — contains user-facing messages indicating that Docker workers may fail to authenticate with Claude subscriptions and that the supervisor will retry on the host. This documents the failing Docker-worker -> host retry path.
  - Path: `src/lib/pipeline-supervisor.ts`

- `ARCHITECTURE.md` — canonical description of how Claude sessions are started and how the runner abstraction works (quotes like: "All sessions: claude --permission-mode auto --model claude-opus-4-6"). It also notes the runner abstraction (`pipeline/runner.ts`).
  - Path: `ARCHITECTURE.md`

Environment flags & guardrails
-----------------------------
- `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` — used to keep Bash `cd` from persisting into later tool calls in pipeline sessions (documented in `ARCHITECTURE.md`).
- `PIPELINE_PERMISSION_MODE` — toggles Claude permission classifier behaviors (e.g., `--permission-mode auto` vs other modes).
- Hooks: `pipeline/.claude/hooks/approval-gate.sh` inspects `PIPELINE_AGENT` and other environment variables to decide whether to allow tool use inside a pipeline session.

Authentication
--------------
- Local auth is handled via `~/.claude.json` (or the `CLAUDE_JSON` path used by `probe-auth.sh`). The code copies settings.json template to `projectDir/.claude/settings.json` at job start to provide per-job config and hooks.

Operational notes
-----------------
- The Runner will prefer the host runner due to known reliability issues with authenticating subscriptions inside Docker containers. If Docker auth fails for an isolated worker, the supervisor retries the turn on the host.
- Processes are sometimes run with `--output-format stream-json` and the code relies on pattern-matching when killing processes (see `pkill -f "claude.*--output-format.*stream-json"`).

Action items / follow-ups
------------------------
- Confirm where runtime credentials for production are expected to live (CI secrets, `~/.claude.json`, or other secret mount).
- Decide whether to centralize `.claude` templates under an accessible infra repo for consistent job runs.

Relevant files to inspect further
--------------------------------
- `scripts/probe-auth.sh`
- `src/lib/pipeline-control.ts`
- `src/lib/pipeline-supervisor.ts`
- `pipeline/runner.ts`
- `ARCHITECTURE.md`
