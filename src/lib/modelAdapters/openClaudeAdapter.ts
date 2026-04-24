import { ModelAdapter, AdapterSpawnOptions, spawnLocal } from './ModelAdapter';

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
}

export default OpenClaudeAdapter;
