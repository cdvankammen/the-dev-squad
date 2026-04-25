# Dev Squad Memory (workspace-local)

This folder contains all research/audit artifacts for this codebase and is intentionally kept inside the repo workspace.

## Key files

- `verification_report.md` — latest truth-based verification results
- `chat_audit.md` — claim-by-claim audit of the conversation outputs vs code reality
- `providers_and_terminals.md` — provider architecture, 5-agent concurrency explanation
- `runbook.md` — reproducible command runbook
- `main_vs_branch_analysis.md` — baseline (`main`) vs current branch analysis
- `deep_dive_100_5w1h_questions.md` — 100 structured 5W1H architecture challenge sets
- `ui_control_test_matrix.md` — UI controls mapped to verification status
- `provider_pipeline_functionality.md` — direct answers on provider selection + 5-agent behavior

## Provider reality (current)

Executable provider paths implemented:

- `claude-cli`
- `ccr` (Claude Code Router)
- `occ` (Open Claude Code)
- `openclaude`
- `openai-http` (via HTTP runner shim)
- `lm-studio` (via HTTP runner shim)

Runtime success for cloud/backed models still depends on env auth/config (AWS/Bedrock, Anthropic/OpenAI keys, local endpoint reachability).

## Vector memory artifacts

This folder also includes local vector memory scripts/artifacts:

- `build_local_embeddings.py`
- `query_helper.py`
- `workspace_docs.jsonl`
- `workspace_vectors.jsonl`
- `vector_db_manifest.md`

---

## Rebase recovery note (2026-04-24)

After a branch switch rollback, a full re-audit was rerun on `cli-changes`.

Use these first when re-validating:

```bash
npx tsc --noEmit -p tsconfig.json
npx tsx scripts/test-models.mjs claude-cli
npx tsx scripts/test-models.mjs ccr
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-chat-manual-provider-switch.mjs
npx tsx scripts/test-chat-provider-smoke.mjs claude-cli haiku "Say OK"
npx tsx scripts/test-chat-provider-smoke.mjs ccr haiku "Say OK"
```

If chat reports 500s, inspect:

- `devSquadMemory/chat_audit.md`
- `devSquadMemory/verification_report.md`
- `logs/server-errors.log`
