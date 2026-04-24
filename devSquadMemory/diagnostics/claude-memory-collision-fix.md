# Claude duplicate tool-name fix (`memory` collision)

## Root cause

The failing Claude payload contains duplicate tool names for `memory` from two providers:

1. Copilot memory tool (`Manage a persistent memory system with three scopes...`)
2. Agent Memory extension tool (`digitarald.agent-memory`, description starts with `Enables storing and retrieving information across conversations...`)

Claude endpoint enforces unique tool names in payload, so duplicate `memory` causes `400 {"message":"tools: Tool names must be unique."}`.

## What is already applied in this workspace

- `.vscode/settings.json`
  - `"github.copilot.chat.copilotMemory.enabled": false`
- `.vscode/extensions.json`
  - marks `digitarald.agent-memory` as unwanted recommendation
- Insiders extension folder was disabled on disk (reversible):
  - from: `~/.vscode-insiders/extensions/digitarald.agent-memory-0.1.66`
  - to: `~/.vscode-insiders/extensions/digitarald.agent-memory-0.1.66.disabled`
- Verifier scripts:
  - `devSquadMemory/tools/check_payload_duplicates.py`
  - `devSquadMemory/tools/find_request_tools.py`
  - `devSquadMemory/tools/verify_claude_duplicate_fix.sh`

## Required user action

1. Run **Developer: Reload Window** in VS Code Insiders.
2. Retry your Claude request.

If you want to restore the extension later:

```bash
mv ~/.vscode-insiders/extensions/digitarald.agent-memory-0.1.66.disabled ~/.vscode-insiders/extensions/digitarald.agent-memory-0.1.66
```

## Verify after retry

Run with the new request id from the error banner:

```bash
bash devSquadMemory/tools/verify_claude_duplicate_fix.sh <new-copilot-request-id>
```

Expected:

- `Duplicate names: 0`
- `OK: no duplicate tool names in latest payload for this request id.`

If duplicates remain, share that new request id and I’ll trace the exact `tools_*.json` file and remaining conflicting tool names.
