import path from 'path';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  extractLikelyModelIds,
  ModelAdapter,
  spawnLocal,
} from './ModelAdapter';

function normalizeBaseUrl(base?: string): string {
  const normalized = (base || 'https://api.openai.com/v1').trim();
  return normalized.endsWith('/v1') ? normalized : `${normalized.replace(/\/$/, '')}/v1`;
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
    return Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL);
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = path.join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      OPENAI_BASE_URL: normalizeBaseUrl(process.env.OPENAI_BASE_URL),
    };
    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
      args: opts.args,
    });
  }

  async discoverModels(): Promise<string[]> {
    const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL);
    const args = [
      '-sS',
      '-H',
      'Content-Type: application/json',
      ...(process.env.OPENAI_API_KEY
        ? ['-H', `Authorization: Bearer ${process.env.OPENAI_API_KEY}`]
        : []),
      `${baseUrl}/models`,
    ];

    const output = await captureCommandOutput('curl', args);
    const discovered = output ? extractLikelyModelIds(output) : [];
    const configured = new Set<string>(splitModelEnv(process.env.OPENAI_MODEL));

    return Array.from(new Set([...discovered, ...configured])).sort();
  }
}
