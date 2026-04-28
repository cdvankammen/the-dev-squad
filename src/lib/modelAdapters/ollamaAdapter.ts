/**
 * OllamaAdapter — Model adapter for Ollama local/remote LLM runtime.
 *
 * Host/port is configurable via /api/provider-config (UI text boxes) or
 * the OLLAMA_BASE_URL environment variable.
 * Default: http://localhost:11434
 *
 * Supports both local and remote Ollama instances on any host/port.
 */
import path from 'path';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  commandExists,
  extractLikelyModelIds,
  ModelAdapter,
  resolveWorkspacePath,
  spawnLocal,
} from './ModelAdapter';
import { getBaseUrlForProvider, getProviderConfig } from '../providerConfig';

function getOllamaBase(): string {
  // getBaseUrlForProvider handles env-var overrides + saved config
  return getBaseUrlForProvider('ollama');
}

function getOpenAIBaseUrl(): string {
  return `${getOllamaBase()}/v1`;
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

  /** Available if the `ollama` CLI is on PATH, OLLAMA_BASE_URL is set, OR a non-default host is configured. */
  isAvailable(): boolean {
    if (commandExists('ollama')) return true;
    if (process.env.OLLAMA_BASE_URL) return true;
    const cfg = getProviderConfig('ollama');
    // If a non-localhost host has been saved, consider it available (remote Ollama)
    if (cfg.host && cfg.host !== 'localhost' && cfg.host !== '127.0.0.1') return true;
    if (cfg.baseUrl) return true;
    // Like LM Studio, Ollama is commonly used as a localhost HTTP runtime even
    // when the CLI is not on PATH for the Next.js process. Treat it as
    // available-by-attempt so the UI does not force a fallback to claude-cli.
    return true;
  }

  supportsExecution(): boolean {
    return true;
  }

  /**
   * Execution delegates to the http-runner-shim.mjs, setting the Ollama
   * OpenAI-compatible endpoint as OPENAI_BASE_URL.
   */
  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = resolveWorkspacePath('scripts', 'http-runner-shim.mjs');
    const baseUrl = getOpenAIBaseUrl();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      OLLAMA_BASE_URL: getOllamaBase(),
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
    const base = getOllamaBase();
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
