/**
 * Shared provider configuration utility — usable from adapters (server-side only).
 *
 * Reads from <cwd>/provider-config.json (the same file written by /api/provider-config).
 * This avoids importing from Next.js API route handlers into adapter code.
 *
 * Also provides CCR-config integration: if the user has Claude Code Router installed,
 * and it points LM Studio at a remote host, we auto-bootstrap LM Studio's base URL
 * from CCR's config.json so the adapter works out-of-the-box.
 */
import { existsSync, readFileSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Read ALL LM Studio base URLs from the CCR config file.
 * CCR stores: Providers[*].{ name: "lmstudio*", api_base_url: "http://host:port/v1/..." }
 * Returns an array of unique base URLs in config order, e.g.
 *   ["http://192.168.1.90:1234", "http://10.2.0.90:1234"]
 */
export function getLmStudioUrlsFromCcrConfig(): string[] {
  const ccrConfig = join(homedir(), '.claude-code-router', 'config.json');
  if (!existsSync(ccrConfig)) return [];
  try {
    const raw = readFileSync(ccrConfig, 'utf8');
    const config = JSON.parse(raw) as {
      Providers?: Array<{ name?: string; api_base_url?: string }>;
    };
    if (!Array.isArray(config.Providers)) return [];
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const p of config.Providers) {
      const name = (p.name ?? '').toLowerCase();
      if (name.includes('lmstudio') || name.includes('lm-studio') || name.includes('lm_studio')) {
        const url = p.api_base_url;
        if (!url) continue;
        let baseUrl: string;
        try {
          const u = new URL(url);
          baseUrl = `${u.protocol}//${u.host}`;
        } catch {
          baseUrl = url.replace(/\/(v\d+|api)(\/.*)?$/, '').replace(/\/$/, '');
        }
        if (baseUrl && !seen.has(baseUrl)) {
          seen.add(baseUrl);
          urls.push(baseUrl);
        }
      }
    }
    return urls;
  } catch {
    // ignore parse errors
  }
  return [];
}

/**
 * Read the primary LM Studio base URL from the CCR config file (first match).
 * Returns the base URL (e.g. "http://192.168.1.90:1234") or null.
 */
export function getLmStudioUrlFromCcrConfig(): string | null {
  const urls = getLmStudioUrlsFromCcrConfig();
  return urls[0] ?? null;
}

export interface ProviderConfig {
  id: string;
  host: string;
  port: number;
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

const DEFAULTS: Record<string, Omit<ProviderConfig, 'id'>> = {
  ollama: { host: 'localhost', port: 11434 },
  'lm-studio': { host: 'localhost', port: 1234 },
  'openai-http': { host: 'api.openai.com', port: 443 },
  openwebui: { host: 'localhost', port: 8080 },
  'openai-compat': { host: 'localhost', port: 8080 },
  'claude-code-router': { host: 'localhost', port: 8080 },
  'openclaude-code': { host: 'localhost', port: 8080 },
};

let _cached: Record<string, ProviderConfig> | null = null;
let _cachedMtime = 0;

function clearProviderConfigCache() {
  _cached = null;
  _cachedMtime = 0;
}

// Watch the config file and invalidate the cache when it changes.
try {
  const configPath = join(process.cwd(), 'provider-config.json');
  // fs.watch may throw on some platforms; ignore failures.
  watch(configPath, { persistent: false }, () => {
    clearProviderConfigCache();
  });
} catch {
  // ignore
}

export function readProviderConfigs(): Record<string, ProviderConfig> {
  const configFile = join(process.cwd(), 'provider-config.json');
  try {
    if (!existsSync(configFile)) {
      clearProviderConfigCache();
      return {};
    }
    const stat = statSync(configFile);
    const mtime = stat.mtimeMs || 0;
    if (_cached && _cachedMtime === mtime) return _cached;
    const raw = readFileSync(configFile, 'utf8');
    const saved = JSON.parse(raw) as Record<string, ProviderConfig>;
    _cached = saved;
    _cachedMtime = mtime;
    return saved;
  } catch {
    clearProviderConfigCache();
    return {};
  }
}

export function getProviderConfig(id: string): ProviderConfig {
  const saved = readProviderConfigs();
  const defaults = DEFAULTS[id] ?? { host: 'localhost', port: 8080 };
  const base: ProviderConfig = { id, ...defaults };
  const override = saved[id] ?? {};
  return { ...base, ...override, id };
}

export function getBaseUrlForProvider(id: string): string {
  // Env-var overrides take the highest priority
  if (id === 'ollama' && process.env.OLLAMA_BASE_URL) {
    return process.env.OLLAMA_BASE_URL.replace(/\/$/, '');
  }
  if (id === 'lm-studio' && process.env.LM_STUDIO_BASE_URL) {
    return process.env.LM_STUDIO_BASE_URL.replace(/\/$/, '');
  }
  if (id === 'openai-http' && process.env.OPENAI_BASE_URL) {
    return process.env.OPENAI_BASE_URL.replace(/\/$/, '');
  }
  if (id === 'openwebui' && process.env.OPENWEBUI_BASE_URL) {
    return process.env.OPENWEBUI_BASE_URL.replace(/\/$/, '');
  }
  if (id === 'openai-compat' && process.env.OPENAI_COMPAT_BASE_URL) {
    return process.env.OPENAI_COMPAT_BASE_URL.replace(/\/$/, '');
  }
  if (id === 'claude-code-router' && (process.env.CLAUDE_CODE_ROUTER_BASE_URL || process.env.CCR_BASE_URL)) {
    return (process.env.CLAUDE_CODE_ROUTER_BASE_URL || process.env.CCR_BASE_URL || '').replace(/\/$/, '');
  }
  if (id === 'openclaude-code' && (process.env.OPENCLAUDE_CODE_BASE_URL || process.env.OPENCLAUDE_BASE_URL)) {
    return (process.env.OPENCLAUDE_CODE_BASE_URL || process.env.OPENCLAUDE_BASE_URL || '').replace(/\/$/, '');
  }

  const cfg = getProviderConfig(id);

  // If a baseUrl or non-localhost host is explicitly saved, use it
  if (cfg.baseUrl) return cfg.baseUrl.replace(/\/$/, '');
  if (cfg.host && cfg.host !== 'localhost' && cfg.host !== '127.0.0.1') {
    const scheme = cfg.port === 443 ? 'https' : 'http';
    return `${scheme}://${cfg.host}:${cfg.port}`;
  }

  // For lm-studio: auto-detect from CCR config if no explicit config saved
  if (id === 'lm-studio') {
    const ccrUrl = getLmStudioUrlFromCcrConfig();
    if (ccrUrl) return ccrUrl;
  }

  const scheme = cfg.port === 443 ? 'https' : 'http';
  return `${scheme}://${cfg.host}:${cfg.port}`;
}
