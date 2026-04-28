import path from 'path';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  extractLikelyModelIds,
  ModelAdapter,
  resolveWorkspacePath,
  spawnLocal,
} from './ModelAdapter';
import { getBaseUrlForProvider, getProviderConfig } from '../providerConfig';

function normalizeBaseUrl(base?: string): string {
  const normalized = (base || 'https://api.openai.com/v1').trim();
  return normalized.endsWith('/v1') ? normalized : `${normalized.replace(/\/$/, '')}/v1`;
}

function getConfiguredBaseUrl(): string {
  return normalizeBaseUrl(process.env.OPENAI_BASE_URL || getBaseUrlForProvider('openai-http'));
}

function splitModelEnv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default class OpenAIHttpAdapter implements ModelAdapter {
  readonly id = 'openai-http';
  readonly label = 'OpenAI-Compatible HTTP';

  isAvailable(): boolean {
    const cfg = getProviderConfig('openai-http');
    return Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_BASE_URL ||
      cfg.apiKey ||
      cfg.baseUrl ||
      (cfg.host && cfg.host !== 'api.openai.com')
    );
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = resolveWorkspacePath('scripts', 'http-runner-shim.mjs');
    const cfg = getProviderConfig('openai-http');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      OPENAI_BASE_URL: getConfiguredBaseUrl(),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || cfg.apiKey || 'openai-http',
    };
    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
      args: opts.args,
    });
  }

  async discoverModels(): Promise<string[]> {
    const cfg = getProviderConfig('openai-http');
    const baseUrl = getConfiguredBaseUrl();
    const apiKey = process.env.OPENAI_API_KEY || cfg.apiKey || '';
    const args = [
      '-sS',
      '-H',
      'Content-Type: application/json',
      ...(apiKey
        ? ['-H', `Authorization: Bearer ${apiKey}`]
        : []),
      `${baseUrl}/models`,
    ];

    const output = await captureCommandOutput('curl', args);
    const discovered = output ? extractLikelyModelIds(output) : [];
    const configured = new Set<string>(splitModelEnv(process.env.OPENAI_MODEL || process.env.OPENAI_COMPAT_MODEL));

    return Array.from(new Set([...discovered, ...configured])).sort();
  }
}
