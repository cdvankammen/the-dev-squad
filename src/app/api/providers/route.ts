import { NextResponse } from 'next/server';
import { inspectOpenCodeProviders, listProviders } from '@/lib/provider-catalog';

export async function GET() {
  const providers = listProviders().map((provider) => ({
    ...provider,
    available: true,
  }));

  let openCode: ReturnType<typeof inspectOpenCodeProviders> | null = null;
  try {
    openCode = inspectOpenCodeProviders();
  } catch {
    openCode = null;
  }

  return NextResponse.json({
    providers,
    openCode,
  });
}