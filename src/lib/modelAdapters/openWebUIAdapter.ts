/**
 * OpenWebUIAdapter — Adapter for Open WebUI (https://github.com/open-webui/open-webui)
 *
 * Open WebUI exposes an OpenAI-compatible API at <host>:<port>/api
 * Models endpoint: GET <base>/api/models
 * Chat endpoint:   POST <base>/api/chat/completions  (OpenAI-compatible)
 *
 * Host/port configured via /api/provider-config or OPENWEBUI_BASE_URL env var.
 * Default: http://localhost:3000
 *
 * An API key is required (user's Open WebUI session token or API key).
 * Set via OPENWEBUI_API_KEY env or provider-config apiKey field.
 */
import path from 'path';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  extractLikelyModelIds,
  ModelAdapter,
  spawnLocal,
} from './ModelAdapter';
import { getBaseUrlForProvider, getProviderConfig } from '../providerConfig';

function getOpenWebUIBase(): string {
  if (process.env.OPENWEBUI_BASE_URL) return process.env.OPENWEBUI_BASE_URL.replace(/\/$/, '');
  return getBaseUrlForProvider('openwebui');
}

export default class OpenWebUIAdapter implements ModelAdapter {
  readonly id = 'openwebui';
  readonly label = 'Open WebUI (OpenAI-Compatible)';

  isAvailable(): boolean {
    if (process.env.OPENWEBUI_BASE_URL || process.env.OPENWEBUI_API_KEY) return true;
    const cfg = getProviderConfig('openwebui');
    if (cfg.apiKey) return true;
    if (cfg.baseUrl) return true;
    if (cfg.host && cfg.host !== 'localhost' && cfg.host !== '127.0.0.1') return true;
    return false;
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = path.join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
    const base = getOpenWebUIBase();
    // Open WebUI uses /api as the OpenAI-compat prefix
    const apiBase = base.endsWith('/api') ? base : `${base}/api`;
    const cfg = getProviderConfig('openwebui');
    const apiKey = process.env.OPENWEBUI_API_KEY || cfg.apiKey || '';
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      OPENWEBUI_BASE_URL: base,
      OPENAI_BASE_URL: apiBase,
      OPENAI_API_KEY: apiKey,
    };

    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
      args: opts.args,
    });
  }

  async discoverModels(): Promise<string[]> {
    const base = getOpenWebUIBase();
    const cfg = getProviderConfig('openwebui');
    const apiKey = process.env.OPENWEBUI_API_KEY || cfg.apiKey || '';
    const authHeader = apiKey ? ['-H', `Authorization: Bearer ${apiKey}`] : [];
    const found = new Set<string>();

    // Try Open WebUI's native models endpoint
    const modelUrls = [
      `${base}/api/models`,
      `${base}/api/v1/models`,
      `${base}/ollama/api/tags`,          // Open WebUI proxies Ollama
      `${base}/openai/v1/models`,         // Open WebUI proxies OpenAI
    ];

    for (const url of modelUrls) {
      try {
        const out = await captureCommandOutput('curl', [
          '-sS', '--connect-timeout', '3',
          '-H', 'Content-Type: application/json',
          ...authHeader,
          url,
        ], { timeoutMs: 4000 });
        if (out) {
          for (const m of extractLikelyModelIds(out)) found.add(m);
          if (found.size > 0) break; // got results from this endpoint
        }
      } catch { /* ignore */ }
    }

    return Array.from(found).sort();
  }
}
