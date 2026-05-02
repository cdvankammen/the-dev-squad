import { NextResponse } from 'next/server';
import { describeModelListing, getProviderDefaultModel, getProviderDefinition, type ProviderId } from '@/lib/provider-catalog';

function getProviderIdFromRequest(req: Request): ProviderId {
  const url = new URL(req.url);
  const raw = url.searchParams.get('provider') || url.searchParams.get('id') || 'claude';
  return getProviderDefinition(raw).id as ProviderId;
}

export async function GET(req: Request) {
  const providerId = getProviderIdFromRequest(req);
  const provider = getProviderDefinition(providerId);
  const result = describeModelListing(providerId);
  const normalizedStatus = result.models.length === 0 && result.error ? 'error' : result.status;

  return NextResponse.json({
    providerId,
    provider,
    defaultModel: getProviderDefaultModel(providerId),
    models: result.models,
    readyModels: result.readyModels || [],
    recommendedModel: result.recommendedModel || null,
    preflightOk: result.preflightOk !== false,
    preflightMessage: result.preflightMessage || '',
    status: normalizedStatus,
    error: result.error,
    endpoint: result.endpoint,
  });
}
