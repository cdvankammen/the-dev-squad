import { ModelAdapter } from './ModelAdapter';

/**
 * LM Studio / OpenAI-compatible adapter
 *
 * Best-effort discovery of models from an OpenAI-compatible server (LM Studio).
 * Uses LM_STUDIO_BASE_URL if present, otherwise falls back to OPENAI_BASE_URL.
 */
export class LMStudioAdapter implements ModelAdapter {
  isAvailable(): boolean {
    return Boolean(process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY);
  }

  spawn(): never {
    // Network-backed adapters do not provide a local child-process spawn by
    // default. Integrate a local shim or adapter that provides streaming if
    // you need pipeline runner support for LM Studio.
    throw new Error('LMStudioAdapter.spawn is not implemented (HTTP-backed adapter).');
  }

  async discoverModels(): Promise<string[]> {
    const base = process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL;
    if (!base) {
      // If no base URL is present, fall back to OPENAI_MODEL env when set.
      const envModel = process.env.OPENAI_MODEL;
      return envModel ? [envModel] : [];
    }

    try {
      const url = new URL('/v1/models', base).toString();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (process.env.OPENAI_API_KEY) headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;

      const res = await fetch(url, { headers, method: 'GET' });
      if (!res.ok) return [];
      const body = await res.json().catch(() => null);
      if (!body) return [];

      // Expect OpenAI-style /v1/models response or a simple array.
      if (Array.isArray(body)) return body.filter((v) => typeof v === 'string');
      if (Array.isArray(body.data)) return body.data.map((d: any) => String(d.id)).filter(Boolean);
      return [];
    } catch {
      return [];
    }
  }
}

export default LMStudioAdapter;
