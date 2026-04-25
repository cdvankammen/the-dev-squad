/**
 * OpenAICompatAdapter — Generic OpenAI-compatible HTTP endpoint adapter.
 *
 * Auto-populates models by calling GET /v1/models (standard OpenAI models list endpoint).
 * Works with any OpenAI-compatible server:
 * - vLLM, LocalAI, TGI, Aphrodite, text-generation-webui, etc.
 *
 * Model discovery:
 *   1. GET <base>/v1/models   → { data: [{ id: "..." }] }  (OpenAI standard)
 *   2. GET <base>/models      → same format (some servers drop /v1 prefix)
 *   3. GET <base>/api/models  → try generic extraction as last resort
 *   4. OPENAI_COMPAT_MODEL env var (manual override / fallback)
 *
 * Configuration via /api/provider-config or env vars:
 *   OPENAI_COMPAT_BASE_URL  — base URL (e.g. http://192.168.1.100:8000)
 *   OPENAI_COMPAT_API_KEY   — API key (optional; many local servers don't require one)
 *   OPENAI_COMPAT_MODEL     — comma-separated model ids (fallback if /v1/models fails)
 *
 * Default: http://localhost:8080
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

function getCompatBase(): string {
  if (process.env.OPENAI_COMPAT_BASE_URL) return process.env.OPENAI_COMPAT_BASE_URL.replace(/\/$/, '');
  return getBaseUrlForProvider('openai-compat');
}

/** Parse OpenAI-standard models list: { data: [{ id: "..." }] } */
function parseOpenAIModels(json: string): string[] {
  try {
    const data = JSON.parse(json) as { data?: Array<{ id?: string }> };
    if (Array.isArray(data.data)) {
      return data.data.map((m) => m.id ?? '').filter(Boolean);
    }
  } catch { /* fall through */ }
  return [];
}

function splitModelEnv(value?: string): string[] {
  if (!value) return [];
  return value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

export default class OpenAICompatAdapter implements ModelAdapter {
  readonly id = 'openai-compat';
  readonly label = 'OpenAI-Compatible Endpoint';

  isAvailable(): boolean {
    if (process.env.OPENAI_COMPAT_BASE_URL || process.env.OPENAI_COMPAT_API_KEY) return true;
    const cfg = getProviderConfig('openai-compat');
    if (cfg.baseUrl) return true;
    if (cfg.apiKey) return true;
    // Available if user configured a non-default host
    if (cfg.host && cfg.host !== 'localhost' && cfg.host !== '127.0.0.1') return true;
    return false;
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = path.join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
    const base = getCompatBase();
    const openAIBase = base.endsWith('/v1') ? base : `${base}/v1`;
    const cfg = getProviderConfig('openai-compat');
    const apiKey = process.env.OPENAI_COMPAT_API_KEY || cfg.apiKey || 'none';
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      OPENAI_COMPAT_BASE_URL: base,
      OPENAI_BASE_URL: openAIBase,
      OPENAI_API_KEY: apiKey,
    };

    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
      args: opts.args,
    });
  }

  async discoverModels(): Promise<string[]> {
    const base = getCompatBase();
    const cfg = getProviderConfig('openai-compat');
    const apiKey = process.env.OPENAI_COMPAT_API_KEY || cfg.apiKey || '';
    const authHeaders = apiKey ? ['-H', `Authorization: Bearer ${apiKey}`] : [];
    const found = new Set<string>();

    // Try multiple URL patterns — different servers use different prefixes
    const candidateUrls = [
      `${base}/v1/models`,
      `${base}/models`,
      `${base}/api/v1/models`,
      `${base}/api/models`,
    ];

    for (const url of candidateUrls) {
      try {
        const out = await captureCommandOutput('curl', [
          '-sS', '--connect-timeout', '4',
          '-H', 'Content-Type: application/json',
          '-H', 'Accept: application/json',
          ...authHeaders,
          url,
        ], { timeoutMs: 6000 });
        if (!out) continue;

        // Try OpenAI-standard format first
        const openAIModels = parseOpenAIModels(out);
        if (openAIModels.length > 0) {
          for (const m of openAIModels) found.add(m);
          break; // got a good response, stop trying
        }

        // Try generic extraction as fallback
        const generic = extractLikelyModelIds(out);
        if (generic.length > 0) {
          for (const m of generic) found.add(m);
          break;
        }
      } catch { /* keep trying next URL */ }
    }

    // Env-configured models as fallback
    for (const m of splitModelEnv(process.env.OPENAI_COMPAT_MODEL)) found.add(m);

    return Array.from(found).sort();
  }
}

