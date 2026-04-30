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
import { NextRequest, NextResponse } from 'next/server';
import { chmodSync, writeFileSync } from 'node:fs';
import {
  type ProviderConfig,
  readProviderConfigs,
  getProviderConfig,
  getProviderConfigFilePath,
} from '@/lib/providerConfig';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

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

function isSupportedProviderId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PROVIDER_DEFAULTS, id);
}

function redactProviderConfig(config: ProviderConfig) {
  return {
    ...config,
    apiKey: '',
    apiKeyConfigured: Boolean(config.apiKey),
  };
}

function normalizeBaseUrl(host?: string, port?: number, baseUrl?: string): string | undefined {
  const trimmedBaseUrl = String(baseUrl || '').trim();
  if (trimmedBaseUrl) {
    try {
      const url = new URL(trimmedBaseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
      if (!url.hostname) return undefined;
      return `${url.protocol}//${url.host}`.replace(/\/$/, '');
    } catch {
      // fall through to host/port derived URL
    }
  }

  const trimmedHost = String(host || '').trim();
  const normalizedPort = typeof port === 'number' ? port : Number.NaN;
  if (!trimmedHost || /[\s/\\]/.test(trimmedHost) || !Number.isFinite(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) return undefined;
  const scheme = normalizedPort === 443 ? 'https' : 'http';
  return `${scheme}://${trimmedHost}:${normalizedPort}`;
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
    const filePath = getProviderConfigFilePath();
    writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
    try { chmodSync(filePath, 0o600); } catch {}
  } catch {
    // read-only fs (some deploy environments) — silently ignore
  }
}

export async function GET(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'provider config endpoint');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (id) {
    if (!isSupportedProviderId(id)) {
      return NextResponse.json({ error: 'Unsupported provider id' }, { status: 400 });
    }
    return NextResponse.json({ config: redactProviderConfig(getProviderConfig(id)) });
  }

  const all: Record<string, ProviderConfig> = {};
  for (const pid of Object.keys(PROVIDER_DEFAULTS)) {
    all[pid] = redactProviderConfig(getProviderConfig(pid)) as ProviderConfig;
  }

  return NextResponse.json({ configs: all });
}

export async function POST(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'provider config endpoint');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message || 'Unauthorized' }, { status: 401 });
  }

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
  if (!isSupportedProviderId(id)) {
    return NextResponse.json({ error: 'Unsupported provider id' }, { status: 400 });
  }

  const saved = readProviderConfigs();
  const existing = saved[id] ?? {};
  const defaults = PROVIDER_DEFAULTS[id];
  const rawPort = typeof body.port === 'number' ? body.port : defaults.port;
  const normalizedConnection = normalizeConnection(
    typeof body.host === 'string' ? body.host : defaults.host,
    rawPort,
    typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
  );

  if (!normalizedConnection.host || !normalizedConnection.port || normalizedConnection.port < 1 || normalizedConnection.port > 65535) {
    return NextResponse.json({ error: 'Invalid provider host or port' }, { status: 400 });
  }

  const normalizedApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : undefined;

  saved[id] = {
    ...existing,
    id,
    host: normalizedConnection.host || defaults.host || 'localhost',
    port: normalizedConnection.port ?? defaults.port ?? 8080,
    ...(normalizedApiKey !== undefined ? { apiKey: normalizedApiKey } : {}),
    ...(normalizedConnection.baseUrl ? { baseUrl: normalizedConnection.baseUrl } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
  };

  writeConfig(saved);
  return NextResponse.json({ ok: true, config: redactProviderConfig(saved[id]) });
}

