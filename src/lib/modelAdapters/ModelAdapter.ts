import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

export interface AdapterSpawnOptions {
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ModelAdapter {
  // Return true if this adapter is available in the current environment
  isAvailable(): boolean;

  // Spawn a child process that implements the selected model provider's
  // streaming / CLI behavior. The returned ChildProcess must provide `stdout`
  // and `stderr` streams and support `on('close', ...)`.
  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams;
}

/**
 * Helper to spawn a local process using the same semantics used in the repo.
 * This is provided for convenience in adapter implementations.
 */
export function spawnLocal(command: string, args: string[], opts: AdapterSpawnOptions) {
  return spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
