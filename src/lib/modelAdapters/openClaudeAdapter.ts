import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput, collectConfiguredModelIds, commandExists, extractLikelyModelIds, normalizeModelIds } from './ModelAdapter';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Adapter for Gitlawb/openclaude (openclaude) */
export class OpenClaudeAdapter implements ModelAdapter {
  isAvailable(): boolean {
    return commandExists('openclaude') || commandExists('npx');
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions) {
    if (commandExists('openclaude')) {
      return spawnLocal('openclaude', opts.args || [], opts);
    }
    if (commandExists('npx')) {
      return spawnLocal('npx', ['@gitlawb/openclaude', ...(opts.args || [])], opts);
    }
    throw new Error('Neither `openclaude` nor `npx` is available.');
  }

  async discoverModels(): Promise<string[]> {
    const found = new Set<string>(collectConfiguredModelIds());

    // openclaude does not support --list-models or any machine-readable model
    // listing command. It is a thin wrapper over the claude CLI and honours the
    // same claude model IDs.  Read from its config files instead of running
    // interactive CLI probes (which either error or hang).
    const configPaths = [
      join(homedir(), '.openclaude', 'config.json'),
      join(homedir(), '.config', 'openclaude', 'config.json'),
    ];
    for (const configPath of configPaths) {
      if (!existsSync(configPath)) continue;
      try {
        const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        for (const key of ['model', 'defaultModel', 'selectedModel']) {
          if (typeof raw[key] === 'string' && (raw[key] as string).trim()) {
            found.add((raw[key] as string).trim());
          }
        }
      } catch { /* corrupt config — skip */ }
    }

    // Try a single, short, non-interactive probe: some openclaude versions support
    // a `models` sub-command that exits immediately.
    try {
      const out = await captureCommandOutput('openclaude', ['models'], { timeoutMs: 1500 });
      if (out) {
        try {
          const parsed = JSON.parse(out);
          if (Array.isArray(parsed)) {
            for (const v of parsed) if (typeof v === 'string') found.add(v);
          }
        } catch {
          for (const token of extractLikelyModelIds(out)) found.add(token);
        }
      }
    } catch { /* command not available */ }

    // openclaude supports the standard Anthropic claude model IDs.  Always
    // include these so the dropdown is never empty even when config/probe fails.
    for (const m of ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5']) {
      found.add(m);
    }

    // Normalise: convert any Bedrock ARNs / dot-prefixed IDs to short names.
    return normalizeModelIds(found);
  }
}

export default OpenClaudeAdapter;
