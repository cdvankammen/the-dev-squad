import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSkillRequest,
  buildSkillMetadata,
  buildUpdates,
  fetchPipelineState,
  getRequestOrigin,
  normalizeAfter,
  normalizeLimit,
  resetSupervisorRun,
  sendSupervisorMessage,
  startSupervisorRun,
  type SkillMode,
} from '@/lib/skill-runtime';
import { describeModelListing, getProviderDefinition } from '@/lib/provider-catalog';

function resolveMode(input: unknown): SkillMode {
  return input === 'manual' ? 'manual' : 'pipeline';
}

export async function GET(req: NextRequest) {
  const auth = authorizeSkillRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  const action = String(req.nextUrl.searchParams.get('action') || 'describe').trim();
  const mode = resolveMode(req.nextUrl.searchParams.get('mode'));
  const origin = getRequestOrigin(req);

  if (action === 'state') {
    try {
      const state = await fetchPipelineState(origin, mode);
      return NextResponse.json({ success: true, mode, state });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }
  }

  if (action === 'updates') {
    const after = normalizeAfter(req.nextUrl.searchParams.get('after'));
    const limit = normalizeLimit(req.nextUrl.searchParams.get('limit'));
    try {
      const state = await fetchPipelineState(origin, mode);
      return NextResponse.json({
        success: true,
        mode,
        updates: buildUpdates(state, after, limit),
      });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }
  }

  if (action === 'provider_models') {
    const provider = getProviderDefinition(req.nextUrl.searchParams.get('provider') || 'lm-studio');
    const result = describeModelListing(provider.id);
    return NextResponse.json({
      success: result.status === 'ok',
      providerId: provider.id,
      provider,
      status: result.status,
      error: result.error,
      endpoint: result.endpoint,
      models: result.models,
      readyModels: result.readyModels || [],
      recommendedModel: result.recommendedModel || null,
      preflightOk: result.preflightOk !== false,
      preflightMessage: result.preflightMessage || '',
      note: 'Use these model ids in supervisor_message model and agentModels fields. LM Studio/Ollama >8B model switches are cooldown-protected by the orchestrator.',
    });
  }

  return NextResponse.json({
    success: true,
    mode,
    metadata: buildSkillMetadata(),
    usage: {
      send: 'POST /api/skill/dev-squad with {"action":"supervisor_message","message":"..."}',
      startRun: 'POST /api/skill/dev-squad with {"action":"start_run","concept":"...","provider":"lm-studio"}',
      reset: 'POST /api/skill/dev-squad with {"action":"pipeline_reset","mode":"pipeline"}',
      state: 'GET /api/skill/dev-squad?action=state&mode=pipeline',
      updates: 'GET /api/skill/dev-squad?action=updates&mode=pipeline&after=0&limit=50',
      providerModels: 'GET /api/skill/dev-squad?action=provider_models&provider=lm-studio',
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = authorizeSkillRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const origin = getRequestOrigin(req);
  const action = String(body.action || 'supervisor_message').trim();
  const mode = resolveMode(body.mode);

  if (action === 'pipeline_state') {
    try {
      const state = await fetchPipelineState(origin, mode);
      return NextResponse.json({ success: true, mode, state });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }
  }

  if (action === 'pipeline_updates') {
    const after = normalizeAfter(body.after);
    const limit = normalizeLimit(body.limit);
    try {
      const state = await fetchPipelineState(origin, mode);
      return NextResponse.json({ success: true, mode, updates: buildUpdates(state, after, limit) });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }
  }

  if (action === 'provider_models') {
    const provider = getProviderDefinition(typeof body.provider === 'string' ? body.provider : 'lm-studio');
    const result = describeModelListing(provider.id);
    return NextResponse.json({
      success: result.status === 'ok',
      providerId: provider.id,
      provider,
      status: result.status,
      error: result.error,
      endpoint: result.endpoint,
      models: result.models,
      readyModels: result.readyModels || [],
      recommendedModel: result.recommendedModel || null,
      preflightOk: result.preflightOk !== false,
      preflightMessage: result.preflightMessage || '',
      note: 'Use these model ids in supervisor_message model and agentModels fields. LM Studio/Ollama >8B model switches are cooldown-protected by the orchestrator.',
    });
  }

  if (action === 'start_run') {
    try {
      const result = await startSupervisorRun(origin, {
        concept: typeof body.concept === 'string' ? body.concept : undefined,
        model: typeof body.model === 'string' ? body.model : undefined,
        provider: typeof body.provider === 'string' ? body.provider : undefined,
        workingDir: typeof body.workingDir === 'string' ? body.workingDir : undefined,
        securityMode: body.securityMode === 'strict' ? 'strict' : body.securityMode === 'fast' ? 'fast' : undefined,
        permissionMode:
          body.permissionMode === 'plan' || body.permissionMode === 'dangerously-skip-permissions' || body.permissionMode === 'auto'
            ? body.permissionMode
            : undefined,
        runGoal: body.runGoal === 'plan-only' ? 'plan-only' : body.runGoal === 'full-build' ? 'full-build' : undefined,
        runFinalAudit: body.runFinalAudit === true,
        agentModels:
          body.agentModels && typeof body.agentModels === 'object' && !Array.isArray(body.agentModels)
            ? (body.agentModels as Record<string, string>)
            : undefined,
      });

      return NextResponse.json({
        success: true,
        mode: 'pipeline',
        targetAgent: 'S',
        response: result.response,
        state: result.state,
        note: 'This structured action stages the concept if provided, then starts the run without relying on natural-language start parsing.',
      });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }
  }

  if (action === 'pipeline_reset') {
    try {
      const result = await resetSupervisorRun(origin, mode);
      return NextResponse.json({ success: true, mode, response: result.response, state: result.state || null });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }
  }

  if (action !== 'supervisor_message') {
    return NextResponse.json({
      success: false,
      error: `Unknown action: ${action}`,
      allowedActions: ['supervisor_message', 'start_run', 'pipeline_reset', 'pipeline_state', 'pipeline_updates', 'provider_models'],
    }, { status: 400 });
  }

  const message = String(body.message || '').trim();
  if (!message) {
    return NextResponse.json({ success: false, error: 'message is required for supervisor_message' }, { status: 400 });
  }

  try {
    const result = await sendSupervisorMessage(origin, {
      message,
      mode,
      model: typeof body.model === 'string' ? body.model : undefined,
      provider: typeof body.provider === 'string' ? body.provider : undefined,
      workingDir: typeof body.workingDir === 'string' ? body.workingDir : undefined,
      securityMode: body.securityMode === 'strict' ? 'strict' : body.securityMode === 'fast' ? 'fast' : undefined,
      permissionMode:
        body.permissionMode === 'plan' || body.permissionMode === 'dangerously-skip-permissions' || body.permissionMode === 'auto'
          ? body.permissionMode
          : undefined,
      runGoal: body.runGoal === 'plan-only' ? 'plan-only' : body.runGoal === 'full-build' ? 'full-build' : undefined,
      runFinalAudit: body.runFinalAudit === true,
      agentModels:
        body.agentModels && typeof body.agentModels === 'object' && !Array.isArray(body.agentModels)
          ? (body.agentModels as Record<string, string>)
          : undefined,
    });

    return NextResponse.json({
      success: true,
      mode,
      targetAgent: 'S',
      response: result.response,
      state: result.state,
      note: 'Only Supervisor S accepts external control. A/B/C/D/E remain orchestrator-controlled.',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
