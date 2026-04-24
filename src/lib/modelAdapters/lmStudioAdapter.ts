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
  const normalized = (base || 'http://127.0.0.1:1234/v1').trim();
  return normalized.endsWith('/v1') ? normalized : `${normalized.replace(/\/$/, '')}/v1`;
}

export default class LMStudioAdapter implements ModelAdapter {
  readonly id = 'lm-studio';
  readonly displayName = 'LM Studio (OpenAI-Compatible)';
  readonly supportsExecution = true;

  isAvailable(): boolean {
    return Boolean(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL);
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = path.join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
    const baseUrl = normalizeBaseUrl(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL);
    const env = {
      ...opts.env,
      MODEL_PROVIDER: this.id,
      LM_STUDIO_BASE_URL: baseUrl,
      OPENAI_BASE_URL: baseUrl,
    };
    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
    });
  }

  async discoverModels(): Promise<string[] | null> {
    const baseUrl = normalizeBaseUrl(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL);
    const args = ['-sS', '-H', 'Content-Type: application/json', `${baseUrl}/models`];
    const output = await captureCommandOutput('curl', args);
    const configured = collectConfiguredModelIds(
      process.env.LM_STUDIO_MODEL,
      process.env.OPENAI_MODEL,
    );

    if (!output.ok || !output.stdout.trim()) {
      return configured;
    }

    const parsed = parseLikelyModelIds(output.stdout);
    return Array.from(new Set([...parsed, ...configured]));
  }
}
