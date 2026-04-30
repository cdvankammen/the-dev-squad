import { NextResponse } from 'next/server';
import { getProviderDefaultModel, getProviderDefinition, listModels, type ProviderId } from '@/lib/provider-catalog';

function getProviderIdFromRequest(req: Request): ProviderId {
  const url = new URL(req.url);
  const raw = url.searchParams.get('provider') || url.searchParams.get('id') || 'claude';
  return getProviderDefinition(raw).id as ProviderId;
}

export async function GET(req: Request) {
  const providerId = getProviderIdFromRequest(req);
  const provider = getProviderDefinition(providerId);
  const models = listModels(providerId);

  return NextResponse.json({
    providerId,
    provider,
    defaultModel: getProviderDefaultModel(providerId),
    models,
  });
}
