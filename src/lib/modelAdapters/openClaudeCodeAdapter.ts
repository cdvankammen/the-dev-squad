import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput, collectConfiguredModelIds, commandExists, extractLikelyModelIds } from './ModelAdapter';

/** Adapter for ruvnet/open-claude-code (occ) */
export class OpenClaudeCodeAdapter implements ModelAdapter {
  isAvailable(): boolean {
    return commandExists('occ') || commandExists('npx');
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions) {
    if (commandExists('occ')) {
      return spawnLocal('occ', opts.args || [], opts);
    }
    if (commandExists('npx')) {
      return spawnLocal('npx', ['@ruvnet/open-claude-code', ...(opts.args || [])], opts);
    }
    throw new Error('Neither `occ` nor `npx` is available for open-claude-code.');
  }

  async discoverModels(): Promise<string[]> {
    const tries: string[][] = [
      ['occ', '--list-models'],
      ['occ', 'list-models'],
      ['occ', 'models'],
      ['npx', '@ruvnet/open-claude-code', '--list-models'],
      ['npx', '@ruvnet/open-claude-code', 'list-models'],
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

export default OpenClaudeCodeAdapter;
