import { NextRequest, NextResponse } from 'next/server';
import { getRequestOrigin } from '@/lib/skill-runtime';

async function probeJson(url: string) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const elapsedMs = Date.now() - startedAt;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      elapsedMs,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      data: null,
    };
  }
}

export async function GET(req: NextRequest) {
  const origin = getRequestOrigin(req);

  const [providers, pipelineState, manualState] = await Promise.all([
    probeJson(`${origin}/api/providers`),
    probeJson(`${origin}/api/state?mode=pipeline`),
    probeJson(`${origin}/api/state?mode=manual`),
  ]);

  const providerCount =
    providers.data &&
    typeof providers.data === 'object' &&
    Array.isArray((providers.data as Record<string, unknown>).providers)
      ? ((providers.data as Record<string, unknown>).providers as unknown[]).length
      : 0;

  const pipelinePhase =
    pipelineState.data && typeof pipelineState.data === 'object'
      ? String((pipelineState.data as Record<string, unknown>).currentPhase || 'concept')
      : 'unknown';

  const pipelineStatus =
    pipelineState.data && typeof pipelineState.data === 'object'
      ? String((pipelineState.data as Record<string, unknown>).pipelineStatus || 'idle')
      : 'unknown';

  const healthy = providers.ok && pipelineState.ok && manualState.ok;

  return NextResponse.json({
    ok: healthy,
    service: 'the-dev-squad',
    timestamp: new Date().toISOString(),
    checks: {
      providers: {
        ok: providers.ok,
        status: providers.status,
        elapsedMs: providers.elapsedMs,
        providerCount,
      },
      pipelineState: {
        ok: pipelineState.ok,
        status: pipelineState.status,
        elapsedMs: pipelineState.elapsedMs,
        phase: pipelinePhase,
        pipelineStatus,
      },
      manualState: {
        ok: manualState.ok,
        status: manualState.status,
        elapsedMs: manualState.elapsedMs,
      },
    },
  }, {
    status: healthy ? 200 : 503,
  });
}
