import { writeFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Atomically write JSON to a file by writing to a temporary file then renaming.
 */
export function atomicWriteJson(filePath: string, data: Record<string, unknown>) {
  const dir = dirname(filePath);
  const tmp = join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  try {
    // Use rename (atomic on POSIX) to replace the destination.
    // eslint-disable-next-line node/no-sync
    require('fs').renameSync(tmp, filePath);
  } catch (err) {
    // If rename fails, attempt a best-effort final write
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
