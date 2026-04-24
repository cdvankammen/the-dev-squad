# Dev Squad chat/conversation audit (latest)

Date: 2026-04-24

## Scope

Audited substantive claims from the pasted Copilot conversation against current code and executed tests.

## High-confidence validated claims

- Multi-provider adapter framework exists and is wired through runner/api.
- Provider/model selection is propagated from UI -> API -> runner in manual mode.
- Pipeline start stores selected provider/model and orchestrator reads them.
- Chat API now returns JSON errors and logs unexpected failures.
- Local RAG/vector artifacts and query scripts exist in `devSquadMemory/`.

## Corrected in this audit pass

1. **Manual chat 500 fix**
   - Issue: resumed sessions could omit both `roleFile` and `systemPrompt`.
   - Fix: manual path now always sets `systemPrompt`.

2. **Provider model-list cross-leak reduction**
   - UI provider change now resets to provider-scoped fallback before discovery.
   - `openai-http` and `lm-studio` discovery no longer pull global configured model IDs.

3. **CCR provider support**
   - Added `ccr` adapter and provider API visibility.

## Current runtime truth snapshot

- `openclaude`: good smoke-test execution in this env.
- `openai-http`/`lm-studio`: executable via HTTP shim; validated with mock server.
- `occ`: discovery works; execution stream characteristics still environment/profile dependent.
- `ccr`: discovery works; manual provider smoke route calls return 200; detailed event shape remains wrapper/version dependent.

## Important caveat

Discovery output is not equal to successful inference. Real execution still depends on auth/config/runtime compatibility for each provider.
