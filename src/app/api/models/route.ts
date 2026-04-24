import { NextResponse } from 'next/server';
import getModelAdapter from '@/lib/modelAdapters';

const DEFAULT_MODELS: Record<string, string[]> = {
  'claude-cli': ['claude-opus-4-6', 'claude-sonnet-4-6'],
  'occ': ['claude-opus-4-6', 'claude-sonnet-4-6'],
  'openclaude': [process.env.OPENAI_MODEL || 'gpt-4o', 'gpt-4o-mini-1'],
  'openai-http': [process.env.OPENAI_MODEL || 'gpt-4o'],
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get('provider') || 'claude-cli').toLowerCase();

    // Ask adapter if it supports discovery (best-effort). Fall back to defaults.
    const adapter = getModelAdapter(provider);
    if (adapter && typeof (adapter as any).discoverModels === 'function') {
      try {
        const models = await (adapter as any).discoverModels();
        if (Array.isArray(models) && models.length > 0) return NextResponse.json({ provider, models });
      } catch {
        // ignore discovery failures
      }
    }

    return NextResponse.json({ provider, models: DEFAULT_MODELS[provider] || DEFAULT_MODELS['claude-cli'] });
  } catch (err) {
    return NextResponse.json({ provider: 'unknown', models: [], error: String(err) }, { status: 500 });
  }
}
