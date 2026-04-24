import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput } from './ModelAdapter';

export class ClaudeCliAdapter implements ModelAdapter {
  isAvailable(): boolean {
    // Best-effort: check for a local `claude` binary on PATH using spawn.
    try {
      const child = spawnLocal('which', ['claude'], { args: [] });
      child.kill();
      return true;
    } catch {
      return false;
    }
  }

  spawn(opts: AdapterSpawnOptions) {
    // Delegate directly to the `claude` CLI. callers should pass the full
    // argument list via opts.args.
    return spawnLocal('claude', opts.args, opts);
  }

  async discoverModels(): Promise<string[]> {
    const tries: string[][] = [
      ['claude', '--list-models'],
      ['claude', 'list-models'],
      ['claude', '--models'],
      ['claude', 'models'],
    ];

    const found = new Set<string>();
    for (const t of tries) {
      try {
        const out = await captureCommandOutput(t[0], t.slice(1), { timeoutMs: 2500 });
        if (!out) continue;

        // If output looks like JSON, try parsing an array of model ids.
        try {
          const parsed = JSON.parse(out);
          if (Array.isArray(parsed)) {
            for (const v of parsed) if (typeof v === 'string') found.add(v);
            continue;
          }
        } catch {}

        const tokens = out.match(/[A-Za-z0-9\-\._]{3,}/g) || [];
        for (const token of tokens) {
          const tkn = token.trim();
          // Heuristic: prefer tokens that mention 'claude' or 'gpt' or contain
          // a hyphen with a digit (common model id patterns).
          const isLikelyModel = /claude|opus|sonnet|gpt|llama|mistral/i.test(tkn) || (tkn.includes('-') && /\d/.test(tkn));
          if (isLikelyModel) found.add(tkn);
        }
      } catch {
        /* ignore */
      }
    }

    return Array.from(found).sort();
  }
}

export default ClaudeCliAdapter;
