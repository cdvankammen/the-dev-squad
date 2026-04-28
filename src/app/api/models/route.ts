import { NextResponse } from 'next/server';
import getModelAdapter from '@/lib/modelAdapters';

const DEFAULT_MODELS: Record<string, string[]> = {
  'claude-cli': ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  'ccr': ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  'occ': ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  'openclaude': ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  'openai-http': [process.env.OPENAI_MODEL || 'gpt-4o-mini'],
  'lm-studio': [],
  'ollama': [],
  'openwebui': [],
  'openai-compat': [process.env.OPENAI_COMPAT_MODEL || 'local-model'],
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get('provider') || 'claude-cli').toLowerCase();
    const details = url.searchParams.get('details') === 'true';

    const adapter = getModelAdapter(provider);
    let models: string[] = [];
    let usedDiscovery = false;
    let fallbackUsed = false;
    // Enriched model info with host labels (only for CCR with ?details=true)
    let modelDetails: Array<{ model: string; label: string; provider: string; host: string; port: string }> | null = null;

    if (adapter && typeof (adapter as any).discoverModels === 'function') {
      try {
        usedDiscovery = true;
        const discovered = await (adapter as any).discoverModels();
        if (Array.isArray(discovered)) models = discovered.filter(Boolean);

        // If details requested and adapter supports it, get enriched info
        if (details && typeof (adapter as any).discoverModelsWithHosts === 'function') {
          modelDetails = await (adapter as any).discoverModelsWithHosts();
        }
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
      const lmStudioModel = process.env.LM_STUDIO_MODEL;
      if (provider === 'openai-http' && envModel) {
        models = [envModel];
      } else if (provider === 'lm-studio' && (lmStudioModel || envModel)) {
        models = [lmStudioModel || envModel || 'local-model'];
      }
      if (!models || models.length === 0) {
        const fallback = DEFAULT_MODELS[provider] || DEFAULT_MODELS['claude-cli'] || [];
        models = fallback.slice();
        fallbackUsed = models.length > 0;
      }
    }

    return NextResponse.json({ provider, models, modelCount: models.length, usedDiscovery, fallbackUsed, ...(modelDetails ? { modelDetails } : {}) });
  } catch (err) {
    return NextResponse.json({ provider: 'unknown', models: [], modelCount: 0, error: String(err) }, { status: 500 });
  }
}
