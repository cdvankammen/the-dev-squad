import {
  AdapterSpawnOptions,
  captureCommandOutput,
  collectConfiguredModelIds,
  commandExists,
  extractLikelyModelIds,
  ModelAdapter,
  spawnLocal,
} from './ModelAdapter';

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
    const found = new Set<string>(collectConfiguredModelIds());
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
