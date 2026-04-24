import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput, collectConfiguredModelIds, commandExists, extractLikelyModelIds } from './ModelAdapter';

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
    const tries: string[][] = [
      ['openclaude', '--list-models'],
      ['openclaude', 'list-models'],
      ['npx', '@gitlawb/openclaude', '--list-models'],
      ['npx', '@gitlawb/openclaude', 'list-models'],
    ];

    const found = new Set<string>(collectConfiguredModelIds());
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

        for (const token of extractLikelyModelIds(out)) found.add(token);
      } catch {
        /* ignore */
      }
    }

    return Array.from(found).sort();
  }
}

export default OpenClaudeAdapter;
