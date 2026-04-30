import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname } from 'path';

export type JsonState = Record<string, unknown>;

const WAIT_ARRAY = new Int32Array(new SharedArrayBuffer(4));
const DEFAULT_TIMEOUT_MS = 750;
const DEFAULT_RETRY_MS = 10;
const STALE_LOCK_MIN_MS = 10_000;

type LockMeta = {
  pid: number;
  token: string;
  createdAt: number;
};

type HeldLock = {
  fd: number;
  token: string;
};

function sleepMs(ms: number) {
  if (ms <= 0) return;
  Atomics.wait(WAIT_ARRAY, 0, 0, ms);
}

function parseLockMeta(lockFile: string): LockMeta | null {
  try {
    const raw = readFileSync(lockFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LockMeta>;
    if (
      parsed &&
      typeof parsed.pid === 'number' &&
      typeof parsed.token === 'string' &&
      typeof parsed.createdAt === 'number'
    ) {
      return parsed as LockMeta;
    }
  } catch {}
  return null;
}

function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return err?.code === 'EPERM';
  }
}

function acquireLock(lockFile: string, timeoutMs: number, retryMs: number): HeldLock {
  const started = Date.now();
  const staleAfterMs = Math.max(timeoutMs * 2, STALE_LOCK_MIN_MS);

  while (true) {
    try {
      const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const fd = openSync(lockFile, 'wx');
      const meta: LockMeta = { pid: process.pid, token, createdAt: Date.now() };
      writeFileSync(lockFile, JSON.stringify(meta), 'utf8');
      return { fd, token };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'EEXIST') throw error;

      try {
        const statBefore = statSync(lockFile);
        const ageMs = Date.now() - statBefore.mtimeMs;
        const metaBefore = parseLockMeta(lockFile);
        const ownerAlive = metaBefore?.pid ? isPidAlive(metaBefore.pid) : false;
        if (ageMs > staleAfterMs) {
          if (!ownerAlive) {
            const statNow = statSync(lockFile);
            const metaNow = parseLockMeta(lockFile);
            const sameToken = !!metaBefore?.token && metaNow?.token === metaBefore.token;
            const sameUntokenedFile = !metaBefore && !metaNow && statNow.mtimeMs === statBefore.mtimeMs;
            if (sameToken || sameUntokenedFile) {
              unlinkSync(lockFile);
              continue;
            }
          }
        }
      } catch {}

      if (Date.now() - started >= timeoutMs) {
        throw new Error(`Timed out waiting for state lock: ${lockFile}`);
      }
      sleepMs(retryMs);
    }
  }
}

function withFileLock<T>(
  filePath: string,
  fn: () => T,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryMs = DEFAULT_RETRY_MS
): T {
  mkdirSync(dirname(filePath), { recursive: true });
  const lockFile = `${filePath}.lock`;
  const lock = acquireLock(lockFile, timeoutMs, retryMs);

  try {
    return fn();
  } finally {
    try {
      closeSync(lock.fd);
    } catch {}
    try {
      const meta = parseLockMeta(lockFile);
      if (!meta || meta.token === lock.token) {
        unlinkSync(lockFile);
      }
    } catch {}
  }
}

export function withLockedJsonState<T>(
  filePath: string,
  fn: (state: JsonState | null) => T,
  options?: { timeoutMs?: number; retryMs?: number }
): T {
  return withFileLock(
    filePath,
    () => fn(readJsonState(filePath)),
    options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options?.retryMs ?? DEFAULT_RETRY_MS
  );
}

export function readJsonState(filePath: string): JsonState | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as JsonState;
  } catch (error) {
    console.warn(`[state] failed to parse JSON state: ${filePath}`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

export function writeJsonStateAtomic(filePath: string, state: JsonState) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tempPath, JSON.stringify(state, null, 2));
  renameSync(tempPath, filePath);
}

export function writeJsonStateLocked(
  filePath: string,
  state: JsonState,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryMs = DEFAULT_RETRY_MS
) {
  withFileLock(filePath, () => {
    writeJsonStateAtomic(filePath, state);
  }, timeoutMs, retryMs);
}

export function mutateJsonStateLocked(
  filePath: string,
  mutator: (state: JsonState) => void,
  options?: {
    createIfMissing?: () => JsonState;
    timeoutMs?: number;
    retryMs?: number;
  }
): JsonState | null {
  return withFileLock(filePath, () => {
    let state = readJsonState(filePath);
    if (!state) {
      if (!options?.createIfMissing) return null;
      state = options.createIfMissing();
    }

    mutator(state);
    writeJsonStateAtomic(filePath, state);
    return state;
  }, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS, options?.retryMs ?? DEFAULT_RETRY_MS);
}
