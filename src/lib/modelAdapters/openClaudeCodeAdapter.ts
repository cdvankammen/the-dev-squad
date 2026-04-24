import { ModelAdapter, AdapterSpawnOptions, spawnLocal } from './ModelAdapter';

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
}

export default OpenClaudeCodeAdapter;
