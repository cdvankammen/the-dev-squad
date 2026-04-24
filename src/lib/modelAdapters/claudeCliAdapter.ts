import { ModelAdapter, AdapterSpawnOptions, spawnLocal } from './ModelAdapter';

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
}

export default ClaudeCliAdapter;
