import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_PATH = join(LOG_DIR, 'server-errors.log');

export function appendServerLog(message: string, meta?: Record<string, unknown>) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const ts = new Date().toISOString();
    const header = `[${ts}] ${message}`;
    const body = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
    appendFileSync(LOG_PATH, header + body + '\n\n', { encoding: 'utf8' });
  } catch {
    // best-effort logging only
  }
}

export default appendServerLog;
