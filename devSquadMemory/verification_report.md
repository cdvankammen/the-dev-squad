# Verification report

Date: 2026-04-24

## Commands run

### Core repo verification

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
npm run test:runner
npm run test:hook
npm run test:runtime
npm run test:planning
npm run test:supervisor
npm run test:supervisor-concept
npm run test:supervisor-intents
```

### Provider / API verification

```bash
npx tsx scripts/test-models.mjs occ
npx tsx scripts/test-models.mjs openclaude
npx tsx scripts/test-models.mjs openai-http
npx tsx scripts/test-models.mjs lm-studio
npx tsx scripts/test-chat-logging.mjs
npx tsx scripts/test-start-pipeline.mjs
```

## Results

### Passed

- TypeScript check passed
- Next.js production build passed
- Runner tests passed
- Hook-contract tests passed
- Pipeline runtime tests passed
- Pipeline planning tests passed
- Supervisor snapshot tests passed
- Supervisor concept tests passed
- Supervisor intents tests passed
- Chat logging test passed
- Start-pipeline route test passed at the business-logic level (it correctly refused to start because no staging session existed)

### Provider-specific status

- `claude-cli`: executable provider path verified at code level; model discovery is best-effort and depends on local Claude config
- `occ`: executable provider path verified at code level; current discovered list in this environment is:
	- `arn:aws:bedrock:us-east-1:013925090051:inference-profile/global.anthropic.claude-sonnet-4-6`
	- `claude-sonnet-4-6`
	- `haiku`
- `openclaude`: executable provider path verified at code level; current discovered list in this environment is:
	- `arn:aws:bedrock:us-east-1:013925090051:inference-profile/global.anthropic.claude-sonnet-4-6`
	- `haiku`
- `openai-http`: discovery-only, not an executable runner provider in this repo today; current discovered list is `[]`
- `lm-studio`: discovery-only, not an executable runner provider in this repo today; current discovered list is `[]`

## Important fix applied during verification

The repo build initially failed because `devSquadMemory/.venv` existed in the workspace and Turbopack followed symlinks inside it.

That generated venv was removed and the docs were corrected to avoid recreating that problem as a permanent workspace artifact.

## What “verified” means here

Verified means one of:

- the code path was executed by a repo script or build/test command, or
- the code path was inspected and confirmed to be wired correctly, or
- the upstream docs were checked for provider capability claims

It does **not** mean I invoked your private Bedrock account or your local LM Studio instance. Those require your actual credentials/endpoints at runtime.

## Start-pipeline note

`scripts/test-start-pipeline.mjs` currently returns:

```json
{ "success": false, "error": "No staging session found. Talk to S or A first." }
```

That is an expected guardrail result, not a route crash. The happy path requires a real staging concept/session first.

## Re-review (2026-04-24, second full pass)

Re-ran a full verification sweep after all fixes and documentation updates.

### Re-run commands and results

- `npx tsc --noEmit -p tsconfig.json` ✅ pass
- `npm run build` ✅ pass
- `npm run test:runner` ✅ pass
- `npm run test:hook` ✅ pass
- `npm run test:runtime` ✅ pass
- `npm run test:planning` ✅ pass
- `npm run test:supervisor` ✅ pass
- `npm run test:supervisor-concept` ✅ pass
- `npm run test:supervisor-intents` ✅ pass
- `npx tsx scripts/test-models.mjs occ` ✅ pass, 3 models found
- `npx tsx scripts/test-models.mjs openclaude` ✅ pass, 2 models found
- `npx tsx scripts/test-models.mjs openai-http` ✅ pass, 0 models (discovery-only)
- `npx tsx scripts/test-models.mjs lm-studio` ✅ pass, 0 models (discovery-only)
- `npx tsx scripts/test-chat-logging.mjs` ✅ pass (expected 500 path exercised)
- `npx tsx scripts/test-start-pipeline.mjs` ✅ expected guarded failure (`No staging session found. Talk to S or A first.`)

### Current truth snapshot

- Core app compile/build/tests are green.
- `occ` and `openclaude` are executable runner providers in this repo.
- `openai-http` and `lm-studio` remain discovery-only providers in this repo.
- Bedrock model discovery and execution still depend on having valid runtime credentials/configuration in the same host/container environment.
