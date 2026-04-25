# Dev Squad runbook (updated)

Date: 2026-04-24

## 0) Go to repo

```bash
cd /Users/stillbulldog35/Documents/personalGithub/the-dev-squad
```

## 1) Baseline compile

```bash
npx tsc --noEmit -p tsconfig.json
```

## 2) Provider discovery checks

```bash
npx tsx scripts/test-models.mjs claude-cli
npx tsx scripts/test-models.mjs ccr
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-models.mjs openai-http
npx tsx scripts/test-models.mjs lm-studio
```

## 3) Manual provider/session regression test

This specifically verifies:
- provider switch is applied in backend,
- model switch is applied in backend,
- resumed manual sessions no longer fail with missing `systemPrompt`.

```bash
npx tsx scripts/test-chat-manual-provider-switch.mjs
```


## 3b) Real provider smoke (manual route)

```bash
npx tsx scripts/test-chat-provider-smoke.mjs claude-cli haiku
npx tsx scripts/test-chat-provider-smoke.mjs openclaude haiku
npx tsx scripts/test-chat-provider-smoke.mjs occ claude-sonnet-4-6
npx tsx scripts/test-chat-provider-smoke.mjs ccr haiku
```

## 4) Chat route robustness

```bash
npx tsx scripts/test-chat-logging.mjs
```

## 5) HTTP provider execution (OpenAI-compatible path)

```bash
npx tsx scripts/test-http-runner.mjs
```

## 6) CLI provider execution snapshot

```bash
npx tsx scripts/test-cli-adapters.mjs
# use --strict only in fully-authenticated env
npx tsx scripts/test-cli-adapters.mjs --strict
```

## 7) Pipeline start precondition check

```bash
npx tsx scripts/test-start-pipeline.mjs
```

If it returns:
`No staging session found. Talk to S or A first.`
that is expected precondition behavior.

## 8) Full verification bundle

```bash
npx tsc --noEmit -p tsconfig.json && \
npx tsx scripts/test-models.mjs claude-cli && \
npx tsx scripts/test-models.mjs ccr && \
npx tsx scripts/test-models.mjs occ && \
npx tsx scripts/test-models.mjs openclaude && \
npx tsx scripts/test-models.mjs openai-http && \
npx tsx scripts/test-models.mjs lm-studio && \
npx tsx scripts/test-chat-manual-provider-switch.mjs && \
npx tsx scripts/test-chat-logging.mjs && \
npx tsx scripts/test-http-runner.mjs && \
npx tsx scripts/test-cli-adapters.mjs && \
npx tsx scripts/test-start-pipeline.mjs
```

## 9) RAG local memory build/query

```bash
cd devSquadMemory
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python build_local_embeddings.py
./.venv/bin/python query_helper.py --query "how is provider chosen in pipeline" --topk 5
```

## 10) Docker provider image (occ/openclaude)

```bash
docker build -t dev-squad-agent:occ -f pipeline/Dockerfile.agent.occ pipeline/
export PIPELINE_DOCKER_AGENT_IMAGE=dev-squad-agent:occ
```

Optional command override:

```bash
export PIPELINE_DOCKER_AGENT_CMD="/usr/local/share/npm-global/bin/occ"
```

## 11) Bedrock note

Bedrock execution requires valid AWS credentials/profile in the process runtime (host/container). Discovery output alone does not prove inference works.

---

## Rebase-recovery quick verify (cli-changes)

Use this after branch switches or rebases to re-confirm provider wiring:

```bash
npx tsc --noEmit -p tsconfig.json
npx tsx scripts/test-models.mjs claude-cli
npx tsx scripts/test-models.mjs ccr
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-models.mjs openai-http
npx tsx scripts/test-models.mjs lm-studio
npx tsx scripts/test-chat-manual-provider-switch.mjs
npx tsx scripts/test-chat-provider-smoke.mjs claude-cli haiku "Say OK"
npx tsx scripts/test-chat-provider-smoke.mjs ccr haiku "Say OK"
npx tsx scripts/test-chat-provider-smoke.mjs occ claude-sonnet-4-6 "Say OK"
npx tsx scripts/test-chat-provider-smoke.mjs openclaude haiku "Say OK"
```

If you see `RunnerOptions requires either roleFile or systemPrompt`, immediately run:

```bash
npx tsx scripts/test-chat-provider-smoke.mjs claude-cli haiku "diagnose-runner-options"
```

and inspect:

```bash
tail -n 200 logs/server-errors.log
```


### Extra deep diagnostics commands

```bash
npx tsx scripts/test-api-surface.mjs
npx tsx scripts/test-provider-model-isolation.mjs
npx tsx scripts/test-provider-tools-installed.mjs
npx tsx scripts/test-ui-control-wiring.mjs
npx tsx scripts/test-start-pipeline-provider-selection.mjs
```


```bash
npx tsx scripts/test-pipeline-route-controls.mjs
```


```bash
npx tsx scripts/test-api-extended-routes.mjs
```

