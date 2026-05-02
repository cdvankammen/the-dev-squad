import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import { join, resolve } from 'node:path';

function isPortFree(port) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolvePort(false));
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolvePort(true));
    });
  });
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 25; port += 1) {
    if (await isPortFree(port)) return port;
  }
  return startPort;
}

async function reapPort(port) {
  const result = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
  if (result.error) {
    console.warn(`[dev] warning: could not inspect listeners on port ${port}: ${result.error.message}`);
    return;
  }

  const pids = [...new Set(
    String(result.stdout || '')
      .split(/\s+/)
      .map((pid) => Number.parseInt(pid, 10))
      .filter(Number.isFinite)
  )];

  if (pids.length === 0) return;

  console.log(`[dev] stopping existing listener(s) on port ${port}: ${pids.join(', ')}`);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore processes that already exited or cannot be signaled
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await isPortFree(port)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isPortFree(port)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  throw new Error(`Port ${port} is still in use after attempting to stop existing listeners.`);
}

const preferredPort = Number(process.env.PORT || 3000);
const port = Number.isFinite(preferredPort) ? preferredPort : 3000;
await reapPort(port);
const usesDefaultDistRoot = !process.env.DEV_SQUAD_NEXT_DIST_ROOT;
const distRoot = process.env.DEV_SQUAD_NEXT_DIST_ROOT || '.next-runtime';
const distDir = join(distRoot, `port-${port}`);

try {
  rmSync('.vexp/daemon.sock', { force: true });
} catch {
  // ignore socket cleanup failures
}

mkdirSync(distRoot, { recursive: true });

try {
  if (usesDefaultDistRoot) {
    rmSync(distDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } else {
    for (const volatilePath of [
      join(distDir, 'dev', 'static', 'webpack'),
      join(distDir, 'dev', 'cache', 'webpack'),
      join(distDir, 'dev', 'trace'),
    ]) {
      rmSync(volatilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
} catch (error) {
  console.warn(`[dev] warning: could not clean stale Next dev output in ${distDir}: ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`[dev] starting Next.js on http://localhost:${port} using ${distDir}`);

const nextBin = resolve('node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '--port', String(port)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(port),
    NEXT_DEV_DIST_DIR: distDir,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});