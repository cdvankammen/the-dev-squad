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

  // Optional: discover available model ids for this provider (best-effort).
  // Implementations should return an array of model id strings or an empty
  // array when discovery is not possible.
  discoverModels?: () => Promise<string[]>;
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

/**
 * Best-effort helper to run a command and capture its stdout until it exits
 * or the optional timeout elapses. This is intentionally forgiving: adapters
 * should not fail hard when discovery cannot be performed.
 */
export async function captureCommandOutput(
  command: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }
): Promise<string> {
  try {
    const proc = spawn(command, args, {
      cwd: opts?.cwd,
      env: opts?.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    if (proc.stdout) {
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (c) => { out += String(c); });
    }
    if (proc.stderr) {
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', () => { /* ignore stderr during discovery */ });
    }

    return await new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve(out);
      };
      proc.on('error', done);
      proc.on('close', done);
      if (opts?.timeoutMs) {
        setTimeout(() => {
          if (!finished) {
            try { proc.kill(); } catch {}
            done();
          }
        }, opts.timeoutMs);
      }
    });
  } catch {
    return '';
  }
}
