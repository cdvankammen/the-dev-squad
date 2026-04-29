import { spawn } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';

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

const preferredPort = Number(process.env.PORT || 3000);
const port = await findOpenPort(Number.isFinite(preferredPort) ? preferredPort : 3000);
const distDir = `.next-instances/port-${port}`;

try {
  rmSync('.vexp/daemon.sock', { force: true });
} catch {
  // ignore socket cleanup failures
}

mkdirSync('.next-instances', { recursive: true });

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