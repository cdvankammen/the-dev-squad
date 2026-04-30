import { NextResponse } from 'next/server';
import { getProviderConfig } from '@/lib/providerConfig';
import { getProviderDefaultModel, listProviders, type ProviderDefinition } from '@/lib/provider-catalog';

export async function GET() {
  const providers = listProviders().map((provider: ProviderDefinition) => {
    const config = getProviderConfig(provider.id);
    return {
      ...provider,
      defaultModel: provider.defaultModel || getProviderDefaultModel(provider.id),
      config: {
        host: config.host,
        port: config.port,
        baseUrl: config.baseUrl || '',
        apiKey: '',
        apiKeyConfigured: Boolean(config.apiKey),
        enabled: config.enabled !== false,
      },
    };
  });

  return NextResponse.json({ providers });
}
