import { NextRequest, NextResponse } from 'next/server';
import { startPipelineRun } from '@/lib/pipeline-control';
import getModelAdapter from '@/lib/modelAdapters';

export async function POST(req: NextRequest) {
  let securityMode = 'fast';
  let permissionMode = 'auto';
  let runGoal = 'full-build';
  let runFinalAudit = false;
  let discoveredOnly = false;
  try {
    const body = await req.json();
    if (body?.securityMode === 'strict') securityMode = 'strict';
    if (body?.permissionMode === 'plan') permissionMode = 'plan';
    else if (body?.permissionMode === 'dangerously-skip-permissions') permissionMode = 'dangerously-skip-permissions';
    if (body?.runGoal === 'plan-only') runGoal = 'plan-only';
    if (body?.runFinalAudit === true) runFinalAudit = true;
    // Optional discovered-only preference
    discoveredOnly = Boolean(body?.discoveredOnly);
    // Optional model/provider coming from UI
    var model = typeof body?.model === 'string' ? body.model : undefined;
    var modelProvider = typeof body?.modelProvider === 'string' ? body.modelProvider : undefined;
    // Per-agent model overrides
    var agentModels = body?.agentModels && typeof body.agentModels === 'object' ? body.agentModels : undefined;
  } catch {}

  if (modelProvider) {
    const adapter = getModelAdapter(modelProvider);
    if (!adapter) {
      return NextResponse.json({ success: false, error: `Unknown model provider: ${modelProvider}` }, { status: 400 });
    }
    if (typeof adapter.supportsExecution === 'function' && adapter.supportsExecution() === false) {
      return NextResponse.json({ success: false, error: `Provider '${modelProvider}' can be discovered in this repo but does not expose executable runner sessions for the pipeline.` }, { status: 400 });
    }
    if (!adapter.isAvailable()) {
      return NextResponse.json({ success: false, error: `Provider '${modelProvider}' is not available in this environment.` }, { status: 400 });
    }
  }

  const result = startPipelineRun({
    securityMode: securityMode === 'strict' ? 'strict' : 'fast',
    permissionMode: permissionMode as 'auto' | 'plan' | 'dangerously-skip-permissions',
    runGoal: runGoal === 'plan-only' ? 'plan-only' : 'full-build',
    runFinalAudit,
    model,
    modelProvider,
    discoveredOnly,
    agentModels,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Could not start pipeline' });
  }

  return NextResponse.json(result);
}
