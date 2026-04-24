import { ModelAdapter, AdapterSpawnOptions } from './ModelAdapter';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

/**
 * OpenAI HTTP adapter (stub)
 *
 * This file contains a minimal stub demonstrating how an HTTP-backed adapter
 * could be implemented. It intentionally does not include a full HTTP client
 * implementation or direct network calls. Replace the spawn() implementation
 * with a process that streams responses from your chosen HTTP client or local
 * model server.
 */
export class OpenAIHttpAdapter implements ModelAdapter {
  isAvailable(): boolean {
    // Only available when OPENAI_API_KEY is present in the environment.
    return Boolean(process.env.OPENAI_API_KEY);
  }

  spawn(_opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    // This is intentionally a stub. Implementations should stream a
    // ChildProcessCompatible interface that exposes stdout/stderr and
    // supports on('close', ...).
    throw new Error('OpenAIHttpAdapter.spawn is a stub — implement network streaming or a local shim.');
  }
}

export default OpenAIHttpAdapter;
