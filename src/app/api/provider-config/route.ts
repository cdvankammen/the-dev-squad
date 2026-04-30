/**
 * Provider Configuration API
 *
 * GET  /api/provider-config            — return all saved provider configs
 * GET  /api/provider-config?id=ollama  — return config for one provider
 * POST /api/provider-config            — save/update provider config
 *
 * Stored in: <cwd>/provider-config.json  (gitignored, server-side only)
 *
 * The actual config read/write logic lives in src/lib/providerConfig.ts so
 * adapters can import it without Next.js route handler circular-dep issues.
 */
import { NextResponse } from 'next/server';
import { writeFileSync } from 'node:fs';
import {
  type ProviderConfig,
  readProviderConfigs,
  getProviderConfig,
  getProviderConfigFilePath,
} from '@/lib/providerConfig';

export type { ProviderConfig };

// Defaults for each provider (for the API response / UI defaults)
const PROVIDER_DEFAULTS: Record<string, Omit<ProviderConfig, 'id'>> = {
  ollama: { host: 'localhost', port: 11434 },
  'lm-studio': { host: 'localhost', port: 1234 },
  'openai-http': { host: 'api.openai.com', port: 443, apiKey: '' },
  openwebui: { host: 'localhost', port: 8080, apiKey: '' },
  'openai-compat': { host: 'localhost', port: 8080, apiKey: '' },
  'claude-code-router': { host: 'localhost', port: 8080, apiKey: '' },
  'openclaude-code': { host: 'localhost', port: 8080, apiKey: '' },
};

function normalizeBaseUrl(host?: string, port?: number, baseUrl?: string): string | undefined {
  const trimmedBaseUrl = String(baseUrl || '').trim();
  if (trimmedBaseUrl) {
    try {
      const url = new URL(trimmedBaseUrl);
      return `${url.protocol}//${url.host}`.replace(/\/$/, '');
    } catch {
      // fall through to host/port derived URL
    }
  }

  const trimmedHost = String(host || '').trim();
  if (!trimmedHost || !Number.isFinite(port)) return undefined;
  const scheme = port === 443 ? 'https' : 'http';
  return `${scheme}://${trimmedHost}:${port}`;
}

function normalizeConnection(host?: string, port?: number, baseUrl?: string) {
  const normalizedBaseUrl = normalizeBaseUrl(host, port, baseUrl);
  if (!normalizedBaseUrl) {
    return {
      host: String(host || '').trim(),
      port: typeof port === 'number' ? port : undefined,
      baseUrl: undefined,
    };
  }

  try {
    const url = new URL(normalizedBaseUrl);
    return {
      host: url.hostname,
      port: url.port ? Number.parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80),
      baseUrl: normalizedBaseUrl,
    };
  } catch {
    return {
      host: String(host || '').trim(),
      port: typeof port === 'number' ? port : undefined,
      baseUrl: normalizedBaseUrl,
    };
  }
}

function writeConfig(data: Record<string, ProviderConfig>): void {
  try {
    writeFileSync(getProviderConfigFilePath(), JSON.stringify(data, null, 2));
  } catch {
    // read-only fs (some deploy environments) — silently ignore
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (id) {
    return NextResponse.json({ config: getProviderConfig(id) });
  }

  const all: Record<string, ProviderConfig> = {};
  for (const pid of Object.keys(PROVIDER_DEFAULTS)) {
    all[pid] = getProviderConfig(pid);
  }

  return NextResponse.json({ configs: all });
}

export async function POST(req: Request) {
  let body: Partial<ProviderConfig>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const saved = readProviderConfigs();
  const defaults = PROVIDER_DEFAULTS[id] ?? { host: 'localhost', port: 8080 };
  const normalizedConnection = normalizeConnection(
    typeof body.host === 'string' ? body.host : defaults.host,
    typeof body.port === 'number' ? body.port : defaults.port,
    typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
  );

  saved[id] = {
    id,
    host: normalizedConnection.host || defaults.host || 'localhost',
    port: normalizedConnection.port ?? defaults.port ?? 8080,
    ...(body.apiKey !== undefined ? { apiKey: body.apiKey } : {}),
    ...(normalizedConnection.baseUrl ? { baseUrl: normalizedConnection.baseUrl } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
  };

  writeConfig(saved);
  return NextResponse.json({ ok: true, config: saved[id] });
}

