import { ModelAdapter, AdapterSpawnOptions, spawnLocal, captureCommandOutput, collectConfiguredModelIds, commandExists, extractLikelyModelIds } from './ModelAdapter';

export class ClaudeCliAdapter implements ModelAdapter {
  isAvailable(): boolean {
    return commandExists('claude');
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions) {
    if (!commandExists('claude')) {
      throw new Error('The `claude` CLI is not available on PATH.');
    }
    return spawnLocal('claude', opts.args, opts);
  }

  async discoverModels(): Promise<string[]> {
    const tries: string[][] = [
      ['claude', '--list-models'],
      ['claude', 'list-models'],
      ['claude', '--models'],
      ['claude', 'models'],
    ];

    const found = new Set<string>(collectConfiguredModelIds());
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

        for (const token of extractLikelyModelIds(out)) found.add(token);
      } catch {
        /* ignore */
      }
    }

    return Array.from(found).sort();
  }
}

export default ClaudeCliAdapter;
