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
} from '@/lib/providerConfig';

export type { ProviderConfig };
export { getProviderConfig };

export function getBaseUrlForProvider(id: string): string {
  const cfg = getProviderConfig(id);
  if (cfg.baseUrl) return cfg.baseUrl.replace(/\/$/, '');
  const scheme = cfg.port === 443 ? 'https' : 'http';
  return `${scheme}://${cfg.host}:${cfg.port}`;
}

// Defaults for each provider (for the API response / UI defaults)
const PROVIDER_DEFAULTS: Record<string, Omit<ProviderConfig, 'id'>> = {
  ollama: { host: 'localhost', port: 11434 },
  'lm-studio': { host: 'localhost', port: 1234 },
  'openai-http': { host: 'api.openai.com', port: 443, apiKey: '' },
  openwebui: { host: 'localhost', port: 8080, apiKey: '' },
  'openai-compat': { host: 'localhost', port: 8080, apiKey: '' },
};

function writeConfig(data: Record<string, ProviderConfig>): void {
  try {
    writeFileSync(`${process.cwd()}/provider-config.json`, JSON.stringify(data, null, 2));
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
  saved[id] = {
    id,
    host: body.host ?? defaults.host ?? 'localhost',
    port: typeof body.port === 'number' ? body.port : (defaults.port ?? 8080),
    ...(body.apiKey !== undefined ? { apiKey: body.apiKey } : {}),
    ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
  };

  writeConfig(saved);
  return NextResponse.json({ ok: true, config: saved[id] });
}

