import { NextRequest, NextResponse } from 'next/server';
import { startPipelineRun } from '@/lib/pipeline-control';

export async function POST(req: NextRequest) {
  let securityMode = 'fast';
  let permissionMode = 'auto';
  let runGoal = 'full-build';
  let runFinalAudit = false;
  let model: string | undefined;
  let provider: string | undefined;
  let agentModels: Record<string, string> | undefined;
  let workingDir: string | undefined;
  try {
    const body = await req.json();
    if (body?.securityMode === 'strict') securityMode = 'strict';
    if (body?.permissionMode === 'plan') permissionMode = 'plan';
    else if (body?.permissionMode === 'dangerously-skip-permissions') permissionMode = 'dangerously-skip-permissions';
    if (body?.runGoal === 'plan-only') runGoal = 'plan-only';
    if (body?.runFinalAudit === true) runFinalAudit = true;
    if (typeof body?.model === 'string' && body.model.trim()) model = body.model.trim();
    if (typeof body?.provider === 'string' && body.provider.trim()) provider = body.provider.trim();
    if (typeof body?.workingDir === 'string' && body.workingDir.trim()) workingDir = body.workingDir.trim();
    if (body?.agentModels && typeof body.agentModels === 'object') {
      agentModels = Object.fromEntries(
        Object.entries(body.agentModels)
          .map(([agent, value]) => [agent, String(value || '').trim()])
          .filter(([, value]) => Boolean(value))
      );
    }
  } catch {}

  if (provider && !['claude', 'lm-studio', 'ollama', 'openwebui', 'openai-compat'].includes(provider)) {
    return NextResponse.json({
      success: false,
      error: `Pipeline runs are not wired to '${provider}' on this branch yet. Claude, LM Studio, Ollama, Open WebUI, and generic OpenAI-compatible endpoints are enabled here; OpenCode is available for live direct-chat testing.`
    }, { status: 400 });
  }

  const result = startPipelineRun({
    securityMode: securityMode === 'strict' ? 'strict' : 'fast',
    permissionMode: permissionMode as 'auto' | 'plan' | 'dangerously-skip-permissions',
    runGoal: runGoal === 'plan-only' ? 'plan-only' : 'full-build',
    runFinalAudit,
    model,
    provider,
    agentModels,
    workingDir,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Could not start pipeline' });
  }

  return NextResponse.json(result);
}
