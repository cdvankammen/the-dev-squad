import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  collectConfiguredModelIds,
  commandExists,
  extractLikelyModelIds,
  ModelAdapter,
  normalizeModelIds,
  spawnLocal,
} from './ModelAdapter';

/**
 * Read models directly from CCR's config.json — the most reliable source.
 * CCR stores provider configs under ~/.claude-code-router/config.json.
 * Shape: { Providers: [{ name: string, models: string[] }, ...] }
 */
function readCcrConfigModels(): string[] {
  const configPath = join(homedir(), '.claude-code-router', 'config.json');
  if (!existsSync(configPath)) return [];
  try {
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as {
      Providers?: Array<{ name?: string; models?: string[] }>;
      Router?: Record<string, string>;
    };
    const found = new Set<string>();

    // Collect all model ids listed under each provider
    if (Array.isArray(config.Providers)) {
      for (const p of config.Providers) {
        if (Array.isArray(p.models)) {
          for (const m of p.models) {
            if (typeof m === 'string' && m.trim()) found.add(m.trim());
          }
        }
      }
    }

    // Also extract model names referenced by the Router routes (e.g. "lmstudio,model-name")
    if (config.Router && typeof config.Router === 'object') {
      for (const route of Object.values(config.Router)) {
        if (typeof route === 'string') {
          const parts = route.split(',');
          if (parts.length >= 2) {
            const modelPart = parts.slice(1).join(',').trim();
            if (modelPart) found.add(modelPart);
          }
        }
      }
    }

    return Array.from(found).sort();
  } catch {
    return [];
  }
}

/** Adapter for Claude Code Router (`ccr`) wrapper CLI */
export class ClaudeCodeRouterAdapter implements ModelAdapter {
  private resolveCommand(): string | null {
    if (process.env.CCR_BIN && process.env.CCR_BIN.trim()) {
      return process.env.CCR_BIN.trim();
    }
    if (commandExists('ccr')) return 'ccr';
    return null;
  }

  isAvailable(): boolean {
    return Boolean(this.resolveCommand());
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions) {
    const cmd = this.resolveCommand();
    if (!cmd) {
      throw new Error('`ccr` was not found on PATH. Install/configure Claude Code Router first.');
    }

    const args = [...(opts.args || [])];

    // ccr requires --verbose whenever stream-json is requested.
    const outIdx = args.indexOf('--output-format');
    if (outIdx >= 0 && args[outIdx + 1] === 'stream-json' && !args.includes('--verbose')) {
      args.splice(outIdx, 0, '--verbose');
    }

    // In `ccr code --print` mode, passing the prompt via stdin is more reliable
    // than positional argv forwarding.
    let promptFromArgs: string | null = null;
    if (args.length > 0) {
      const last = args[args.length - 1];
      if (typeof last === 'string' && !last.startsWith('-')) {
        promptFromArgs = last;
        args.pop();
      }
    }

    const child = spawnLocal(cmd, ['code', ...args], opts);
    if (promptFromArgs && child.stdin) {
      child.stdin.write(`${promptFromArgs}\n`);
      child.stdin.end();
    }
    return child;
  }

  async discoverModels(): Promise<string[]> {
    const cmd = this.resolveCommand();
    // Seed with any models declared in claude settings / env — normalize away Bedrock ARNs.
    const found = new Set<string>(normalizeModelIds(collectConfiguredModelIds()));

    // Primary: read CCR's config.json directly — this is the most reliable source
    // because CCR does not expose a machine-readable --list-models CLI flag.
    const configModels = readCcrConfigModels();
    for (const m of configModels) found.add(m);

    // If config provided models, return early — no need to call the CLI.
    if (configModels.length > 0) {
      return Array.from(found).sort();
    }

    // Fallback: try various CLI flags (these rarely work but worth trying)
    if (!cmd) return Array.from(found).sort();

    const tries: string[][] = [
      [cmd, 'model', '--json'],
      [cmd, 'model', 'list', '--json'],
      [cmd, 'model', 'list'],
      [cmd, 'models', '--json'],
      [cmd, 'models'],
      [cmd, 'list-models'],
      [cmd, '--list-models'],
    ];

    for (const t of tries) {
      try {
        const out = await captureCommandOutput(t[0], t.slice(1), { timeoutMs: 2500 });
        if (!out) continue;
        try {
          const parsed = JSON.parse(out);
          if (Array.isArray(parsed)) {
            for (const v of parsed) {
              if (typeof v === 'string') found.add(v);
              if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') {
                found.add((v as { id: string }).id);
              }
            }
            continue;
          }
        } catch {
          // non-json output, parse heuristically
        }

        for (const token of extractLikelyModelIds(out)) found.add(token);
      } catch {
        // try next command
      }
    }

    return Array.from(found).sort();
  }
}

export default ClaudeCodeRouterAdapter;
