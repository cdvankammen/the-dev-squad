/**
 * OllamaAdapter — Model adapter for Ollama local LLM runtime.
 *
 * Ollama exposes an OpenAI-compatible API at http://localhost:11434/v1,
 * so execution is handled by reusing the http-runner-shim.mjs shim (same
 * path used by lm-studio and openai-http adapters).
 *
 * Discovery sources (in order):
 * 1. `ollama list` CLI output (most reliable; uses binary at /usr/local/bin/ollama)
 * 2. HTTP GET to <BASE_URL>/api/tags (Ollama native endpoint)
 * 3. HTTP GET to <BASE_URL>/v1/models (OpenAI-compatible endpoint)
 * 4. OLLAMA_MODEL env var (manual override)
 *
 * Environment variables:
 *   OLLAMA_BASE_URL   — override base URL (default: http://localhost:11434)
 *   OLLAMA_MODEL      — comma-separated fallback model ids
 *   OLLAMA_API_KEY    — optional API key (usually not needed for local Ollama)
 */
import path from 'path';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  commandExists,
  extractLikelyModelIds,
  ModelAdapter,
  spawnLocal,
} from './ModelAdapter';

const DEFAULT_OLLAMA_BASE = 'http://localhost:11434';

function getBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE).replace(/\/+$/, '');
}

function getOpenAIBaseUrl(): string {
  return `${getBaseUrl()}/v1`;
}

function splitModelEnv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse the `ollama list` tabular output and return model names.
 * The first line is the header; subsequent lines are:
 *   NAME                    ID            SIZE    MODIFIED
 *   llama3.2:latest         ...
 */
function parseOllamaListOutput(output: string): string[] {
  const lines = output.trim().split('\n');
  const models: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const name = lines[i].trim().split(/\s+/)[0];
    if (name && !name.startsWith('#')) models.push(name);
  }
  return models;
}

/**
 * Parse the Ollama /api/tags JSON response.
 * Shape: { models: [{ name: "llama3.2:latest", ... }, ...] }
 */
function parseApiTagsJson(output: string): string[] {
  try {
    const data = JSON.parse(output) as { models?: Array<{ name?: string }> };
    if (Array.isArray(data.models)) {
      return data.models
        .map((m) => m.name ?? '')
        .filter(Boolean);
    }
  } catch {
    // fall through
  }
  return [];
}

export default class OllamaAdapter implements ModelAdapter {
  readonly id = 'ollama';
  readonly label = 'Ollama (local LLM)';

  /** Available if the `ollama` binary is on PATH OR the env base URL is set. */
  isAvailable(): boolean {
    return commandExists('ollama') || Boolean(process.env.OLLAMA_BASE_URL);
  }

  supportsExecution(): boolean {
    return true;
  }

  /**
   * Execution delegates to the http-runner-shim.mjs, setting the Ollama
   * OpenAI-compatible endpoint as OPENAI_BASE_URL.
   */
  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = path.join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
    const baseUrl = getOpenAIBaseUrl();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      OLLAMA_BASE_URL: getBaseUrl(),
      OPENAI_BASE_URL: baseUrl,
      // Ollama typically doesn't need an API key; provide empty string if unset
      OPENAI_API_KEY: process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || 'ollama',
    };

    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
      args: opts.args,
    });
  }

  async discoverModels(): Promise<string[]> {
    const found = new Set<string>();

    // 1. Try `ollama list` CLI
    if (commandExists('ollama')) {
      try {
        const out = await captureCommandOutput('ollama', ['list'], { timeoutMs: 4000 });
        if (out) {
          for (const name of parseOllamaListOutput(out)) found.add(name);
        }
      } catch {
        // binary exists but Ollama not running; fall through
      }
    }

    // 2. Try HTTP /api/tags (native Ollama endpoint)
    const base = getBaseUrl();
    try {
      const tagsOut = await captureCommandOutput('curl', [
        '-sS',
        '--connect-timeout',
        '2',
        `${base}/api/tags`,
      ], { timeoutMs: 3000 });
      if (tagsOut) {
        for (const name of parseApiTagsJson(tagsOut)) found.add(name);
        // Also mine with generic extractor as fallback
        for (const tok of extractLikelyModelIds(tagsOut)) found.add(tok);
      }
    } catch {
      // Ollama not running
    }

    // 3. Try OpenAI-compatible /v1/models
    if (found.size === 0) {
      try {
        const v1Out = await captureCommandOutput('curl', [
          '-sS',
          '--connect-timeout',
          '2',
          '-H', 'Content-Type: application/json',
          `${base}/v1/models`,
        ], { timeoutMs: 3000 });
        if (v1Out) {
          for (const tok of extractLikelyModelIds(v1Out)) found.add(tok);
        }
      } catch {
        // ignore
      }
    }

    // 4. Env-var configured models
    for (const m of splitModelEnv(process.env.OLLAMA_MODEL)) found.add(m);

    return Array.from(found).sort();
  }
}
