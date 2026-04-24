# Dev Squad runbook (updated)

Date: 2026-04-24

This runbook focuses on what is implemented and verified now.

## 0) Repo root

```bash
cd /Users/stillbulldog35/Documents/personalGithub/the-dev-squad
```

## 1) Baseline health checks

```bash
npx tsc --noEmit -p tsconfig.json
npx tsx scripts/test-chat-logging.mjs
npx tsx scripts/test-start-pipeline.mjs
```

## 2) Provider discovery checks

```bash
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-models.mjs openai-http
npx tsx scripts/test-models.mjs lm-studio
```

## 3) Provider execution checks

### 3.1 HTTP-backed providers (local deterministic mock)

Validates that `openai-http` + `lm-studio` execution path works end-to-end with stream-json output expected by Dev Squad.

```bash
npx tsx scripts/test-http-runner.mjs
```

### 3.2 CLI-backed providers snapshot

Runs real host CLI adapter smoke tests for `occ` and `openclaude`.

```bash
npx tsx scripts/test-cli-adapters.mjs
```

Notes:
- `openclaude` succeeded in this environment during latest verification.
- `occ` returned provider error in this environment due missing Anthropic auth for tested path.

## 4) Manual web flow smoke test

1. Start app.
2. Open UI, choose **Manual** mode.
3. Pick provider + model.
4. Send a short message.
5. Confirm response or readable provider error appears (no silent failure).

## 5) Pipeline flow smoke test

1. Choose provider/model in UI.
2. Start pipeline.
3. Confirm staged state stores selected provider/model.
4. Confirm orchestrator uses selected provider/model in runner spawn.

## 6) RAG / local vector memory

### Build vectors

```bash
cd devSquadMemory
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python build_local_embeddings.py
```

### Query vectors

```bash
./.venv/bin/python query_helper.py --query "how does runner spawn providers" --topk 5
```

Vector artifacts are under `devSquadMemory/` (`workspace_docs.jsonl`, `workspace_vectors.jsonl`, manifest).

## 7) Optional persistent retriever service

Not required for core chat flow. If enabled, wire via `RETRIEVER_URL` and keep fallback behavior.

## 8) Docker with occ/openclaude

Build:

```bash
docker build -t dev-squad-agent:occ -f pipeline/Dockerfile.agent.occ pipeline/
```

Run with env:

```bash
export PIPELINE_DOCKER_AGENT_IMAGE=dev-squad-agent:occ
# Optional explicit command
export PIPELINE_DOCKER_AGENT_CMD="/usr/local/share/npm-global/bin/occ"
```

Credential details: `docs/docker-credentials.md`.

## 9) Bedrock-specific note

Bedrock model discovery/execution depends on AWS credentials/profile availability in the runtime environment (host/container). Without valid creds, discovery may show configured IDs but execution will fail.

## 10) Troubleshooting quick list

- **"Unexpected end of JSON input"**
  - Chat route now wraps errors and returns JSON; check `logs/server-errors.log`.
- **Model list appears then disappears**
  - Check discovery metadata (`usedDiscovery`, `fallbackUsed`, `modelCount`) in `/api/models` responses.
- **No response from provider**
  - Confirm provider auth/env.
  - Run `scripts/test-cli-adapters.mjs` or `scripts/test-http-runner.mjs`.
- **HTTP provider unreachable**
  - Verify `OPENAI_BASE_URL` / `LM_STUDIO_BASE_URL` and endpoint compatibility.
