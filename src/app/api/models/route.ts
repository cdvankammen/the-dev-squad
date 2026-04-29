import { NextRequest, NextResponse } from 'next/server';
import { getProviderDefinition, listModels } from '@/lib/provider-catalog';

export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get('provider') || 'claude';
  const provider = getProviderDefinition(providerId);

  try {
    const models = listModels(provider.id).map((model) => ({
      ...model,
      providerLabel: provider.label,
    }));
    const defaultModel = provider.defaultModel || models[0]?.id || '';

    return NextResponse.json({
      provider: {
        id: provider.id,
        label: provider.label,
        defaultModel,
        mode: provider.mode,
      },
      models,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        provider: {
          id: provider.id,
          label: provider.label,
          defaultModel: provider.defaultModel,
          mode: provider.mode,
        },
        models: [],
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}