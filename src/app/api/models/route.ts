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

    const adapter = getModelAdapter(provider);
    let models: string[] = [];
    let usedDiscovery = false;
    let fallbackUsed = false;

    if (adapter && typeof (adapter as any).discoverModels === 'function') {
      try {
        usedDiscovery = true;
        const discovered = await (adapter as any).discoverModels();
        if (Array.isArray(discovered)) models = discovered.filter(Boolean);
      } catch {
        // discovery failed — fall through to fallback
      }
    }
    // If discovery ran and returned an empty list, prefer returning the
    // empty result so the UI can show an explicit 'no models' state. Only
    // fall back to environment/defaults when discovery did not run or
    // failed to produce results.
    if (usedDiscovery && (!models || models.length === 0)) {
      return NextResponse.json({ provider, models: [], modelCount: 0, usedDiscovery, fallbackUsed: false });
    }

    if ((!models || models.length === 0)) {
      // Discovery was not available or not used — try env-driven defaults
      // and then the built-in DEFAULT_MODELS fallback.
      const envModel = process.env.OPENAI_MODEL;
      if (provider === 'openclaude' || provider === 'openai-http') {
        if (envModel) models = [envModel];
      }
      if (!models || models.length === 0) {
        const fallback = DEFAULT_MODELS[provider] || DEFAULT_MODELS['claude-cli'] || [];
        models = fallback.slice();
        fallbackUsed = models.length > 0;
      }
    }

    return NextResponse.json({ provider, models, modelCount: models.length, usedDiscovery, fallbackUsed });
  } catch (err) {
    return NextResponse.json({ provider: 'unknown', models: [], modelCount: 0, error: String(err) }, { status: 500 });
  }
}
