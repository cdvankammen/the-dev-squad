Prevent runtime duplicates — usage and snippet

Problem: Copilot/extension runtime merges many tool lists from different sessions and extensions, producing duplicate tool `name` entries in the merged payload. The server rejects payloads with duplicate `name` values.

Mitigations (local):

1) Namespace workspace-declared tool names (already recommended): `skill.<folder>.<tool>`.

2) Add a pre-send dedupe step in any code that assembles a `tools` array before sending to Copilot server. Example (JS):

```js
function dedupeToolsByName(tools) {
  const seen = new Set();
  const out = [];
  for (const t of tools) {
    const name = t && (t.name || t.id || t.type);
    if (!name) { out.push(t); continue; }
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(t);
  }
  return out;
}
```

Call `dedupeToolsByName(toolsArray)` just before packaging the payload.

3) Use the repo-local dedupe/check tools saved at `devSquadMemory/tools/` to detect duplicates proactively and to generate a deduped merged payload for inspection:

- `devSquadMemory/tools/dedupe_tools.py` — creates `devSquadMemory/diagnostics/merged_tools_deduped.json` and `merged_summary.txt`.
- `devSquadMemory/tools/check_and_exit.sh` — wrapper script that runs the dedupe script and exits non-zero if duplicates remain.

4) Monitoring (optional): set up a periodic job (cron/launchd) to run `devSquadMemory/tools/check_and_exit.sh` and alert when duplicates are present.

Limitations: The local scripts only detect and produce a deduped merged payload; they cannot prevent the Copilot extension from sending the original payload. The robust fix requires either dedupe in the client (where the payload is assembled) or a server-side dedupe.
