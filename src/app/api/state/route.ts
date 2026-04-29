import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { NextRequest, NextResponse } from 'next/server';
import { EMPTY_RUNTIME } from '@/lib/pipeline-runtime';
import { findLatestProject } from '@/lib/projectLocator';

const BUILDS_DIR = join(homedir(), 'Builds');
const STAGING_DIR = join(BUILDS_DIR, '.staging');
const MANUAL_DIR = join(BUILDS_DIR, '.manual');

const EMPTY_STATE = {
  concept: '', projectDir: '', currentPhase: 'concept', securityMode: 'fast', runGoal: 'full-build', runFinalAudit: false, stopAfterPhase: 'none', pipelineStatus: 'idle', activeAgent: '',
  selectedModel: '', selectedProvider: 'claude',
  agentModels: {},
  agentStatus: { A: 'idle', B: 'idle', C: 'idle', D: 'idle', E: 'idle', S: 'idle' },
  sessions: {}, buildComplete: false,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostUsd: 0 },
  runtime: { ...EMPTY_RUNTIME },
  events: [],
  auditFindings: [],
  auditDeployPending: false,
  auditActionInFlight: false,
};

const VALID_RESUME_ACTIONS = ['none', 'continue-approved-plan', 'resume-stalled-turn', 'audit-send-to-c', 'audit-dismiss', 'audit-deploy'] as const;
const VALID_PIPELINE_STATUSES = ['idle', 'running', 'paused', 'awaiting-audit-decision', 'complete', 'failed'] as const;

function normalizeState(data: Record<string, unknown>) {
  return {
    ...EMPTY_STATE,
    ...data,
    securityMode: data.securityMode === 'strict' ? 'strict' : 'fast',
    runGoal: data.runGoal === 'plan-only' ? 'plan-only' : 'full-build',
    runFinalAudit: data.runFinalAudit === true,
    stopAfterPhase: data.stopAfterPhase === 'plan-review' ? 'plan-review' : 'none',
    resumeAction: VALID_RESUME_ACTIONS.includes(data.resumeAction as typeof VALID_RESUME_ACTIONS[number])
      ? data.resumeAction
      : 'none',
    resumeActionTarget: typeof data.resumeActionTarget === 'string' ? data.resumeActionTarget : undefined,
    pipelineStatus: typeof data.pipelineStatus === 'string' && VALID_PIPELINE_STATUSES.includes(data.pipelineStatus as typeof VALID_PIPELINE_STATUSES[number])
      ? data.pipelineStatus
      : (data.buildComplete ? 'complete' : (data.currentPhase && data.currentPhase !== 'concept' ? 'running' : 'idle')),
    agentStatus: { ...EMPTY_STATE.agentStatus, ...(data.agentStatus as Record<string, string> | undefined) },
    usage: { ...EMPTY_STATE.usage, ...(data.usage as Record<string, number> | undefined) },
    runtime: data.runtime && typeof data.runtime === 'object' ? data.runtime : { ...EMPTY_RUNTIME },
    events: Array.isArray(data.events) ? data.events : [],
    auditFindings: Array.isArray(data.auditFindings) ? data.auditFindings : [],
    auditDeployPending: data.auditDeployPending === true,
    auditActionInFlight: data.auditActionInFlight === true,
    selectedModel: typeof data.selectedModel === 'string' ? data.selectedModel : EMPTY_STATE.selectedModel,
    selectedProvider: typeof data.selectedProvider === 'string' ? data.selectedProvider : EMPTY_STATE.selectedProvider,
    agentModels: data.agentModels && typeof data.agentModels === 'object' ? data.agentModels : {},
  };
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') || 'pipeline';

  // Manual mode — read from .manual directory
  if (mode === 'manual') {
    const manualEvents = join(MANUAL_DIR, 'manual-state.json');
    if (existsSync(manualEvents)) {
      try {
        const data = JSON.parse(readFileSync(manualEvents, 'utf8'));
        return NextResponse.json(normalizeState(data));
      } catch {}
    }
    return NextResponse.json(EMPTY_STATE);
  }

  // Pipeline mode — check staging first, then real projects
  const stagingEvents = join(STAGING_DIR, 'pipeline-events.json');
  if (existsSync(stagingEvents)) {
    try {
      const data = JSON.parse(readFileSync(stagingEvents, 'utf8'));
      return NextResponse.json(normalizeState(data));
    } catch {}
  }

  const projectDir = findLatestProject();
  if (!projectDir) {
    return NextResponse.json(EMPTY_STATE);
  }

  try {
    const raw = JSON.parse(readFileSync(join(projectDir, 'pipeline-events.json'), 'utf8'));
    const data = normalizeState(raw);
    const pipelineStatus = data.pipelineStatus;
    const isVisible =
      pipelineStatus === 'running' ||
      pipelineStatus === 'paused' ||
      pipelineStatus === 'awaiting-audit-decision' ||
      pipelineStatus === 'failed' ||
      pipelineStatus === 'complete' ||
      !!data.buildComplete;
    if (isVisible) {
      return NextResponse.json(data);
    }
    return NextResponse.json(EMPTY_STATE);
  } catch {
    return NextResponse.json(EMPTY_STATE);
  }
}
