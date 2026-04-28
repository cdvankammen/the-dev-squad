/**
 * LMStudioAdapter — Adapter for LM Studio local/remote LLM server.
 *
 * Uses LM Studio's APIs in priority order:
 *   1. Native v1 API:   GET <base>/api/v1/models  →  { models: [{ key, display_name, ... }] }
 *   2. OpenAI compat:   GET <base>/v1/models       →  { data: [{ id, ... }] }
 *
 * For chat execution, the http-runner-shim uses the OpenAI-compatible endpoint
 * at <base>/v1/chat/completions (which LM Studio fully supports).
 *
 * Host/port resolution order:
 *   1. LM_STUDIO_BASE_URL env var
 *   2. Saved provider-config.json (via UI endpoint config panel)
 *   3. Auto-detected from CCR ~/.claude-code-router/config.json lmstudio provider
 *   4. Default: http://localhost:1234
 *
 * API docs: https://lmstudio.ai/docs/developer/rest
 *           https://lmstudio.ai/docs/developer/openai-compat
 */
import path from 'path';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  ModelAdapter,
  resolveWorkspacePath,
  spawnLocal,
} from './ModelAdapter';
import { getBaseUrlForProvider, getProviderConfig, getLmStudioUrlsFromCcrConfig, readProviderConfigs } from '../providerConfig';

/**
 * Returns the LM Studio base URL(s) that match the execution target.
 *
 * Important: discovery should match the endpoint that execution will use.
 * Showing a union of multiple LM Studio hosts in the dropdown is misleading,
 * because the runner only talks to ONE base URL when it actually sends a chat.
 *
 * Priority:
 *  1. Env var LM_STUDIO_BASE_URL (only this host)
 *  2. Saved provider-config.json (only this host)
 *  3. First CCR-configured LM Studio host
 *  4. Default: http://localhost:1234
 */
function getLmStudioBases(): string[] {
  if (process.env.LM_STUDIO_BASE_URL) {
    return [process.env.LM_STUDIO_BASE_URL.replace(/\/$/, '')];
  }

  const saved = readProviderConfigs()['lm-studio'];
  if (saved) {
    return [getBaseUrlForProvider('lm-studio')];
  }

  const ccrUrls = getLmStudioUrlsFromCcrConfig();
  if (ccrUrls.length > 0) {
    return [ccrUrls[0].replace(/\/$/, '')];
  }

  return ['http://localhost:1234'];
}

function getLmStudioBase(): string {
  return getLmStudioBases()[0];
}

/** LM Studio native v1 API: GET /api/v1/models  →  { models: [{ key: "...", display_name: "..." }] } */
function parseLmStudioNativeModels(json: string): string[] {
  try {
    const data = JSON.parse(json) as { models?: Array<{ key?: string; display_name?: string }> };
    if (Array.isArray(data.models)) {
      return data.models
        .map((m) => m.key ?? m.display_name ?? '')
        .filter(Boolean);
    }
  } catch { /* fall through */ }
  return [];
}

/** OpenAI-compat: GET /v1/models  →  { data: [{ id: "..." }] } */
function parseOpenAIModels(json: string): string[] {
  try {
    const data = JSON.parse(json) as { data?: Array<{ id?: string }> };
    if (Array.isArray(data.data)) {
      return data.data
        .map((m) => m.id ?? '')
        .filter(Boolean);
    }
  } catch { /* fall through */ }
  return [];
}

function splitModelEnv(value?: string): string[] {
  if (!value) return [];
  return value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

export default class LMStudioAdapter implements ModelAdapter {
  readonly id = 'lm-studio';
  readonly label = 'LM Studio';

  isAvailable(): boolean {
    if (process.env.LM_STUDIO_BASE_URL) return true;
    const cfg = getProviderConfig('lm-studio');
    if (cfg.host && cfg.host !== 'localhost' && cfg.host !== '127.0.0.1') return true;
    if (cfg.baseUrl) return true;
    // Auto-detect from CCR config
    if (getLmStudioUrlsFromCcrConfig().length > 0) return true;
    // Also available if localhost — LM Studio is commonly run locally
    return true; // always show; isAvailable reflects "can attempt"
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = resolveWorkspacePath('scripts', 'http-runner-shim.mjs');
    const base = getLmStudioBase();
    // Always use OpenAI-compat endpoint for execution (well-supported by LM Studio)
    const openAIBase = base.endsWith('/v1') ? base : `${base}/v1`;
    const cfg = getProviderConfig('lm-studio');
    const apiKey = process.env.LM_STUDIO_API_KEY || cfg.apiKey || 'lm-studio';
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      LM_STUDIO_BASE_URL: base,
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
    const bases = getLmStudioBases();
    const cfg = getProviderConfig('lm-studio');
    const apiKey = process.env.LM_STUDIO_API_KEY || cfg.apiKey || '';
    const authHeaders = apiKey ? ['-H', `Authorization: Bearer ${apiKey}`] : [];
    const found = new Set<string>();

    for (const base of bases) {
      // 1. LM Studio native v1 API: GET /api/v1/models
      //    Returns: { models: [{ key: "model-id", display_name: "...", ... }] }
      try {
        const out = await captureCommandOutput('curl', [
          '-sS', '--connect-timeout', '3',
          '-H', 'Accept: application/json',
          ...authHeaders,
          `${base}/api/v1/models`,
        ], { timeoutMs: 5000 });
        if (out) {
          const models = parseLmStudioNativeModels(out);
          for (const m of models) found.add(m);
          if (models.length > 0) continue; // success — try next host for more unique models
        }
      } catch { /* host not reachable */ }

      // 2. OpenAI-compatible endpoint: GET /v1/models
      //    Returns: { data: [{ id: "model-id" }] }
      const openAIBase = base.endsWith('/v1') ? base : `${base}/v1`;
      try {
        const out = await captureCommandOutput('curl', [
          '-sS', '--connect-timeout', '3',
          '-H', 'Content-Type: application/json',
          ...authHeaders,
          `${openAIBase}/models`,
        ], { timeoutMs: 5000 });
        if (out) {
          const models = parseOpenAIModels(out);
          for (const m of models) found.add(m);
        }
      } catch { /* ignore */ }
    }

    // 3. Env-configured model names as fallback
    for (const m of splitModelEnv(process.env.LM_STUDIO_MODEL)) found.add(m);
    for (const m of splitModelEnv(process.env.OPENAI_MODEL)) found.add(m);

    return Array.from(found).sort();
  }
}


