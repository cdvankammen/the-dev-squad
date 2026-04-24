import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput } from './ModelAdapter';

/** Adapter for Gitlawb/openclaude (openclaude) */
export class OpenClaudeAdapter implements ModelAdapter {
  isAvailable(): boolean {
    try {
      const child = spawnLocal('which', ['openclaude'], { args: [] });
      child.kill();
      return true;
    } catch {
      try {
        const child = spawnLocal('which', ['npx'], { args: [] });
        child.kill();
        return true;
      } catch {
        return false;
      }
    }
  }

  spawn(opts: AdapterSpawnOptions) {
    try {
      return spawnLocal('openclaude', opts.args || [], opts);
    } catch {
      return spawnLocal('npx', ['@gitlawb/openclaude', ...(opts.args || [])], opts);
    }
  }

  async discoverModels(): Promise<string[]> {
    const tries: string[][] = [
      ['openclaude', '--list-models'],
      ['openclaude', 'list-models'],
      ['npx', '@gitlawb/openclaude', '--list-models'],
      ['npx', '@gitlawb/openclaude', 'list-models'],
    ];

    const found = new Set<string>();
    for (const t of tries) {
      try {
        const out = await captureCommandOutput(t[0], t.slice(1), { timeoutMs: 2500 });
        if (!out) continue;

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

export default OpenClaudeAdapter;
