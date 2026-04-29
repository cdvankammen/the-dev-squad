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

    return NextResponse.json({
      provider: {
        id: provider.id,
        label: provider.label,
        defaultModel: provider.defaultModel,
        mode: provider.mode,
      },
      models,
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
      { status: 500 }
    );
  }
}