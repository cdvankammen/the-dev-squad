import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput } from './ModelAdapter';

/** Adapter for ruvnet/open-claude-code (occ) */
export class OpenClaudeCodeAdapter implements ModelAdapter {
  isAvailable(): boolean {
    // Available if `occ` is on PATH or `npx` is available to run the package.
    try {
      const child = spawnLocal('which', ['occ'], { args: [] });
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
    // Prefer the installed `occ` binary. If not present, fall back to
    // `npx @ruvnet/open-claude-code ...` so users can run without global install.
    try {
      return spawnLocal('occ', opts.args || [], opts);
    } catch {
      return spawnLocal('npx', ['@ruvnet/open-claude-code', ...(opts.args || [])], opts);
    }
  }

  async discoverModels(): Promise<string[]> {
    const tries: string[][] = [
      ['occ', '--list-models'],
      ['occ', 'list-models'],
      ['occ', 'models'],
      ['npx', '@ruvnet/open-claude-code', '--list-models'],
      ['npx', '@ruvnet/open-claude-code', 'list-models'],
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

export default OpenClaudeCodeAdapter;
