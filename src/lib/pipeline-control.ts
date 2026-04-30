import { spawn, execFileSync, execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import {
  mutateJsonStateLocked,
  readJsonState,
  writeJsonStateAtomic,
  writeJsonStateLocked,
  withLockedJsonState,
} from './locked-json-state';

export const BUILDUI_DIR = resolve(process.cwd(), 'pipeline');
export const BUILDS_DIR = join(homedir(), 'Builds');
export const STAGING_DIR = join(BUILDS_DIR, '.staging');
const WAIT_ARRAY = new Int32Array(new SharedArrayBuffer(4));
const ESCAPED_BUILDUI_DIR = BUILDUI_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ORCHESTRATOR_PATTERN = 'tsx.*orchestrator\\.ts.*--project-dir.*\\/Builds\\/';
const WORKER_PATTERNS = [
  `claude.*--output-format.*stream-json.*${ESCAPED_BUILDUI_DIR}`,
  `node.*${ESCAPED_BUILDUI_DIR}.*http-runner-shim\\.mjs`,
  'opencode.*\\/Builds\\/',
];

function sleepMs(ms: number) {
  if (ms <= 0) return;
  Atomics.wait(WAIT_ARRAY, 0, 0, ms);
}

function waitForProcessClear(pattern: string, timeoutMs = 1200): boolean {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      execSync(`pgrep -f "${pattern}" >/dev/null`, { stdio: 'ignore' });
      sleepMs(60);
    } catch {
      return true;
    }
  }
  return false;
}

function stopProcessPattern(pattern: string): boolean {
  try {
    execSync(`pkill -TERM -f "${pattern}" >/dev/null 2>&1 || true`, { stdio: 'ignore' });
  } catch {}
  if (waitForProcessClear(pattern, 900)) return true;

  try {
    execSync(`pkill -KILL -f "${pattern}" >/dev/null 2>&1 || true`, { stdio: 'ignore' });
  } catch {}
  return waitForProcessClear(pattern, 600);
}

function isProcessPatternRunning(pattern: string): boolean {
  try {
    execSync(`pgrep -f "${pattern}" >/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return err?.code === 'EPERM';
  }
}

function waitForPidExit(pid: number, timeoutMs = 1200): boolean {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isPidAlive(pid)) return true;
    sleepMs(60);
  }
  return !isPidAlive(pid);
}

function stopOwnedProcess(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return true;

  try { process.kill(-pid, 'SIGTERM'); } catch {}
  try { process.kill(pid, 'SIGTERM'); } catch {}
  if (waitForPidExit(pid, 900)) return true;

  try { process.kill(-pid, 'SIGKILL'); } catch {}
  try { process.kill(pid, 'SIGKILL'); } catch {}
  return waitForPidExit(pid, 600);
}

function extractOrchestratorPid(state: Record<string, unknown> | null): number | null {
  if (!state || typeof state !== 'object') return null;
  const runtime = state.runtime && typeof state.runtime === 'object'
    ? (state.runtime as Record<string, unknown>)
    : null;
  const pid = Number(runtime?.orchestratorPid || 0);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function getKnownOrchestratorPids(): number[] {
  const pids = new Set<number>();
  for (const projectDir of listProjectDirs()) {
    const pid = extractOrchestratorPid(readPipelineState(projectDir));
    if (pid && isPidAlive(pid)) pids.add(pid);
  }
  const stagingState = readJson(join(STAGING_DIR, 'pipeline-events.json'));
  const stagingPid = extractOrchestratorPid(stagingState);
  if (stagingPid && isPidAlive(stagingPid)) pids.add(stagingPid);
  return [...pids];
}

function hasActivePipelineProcesses(): boolean {
  if (getKnownOrchestratorPids().length > 0) return true;
  if (isProcessPatternRunning(ORCHESTRATOR_PATTERN)) return true;
  return WORKER_PATTERNS.some((pattern) => isProcessPatternRunning(pattern));
}

export type SecurityMode = 'fast' | 'strict';
export type PermissionMode = 'auto' | 'plan' | 'dangerously-skip-permissions';
export type RunGoal = 'full-build' | 'plan-only';
export type ResumeOutcome = 'continue-approved-plan' | 'resume-stalled-turn';

function readJson(file: string): Record<string, unknown> | null {
  return readJsonState(file);
}

function writeJson(file: string, data: Record<string, unknown>) {
  writeJsonStateLocked(file, data);
}

function withControlLock<T>(fn: () => T): T {
  const controlLockFile = join(BUILDS_DIR, '.pipeline-control-lock.json');
  return withLockedJsonState(controlLockFile, () => fn());
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

function findRunningProject(): string | null {
  for (const projectDir of listProjectDirs()) {
    const state = readPipelineState(projectDir);
    if (String(state?.pipelineStatus || '') === 'running') {
      return projectDir;
    }
  }
  return null;
}

export function findLatestProject(): string | null {
  const running = findRunningProject();
  if (running) return running;
  return listProjectDirs()[0] || null;
}

export function readPipelineState(projectDir: string): Record<string, unknown> | null {
  return readJson(join(projectDir, 'pipeline-events.json'));
}

export function appendPipelineEvent(
  projectDir: string,
  event: { time?: string; agent: string; phase: string; type: string; text: string }
) {
  const file = join(projectDir, 'pipeline-events.json');
  mutateJsonStateLocked(file, (state) => {
    const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
    events.push({
      time: event.time || new Date().toISOString(),
      agent: event.agent,
      phase: event.phase,
      type: event.type,
      text: event.text,
    });
    state.events = events;
  });
}

function spawnOrchestrator(
  projectDir: string,
  securityMode: SecurityMode,
  aSession?: string,
  permissionMode?: PermissionMode,
  overrides?: { model?: string; provider?: string; workingDir?: string; agentModels?: Record<string, string> }
): { ok: boolean; pid?: number } {
  const orchestratorPath = join(BUILDUI_DIR, 'orchestrator.ts');
  const args = ['tsx', orchestratorPath, '--project-dir', projectDir];
  if (aSession) args.push('--a-session', aSession);

  const env: NodeJS.ProcessEnv = { ...process.env, PIPELINE_SECURITY_MODE: securityMode };
  if (permissionMode) env.PIPELINE_PERMISSION_MODE = permissionMode;
  if (overrides?.model) env.PIPELINE_MODEL = overrides.model;
  if (overrides?.provider) env.PIPELINE_PROVIDER = overrides.provider;
  if (overrides?.workingDir) env.PIPELINE_WORKING_DIR = overrides.workingDir;
  if (overrides?.agentModels && Object.keys(overrides.agentModels).length > 0) {
    env.PIPELINE_AGENT_MODELS = JSON.stringify(overrides.agentModels);
  }

  try {
    const child = spawn('npx', args, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env,
    });

    child.stdout?.on('data', (data) => process.stdout.write(data));
    child.stderr?.on('data', (data) => process.stderr.write(data));
    child.unref();
    return { ok: true, pid: typeof child.pid === 'number' && child.pid > 0 ? child.pid : undefined };
  } catch {
    return { ok: false };
  }
}

export function startPipelineRun(options: {
  securityMode?: SecurityMode;
  permissionMode?: PermissionMode;
  runGoal?: RunGoal;
  runFinalAudit?: boolean;
  model?: string;
  provider?: string;
  workingDir?: string;
  agentModels?: Record<string, string>;
}): { success: boolean; error?: string; projectDir?: string; securityMode?: SecurityMode; permissionMode?: PermissionMode; runGoal?: RunGoal; runFinalAudit?: boolean } {
  const securityMode = options.securityMode === 'strict' ? 'strict' : 'fast';
  const permissionMode: PermissionMode = options.permissionMode === 'plan' ? 'plan'
    : options.permissionMode === 'dangerously-skip-permissions' ? 'dangerously-skip-permissions'
    : 'auto';
  const runGoal = options.runGoal === 'plan-only' ? 'plan-only' : 'full-build';
  const runFinalAudit = options.runFinalAudit === true;

  const controlLockFile = join(BUILDS_DIR, '.pipeline-control-lock.json');
  try {
    return withLockedJsonState(controlLockFile, () => {
    const runningProject = findRunningProject();
    if (runningProject) {
      return { success: false, error: `A pipeline run is already active: ${runningProject}` };
    }
    if (hasActivePipelineProcesses()) {
      return { success: false, error: 'Pipeline process is still active; wait for it to stop before starting a new run.' };
    }

    const stagingEvents = join(STAGING_DIR, 'pipeline-events.json');
    const stagingState = readJson(stagingEvents);
    if (!stagingState) {
      return { success: false, error: 'No staging session found. Talk to S or A first.' };
    }

    const concept = String(stagingState.concept || '').trim();
    const sessions = (stagingState.sessions as Record<string, string> | undefined) || {};
    const aSession = sessions.A || '';

    if (!concept) {
      return { success: false, error: 'No build concept found yet.' };
    }

    const projectName = concept
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'new-build';

    let projectDir = join(BUILDS_DIR, projectName);
    if (existsSync(projectDir)) {
      const uniqueSuffix = Date.now().toString(36);
      projectDir = join(BUILDS_DIR, `${projectName}-${uniqueSuffix}`);
    }
    mkdirSync(projectDir, { recursive: true });

    const templates = ['checklist-template.md', 'build-plan-template.md'];
    for (const template of templates) {
      const src = join(BUILDUI_DIR, template);
      const dst = join(projectDir, template.replace('-template', ''));
      if (existsSync(src) && !existsSync(dst)) copyFileSync(src, dst);
    }

    mkdirSync(join(projectDir, '.claude', 'hooks'), { recursive: true });
    const settingsSrc = join(BUILDUI_DIR, '.claude', 'settings.json');
    const hookSrc = join(BUILDUI_DIR, '.claude', 'hooks', 'approval-gate.sh');
    if (existsSync(settingsSrc)) copyFileSync(settingsSrc, join(projectDir, '.claude', 'settings.json'));
    if (existsSync(hookSrc)) {
      copyFileSync(hookSrc, join(projectDir, '.claude', 'hooks', 'approval-gate.sh'));
      try {
        execFileSync('chmod', ['+x', join(projectDir, '.claude', 'hooks', 'approval-gate.sh')]);
      } catch {}
    }

    stagingState.projectDir = projectDir;
    stagingState.securityMode = securityMode;
    stagingState.permissionMode = permissionMode;
    stagingState.runGoal = runGoal;
    stagingState.runFinalAudit = runFinalAudit;
    stagingState.selectedModel = options.model || String(stagingState.selectedModel || 'claude-opus-4-6');
    stagingState.selectedProvider = options.provider || String(stagingState.selectedProvider || 'claude');
    stagingState.requestedWorkingDir = options.workingDir || String(stagingState.requestedWorkingDir || '');
    stagingState.agentModels = options.agentModels || (stagingState.agentModels as Record<string, string> | undefined) || {};
    stagingState.stopAfterPhase = runGoal === 'plan-only' ? 'plan-review' : 'none';
    stagingState.pipelineStatus = 'running';
    stagingState.resumeAction = 'none';
    writeJson(join(projectDir, 'pipeline-events.json'), stagingState);

    try {
      rmSync(STAGING_DIR, { recursive: true, force: true });
    } catch {}

    const launched = spawnOrchestrator(projectDir, securityMode, aSession || undefined, permissionMode, {
      model: stagingState.selectedModel as string | undefined,
      provider: stagingState.selectedProvider as string | undefined,
      workingDir: stagingState.requestedWorkingDir as string | undefined,
      agentModels: stagingState.agentModels as Record<string, string> | undefined,
    });

    if (!launched.ok) {
      mutateJsonStateLocked(join(projectDir, 'pipeline-events.json'), (state) => {
        state.pipelineStatus = 'paused';
        const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
        events.push({
          time: new Date().toISOString(),
          agent: 'system',
          phase: String(state.currentPhase || 'concept'),
          type: 'failure',
          text: 'Failed to launch orchestrator process',
        });
        state.events = events;
      });
      return { success: false, error: 'Failed to launch orchestrator process', projectDir, securityMode, permissionMode, runGoal, runFinalAudit };
    }

    mutateJsonStateLocked(join(projectDir, 'pipeline-events.json'), (state) => {
      const runtime = state.runtime && typeof state.runtime === 'object'
        ? (state.runtime as Record<string, unknown>)
        : {};
      if (launched.pid) runtime.orchestratorPid = launched.pid;
      runtime.orchestratorStartedAt = new Date().toISOString();
      state.runtime = runtime;
    });

    return { success: true, projectDir, securityMode, permissionMode, runGoal, runFinalAudit };
    });
  } catch (error) {
    return {
      success: false,
      error: `Could not start pipeline safely: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function setStopAfterReview(enabled: boolean, projectDir?: string): { success: boolean; error?: string; stopAfterPhase?: string; projectDir?: string } {
  const resolvedProjectDir = projectDir || findLatestProject();
  if (!resolvedProjectDir) {
    return { success: false, error: 'No pipeline project found' };
  }

  const file = join(resolvedProjectDir, 'pipeline-events.json');
  const state = mutateJsonStateLocked(file, (state) => {
    state.stopAfterPhase = enabled ? 'plan-review' : 'none';
    const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
    events.push({
      time: new Date().toISOString(),
      agent: 'S',
      phase: String(state.currentPhase || 'concept'),
      type: 'status',
      text: enabled ? 'Supervisor armed stop-after-review' : 'Supervisor cleared stop-after-review',
    });
    state.events = events;
  });
  if (!state) {
    return { success: false, error: 'No pipeline state found' };
  }

  return { success: true, projectDir: resolvedProjectDir, stopAfterPhase: String(state.stopAfterPhase || 'none') };
}

export function resumePipelineRun(projectDir?: string): { success: boolean; error?: string; projectDir?: string; action?: ResumeOutcome } {
  try {
    return withControlLock(() => {
      const resolvedProjectDir = projectDir || findLatestProject();
      if (!resolvedProjectDir) {
        return { success: false, error: 'No pipeline project found' };
      }

      const file = join(resolvedProjectDir, 'pipeline-events.json');
      let error: string | undefined;
      let action: ResumeOutcome | undefined;
      let resumePermission: PermissionMode = 'auto';
      let resumeSecurityMode: SecurityMode = 'fast';

      if (hasActivePipelineProcesses()) {
        return { success: false, error: 'Pipeline process is already active; cannot resume concurrently.' };
      }

      withLockedJsonState(file, (state) => {
        if (!state) {
          error = 'No pipeline state found';
          return;
        }

        const currentPhase = String(state.currentPhase || 'concept');
        const pipelineStatus = String(state.pipelineStatus || (state.buildComplete ? 'complete' : 'idle'));
        const activeTurn = (state.runtime as { activeTurn?: { status?: string; agent?: string; phase?: string } } | undefined)?.activeTurn;
        const isStalled = activeTurn?.status === 'stalled';
        const canResumeSupportedTurn = isStalled && (
          (activeTurn?.agent === 'A' && (activeTurn?.phase === 'planning' || activeTurn?.phase === 'plan-review')) ||
          (activeTurn?.agent === 'B' && activeTurn?.phase === 'plan-review')
        );
        const canContinueApprovedPlan = pipelineStatus === 'paused' && currentPhase === 'plan-review';

        if (!canResumeSupportedTurn && !canContinueApprovedPlan) {
          error = 'This run is not paused after review and does not have a resumable stalled turn';
          return;
        }

        if (canContinueApprovedPlan) {
          state.runGoal = 'full-build';
          state.stopAfterPhase = 'none';
          state.resumeAction = 'continue-approved-plan';
          action = 'continue-approved-plan';
        } else {
          state.resumeAction = 'resume-stalled-turn';
          action = 'resume-stalled-turn';
        }
        state.pipelineStatus = 'running';

        const actionText = canContinueApprovedPlan
          ? 'Supervisor resumed the build from the approved plan'
          : 'Supervisor requested a manual resume of the stalled turn';

        const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
        events.push({
          time: new Date().toISOString(),
          agent: 'S',
          phase: currentPhase,
          type: 'status',
          text: actionText,
        });
        state.events = events;

        resumePermission = state.permissionMode === 'plan' ? 'plan'
          : state.permissionMode === 'dangerously-skip-permissions' ? 'dangerously-skip-permissions'
          : 'auto';
        resumeSecurityMode = state.securityMode === 'strict' ? 'strict' : 'fast';

        writeJsonStateAtomic(file, state);
      });

      if (error) {
        return { success: false, error };
      }
      if (!action) {
        return { success: false, error: 'Could not determine resume action' };
      }

      const launched = spawnOrchestrator(resolvedProjectDir, resumeSecurityMode, undefined, resumePermission);
      if (!launched.ok) {
        mutateJsonStateLocked(file, (state) => {
          state.pipelineStatus = 'paused';
          const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
          events.push({
            time: new Date().toISOString(),
            agent: 'system',
            phase: String(state.currentPhase || 'concept'),
            type: 'failure',
            text: 'Failed to launch orchestrator process during resume',
          });
          state.events = events;
        });
        return { success: false, error: 'Failed to launch orchestrator process during resume', projectDir: resolvedProjectDir };
      }

      mutateJsonStateLocked(file, (state) => {
        const runtime = state.runtime && typeof state.runtime === 'object'
          ? (state.runtime as Record<string, unknown>)
          : {};
        if (launched.pid) runtime.orchestratorPid = launched.pid;
        runtime.orchestratorStartedAt = new Date().toISOString();
        state.runtime = runtime;
      });
      return { success: true, projectDir: resolvedProjectDir, action };
    });
  } catch (lockError) {
    return {
      success: false,
      error: `Could not resume safely: ${lockError instanceof Error ? lockError.message : String(lockError)}`,
    };
  }
}

export type AuditAction = 'send-to-c' | 'dismiss' | 'deploy';

export function startAuditAction(
  action: AuditAction,
  findingId: string | undefined,
  projectDir?: string
): { success: boolean; error?: string; status?: number; projectDir?: string } {
  try {
    return withControlLock(() => {
      const resolvedProjectDir = projectDir || findLatestProject();
      if (!resolvedProjectDir) {
        return { success: false, error: 'No pipeline project found', status: 404 };
      }

      const file = join(resolvedProjectDir, 'pipeline-events.json');
      let permissionMode: PermissionMode = 'auto';
      let securityMode: SecurityMode = 'fast';
      let error: string | undefined;
      let status: number | undefined;

      if (hasActivePipelineProcesses()) {
        return { success: false, error: 'Pipeline process is already active; cannot launch another audit action.', status: 409 };
      }

      withLockedJsonState(file, (state) => {
        if (!state) {
          error = 'No pipeline state found for that project';
          status = 404;
          return;
        }

        if (state.pipelineStatus !== 'awaiting-audit-decision') {
          error = `Audit actions are only valid when pipelineStatus is 'awaiting-audit-decision' (current: ${String(state.pipelineStatus)})`;
          status = 409;
          return;
        }

        if (state.auditActionInFlight === true) {
          error = 'An audit action is already in flight — wait for it to complete before starting another.';
          status = 409;
          return;
        }

        const findings = Array.isArray(state.auditFindings) ? state.auditFindings as Array<Record<string, unknown>> : [];

        if (action === 'send-to-c' || action === 'dismiss') {
          if (!findingId) {
            error = `findingId is required for action '${action}'`;
            status = 400;
            return;
          }
          const finding = findings.find((f) => typeof f?.id === 'string' && f.id === findingId);
          if (!finding) {
            error = `Unknown findingId: ${findingId}`;
            status = 400;
            return;
          }
          const allowedStatuses = ['open', 'still-open'];
          if (typeof finding.status === 'string' && !allowedStatuses.includes(finding.status)) {
            error = `Finding ${findingId} has status '${finding.status}'; only 'open' or 'still-open' findings can be acted on`;
            status = 409;
            return;
          }
        } else if (action !== 'deploy') {
          error = `Unknown action: ${String(action)}`;
          status = 400;
          return;
        }

        const resumeAction: 'audit-send-to-c' | 'audit-dismiss' | 'audit-deploy' =
          action === 'send-to-c' ? 'audit-send-to-c' : action === 'dismiss' ? 'audit-dismiss' : 'audit-deploy';

        state.resumeAction = resumeAction;
        state.resumeActionTarget = action === 'deploy' ? undefined : findingId;
        state.auditActionInFlight = true;

        permissionMode =
          state.permissionMode === 'plan' ? 'plan'
            : state.permissionMode === 'dangerously-skip-permissions' ? 'dangerously-skip-permissions'
              : 'auto';
        securityMode = state.securityMode === 'strict' ? 'strict' : 'fast';

        writeJsonStateAtomic(file, state);
      });

      if (error) {
        return { success: false, error, status };
      }

      const launched = spawnOrchestrator(
        resolvedProjectDir,
        securityMode,
        undefined,
        permissionMode
      );

      if (!launched.ok) {
        mutateJsonStateLocked(file, (state) => {
          state.auditActionInFlight = false;
          state.resumeAction = 'none';
          state.resumeActionTarget = undefined;
          const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
          events.push({
            time: new Date().toISOString(),
            agent: 'system',
            phase: String(state.currentPhase || 'concept'),
            type: 'failure',
            text: 'Failed to launch orchestrator process for audit action',
          });
          state.events = events;
        });
        return { success: false, error: 'Failed to launch orchestrator process for audit action', status: 503, projectDir: resolvedProjectDir };
      }

      mutateJsonStateLocked(file, (state) => {
        const runtime = state.runtime && typeof state.runtime === 'object'
          ? (state.runtime as Record<string, unknown>)
          : {};
        if (launched.pid) runtime.orchestratorPid = launched.pid;
        runtime.orchestratorStartedAt = new Date().toISOString();
        state.runtime = runtime;
      });

      return { success: true, projectDir: resolvedProjectDir };
    });
  } catch (lockError) {
    return {
      success: false,
      error: `Could not process audit action safely: ${lockError instanceof Error ? lockError.message : String(lockError)}`,
      status: 503,
    };
  }
}

export function stopPipelineRun(projectDir?: string): { success: boolean; projectDir?: string; error?: string } {
  const performStop = () => {
    const resolvedProjectDir = projectDir || findLatestProject() || undefined;
    const ownedPid = resolvedProjectDir ? extractOrchestratorPid(readPipelineState(resolvedProjectDir)) : null;
    const ownedStop = ownedPid ? stopOwnedProcess(ownedPid) : true;
    const orchestratorPatternStopped = stopProcessPattern(ORCHESTRATOR_PATTERN);
    const orchestratorStopped = ownedStop && orchestratorPatternStopped;
    const runnerStopped = WORKER_PATTERNS.every((pattern) => stopProcessPattern(pattern));

    if (resolvedProjectDir) {
      const file = join(resolvedProjectDir, 'pipeline-events.json');
      mutateJsonStateLocked(file, (state) => {
        if (orchestratorStopped && runnerStopped) {
          state.activeAgent = '';
          state.pipelineStatus = 'paused';
          if (state.agentStatus && typeof state.agentStatus === 'object') {
            for (const [agent, status] of Object.entries(state.agentStatus)) {
              if (status === 'active' || status === 'working') {
                (state.agentStatus as Record<string, string>)[agent] = 'idle';
              }
            }
          }
          if (state.runtime && typeof state.runtime === 'object') {
            const runtime = state.runtime as Record<string, unknown>;
            runtime.activeTurn = null;
            runtime.orchestratorPid = 0;
            runtime.orchestratorStoppedAt = new Date().toISOString();
          }
        }
        const events = Array.isArray(state.events) ? (state.events as Array<Record<string, unknown>>) : [];
        events.push({
          time: new Date().toISOString(),
          agent: 'system',
          phase: String(state.currentPhase || 'concept'),
          type: orchestratorStopped && runnerStopped ? 'status' : 'failure',
          text: orchestratorStopped && runnerStopped
            ? 'Pipeline stopped by user'
            : 'Stop requested, but one or more pipeline processes could not be fully terminated',
        });
        state.events = events;
      });
    }

    if (!orchestratorStopped || !runnerStopped) {
      return {
        success: false,
        projectDir: resolvedProjectDir,
        error: 'Could not fully stop active pipeline processes',
      };
    }

    return { success: true, projectDir: resolvedProjectDir };
  };

  try {
    return withControlLock(performStop);
  } catch (error) {
    return {
      success: false,
      error: `Could not stop safely: ${error instanceof Error ? error.message : String(error)}`,
      projectDir: projectDir || findLatestProject() || undefined,
    };
  }
}
