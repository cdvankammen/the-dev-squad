import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { NextRequest, NextResponse } from 'next/server';
import { EMPTY_RUNTIME } from '@/lib/pipeline-runtime';
import { readJsonState } from '@/lib/locked-json-state';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

const BUILDS_DIR = join(homedir(), 'Builds');
const STAGING_DIR = join(BUILDS_DIR, '.staging');
const MANUAL_DIR = join(BUILDS_DIR, '.manual');

const EMPTY_STATE = {
  concept: '',
  projectDir: '',
  currentPhase: 'concept',
  securityMode: 'fast',
  runGoal: 'full-build',
  runFinalAudit: false,
  stopAfterPhase: 'none',
  pipelineStatus: 'idle',
  activeAgent: '',
  selectedModel: '',
  selectedProvider: 'claude',
  requestedWorkingDir: '',
  agentModels: {},
  agentStatus: { A: 'idle', B: 'idle', C: 'idle', D: 'idle', E: 'idle', S: 'idle' },
  sessions: {},
  buildComplete: false,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostUsd: 0 },
  runtime: { ...EMPTY_RUNTIME },
  events: [],
  auditFindings: [],
  auditDeployPending: false,
  auditActionInFlight: false,
};

function normalizeState(data: Record<string, unknown>) {
  return {
    ...EMPTY_STATE,
    ...data,
    concept: typeof data.concept === 'string' ? data.concept : EMPTY_STATE.concept,
    projectDir: typeof data.projectDir === 'string' ? data.projectDir : EMPTY_STATE.projectDir,
    currentPhase: typeof data.currentPhase === 'string' ? data.currentPhase : EMPTY_STATE.currentPhase,
    securityMode: data.securityMode === 'strict' ? 'strict' : 'fast',
    runGoal: data.runGoal === 'plan-only' ? 'plan-only' : 'full-build',
    runFinalAudit: data.runFinalAudit === true,
    stopAfterPhase: typeof data.stopAfterPhase === 'string' ? data.stopAfterPhase : 'none',
    pipelineStatus:
      typeof data.pipelineStatus === 'string'
        ? data.pipelineStatus
        : (data.buildComplete ? 'complete' : (data.currentPhase && data.currentPhase !== 'concept' ? 'running' : 'idle')),
    agentStatus: { ...EMPTY_STATE.agentStatus, ...(data.agentStatus as Record<string, string> | undefined) },
    usage: { ...EMPTY_STATE.usage, ...(data.usage as Record<string, number> | undefined) },
    runtime: data.runtime && typeof data.runtime === 'object' ? data.runtime : { ...EMPTY_RUNTIME },
    events: Array.isArray(data.events) ? data.events : [],
    auditFindings: Array.isArray(data.auditFindings) ? data.auditFindings : [],
    auditDeployPending: data.auditDeployPending === true,
    auditActionInFlight: data.auditActionInFlight === true,
  };
}

function listProjectDirs(): string[] {
  try {
    return readdirSync(BUILDS_DIR)
      .filter((name) => name !== '.staging' && name !== '.manual')
      .map((name) => join(BUILDS_DIR, name))
      .filter((projectDir) => {
        try {
          return statSync(projectDir).isDirectory() && statSync(join(projectDir, 'pipeline-events.json')).isFile();
        } catch {
          return false;
        }
      })
      .sort((a, b) => statSync(join(b, 'pipeline-events.json')).mtimeMs - statSync(join(a, 'pipeline-events.json')).mtimeMs);
  } catch {
    return [];
  }
}

function findLatestProject(): string | null {
  const dirs = listProjectDirs();

  const running = dirs.find((projectDir) => {
    const state = readJsonState(join(projectDir, 'pipeline-events.json'));
    const status = String(state?.pipelineStatus || '');
    return status === 'running' || status === 'awaiting-audit-decision';
  });
  if (running) return running;

  const pausedActive = dirs.find((projectDir) => {
    const state = readJsonState(join(projectDir, 'pipeline-events.json'));
    const status = String(state?.pipelineStatus || '');
    const phase = String(state?.currentPhase || 'concept');
    return status === 'paused' && phase !== 'concept';
  });
  if (pausedActive) return pausedActive;

  return dirs[0] || null;
}

export async function GET(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'state endpoint');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get('mode') || 'pipeline';

  if (mode === 'manual') {
    const manualEvents = join(MANUAL_DIR, 'manual-state.json');
    if (existsSync(manualEvents)) {
      const data = readJsonState(manualEvents);
      if (data) {
        return NextResponse.json(normalizeState(data));
      }
    }
    return NextResponse.json(EMPTY_STATE);
  }

  const stagingEvents = join(STAGING_DIR, 'pipeline-events.json');
  const stagingData = existsSync(stagingEvents) ? readJsonState(stagingEvents) : null;

  const projectDir = findLatestProject();
  if (!projectDir) {
    if (stagingData) return NextResponse.json(normalizeState(stagingData));
    return NextResponse.json(EMPTY_STATE);
  }

  try {
    const raw = readJsonState(join(projectDir, 'pipeline-events.json'));
    if (!raw) {
      if (stagingData) return NextResponse.json(normalizeState(stagingData));
      return NextResponse.json(EMPTY_STATE);
    }

    const data = normalizeState(raw);
    const phase = data.currentPhase || 'concept';
    const pipelineStatus = data.pipelineStatus || (data.buildComplete ? 'complete' : 'idle');
    const isVisible =
      (phase && phase !== 'concept') ||
      pipelineStatus === 'running' ||
      pipelineStatus === 'paused' ||
      pipelineStatus === 'awaiting-audit-decision' ||
      pipelineStatus === 'failed' ||
      pipelineStatus === 'complete' ||
      !!data.buildComplete;

    if (isVisible) {
      return NextResponse.json(data);
    }

    if (stagingData) {
      return NextResponse.json(normalizeState(stagingData));
    }

    return NextResponse.json(EMPTY_STATE);
  } catch {
    if (stagingData) {
      return NextResponse.json(normalizeState(stagingData));
    }
    return NextResponse.json(EMPTY_STATE);
  }
}
