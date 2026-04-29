import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const BUILDS_DIR = join(homedir(), 'Builds');

const REGISTRY_DIR = join(homedir(), '.dev-squad');
const LAST_PROJECT_FILE = join(REGISTRY_DIR, 'last-project.json');

function isTrackedProject(projectDir: string): boolean {
  try {
    return statSync(projectDir).isDirectory() && statSync(join(projectDir, 'pipeline-events.json')).isFile();
  } catch {
    return false;
  }
}

export function writeLatestProject(projectDir: string) {
  try {
    mkdirSync(REGISTRY_DIR, { recursive: true });
    writeFileSync(
      LAST_PROJECT_FILE,
      JSON.stringify({ projectDir, updatedAt: new Date().toISOString() }, null, 2)
    );
  } catch {
    // ignore persistence failures
  }
}

export function readLatestProject(): string | null {
  try {
    if (!existsSync(LAST_PROJECT_FILE)) return null;
    const raw = JSON.parse(readFileSync(LAST_PROJECT_FILE, 'utf8')) as { projectDir?: string };
    const candidate = String(raw?.projectDir || '').trim();
    if (!candidate) return null;
    return isTrackedProject(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function findLatestProject(): string | null {
  const pinned = readLatestProject();
  if (pinned) return pinned;

  try {
    const dirs = readdirSync(BUILDS_DIR)
      .filter((name) => name !== '.staging' && name !== '.manual')
      .map((name) => join(BUILDS_DIR, name))
      .filter((projectDir) => isTrackedProject(projectDir))
      .sort(
        (a, b) =>
          statSync(join(b, 'pipeline-events.json')).mtimeMs - statSync(join(a, 'pipeline-events.json')).mtimeMs
      );

    return dirs[0] || null;
  } catch {
    return null;
  }
}