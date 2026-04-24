import path from 'path';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  AdapterSpawnOptions,
  captureCommandOutput,
  collectConfiguredModelIds,
  ModelAdapter,
  parseLikelyModelIds,
  spawnLocal,
} from './ModelAdapter';

function normalizeBaseUrl(base?: string): string {
  const normalized = (base || 'https://api.openai.com/v1').trim();
  return normalized.endsWith('/v1') ? normalized : `${normalized.replace(/\/$/, '')}/v1`;
}

export default class OpenAIHttpAdapter implements ModelAdapter {
  readonly id = 'openai-http';
  readonly displayName = 'OpenAI-Compatible HTTP';
  readonly supportsExecution = true;

  isAvailable(): boolean {
    return Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL);
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = path.join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
    const env = {
      ...opts.env,
      MODEL_PROVIDER: this.id,
      OPENAI_BASE_URL: normalizeBaseUrl(process.env.OPENAI_BASE_URL),
    };
    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
    });
  }

  async discoverModels(): Promise<string[] | null> {
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
    const configured = collectConfiguredModelIds(process.env.OPENAI_MODEL);

    if (!output.ok || !output.stdout.trim()) {
      return configured;
    }

    const parsed = parseLikelyModelIds(output.stdout);
    return Array.from(new Set([...parsed, ...configured]));
  }
}
