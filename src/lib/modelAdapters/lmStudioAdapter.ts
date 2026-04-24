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
  const normalized = (base || 'http://127.0.0.1:1234/v1').trim();
  return normalized.endsWith('/v1') ? normalized : `${normalized.replace(/\/$/, '')}/v1`;
}

function splitModelEnv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default class LMStudioAdapter implements ModelAdapter {
  readonly id = 'lm-studio';
  readonly label = 'LM Studio (OpenAI-Compatible)';

  isAvailable(): boolean {
    return Boolean(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL);
  }

  supportsExecution(): boolean {
    return true;
  }

  spawn(opts: AdapterSpawnOptions): ChildProcessWithoutNullStreams {
    const shimPath = path.join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
    const baseUrl = normalizeBaseUrl(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...opts.env,
      MODEL_PROVIDER: this.id,
      LM_STUDIO_BASE_URL: baseUrl,
      OPENAI_BASE_URL: baseUrl,
    };

    return spawnLocal(process.execPath, [shimPath, '--provider', this.id, ...opts.args], {
      cwd: opts.cwd,
      env,
      args: opts.args,
    });
  }

  async discoverModels(): Promise<string[]> {
    const baseUrl = normalizeBaseUrl(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL);
    const output = await captureCommandOutput('curl', [
      '-sS',
      '-H',
      'Content-Type: application/json',
      `${baseUrl}/models`,
    ]);

    const discovered = output ? extractLikelyModelIds(output) : [];
    const configured = new Set<string>([
      ...splitModelEnv(process.env.LM_STUDIO_MODEL),
      ...splitModelEnv(process.env.OPENAI_MODEL),
    ]);

    return Array.from(new Set([...discovered, ...configured])).sort();
  }
}
