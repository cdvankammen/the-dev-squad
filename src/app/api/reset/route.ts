import { rmSync, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import {
  clearApprovedBashGrant,
  clearPendingApproval,
} from '@/lib/pipeline-approval';
import { withLockedJsonState, writeJsonStateLocked } from '@/lib/locked-json-state';
import { authorizeLocalOrTokenRequest } from '@/lib/skill-runtime';

const BUILDS_DIR = join(homedir(), 'Builds');
const STAGING_DIR = join(BUILDS_DIR, '.staging');
const MANUAL_DIR = join(BUILDS_DIR, '.manual');
const CONTROL_LOCK_FILE = join(BUILDS_DIR, '.pipeline-control-lock.json');
const BUILDUI_DIR = resolve(process.cwd(), 'pipeline');
const ESCAPED_BUILDUI_DIR = BUILDUI_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WAIT_ARRAY = new Int32Array(new SharedArrayBuffer(4));
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

export async function POST(req: NextRequest) {
  const auth = authorizeLocalOrTokenRequest(req, 'reset endpoint');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message || 'Unauthorized' }, { status: 401 });
  }

  try {
    let mode = 'pipeline';
    try {
      const body = await req.json();
      mode = body.mode || 'pipeline';
    } catch {}

    if (mode === 'manual') {
      const workersStopped = WORKER_PATTERNS.every((pattern) => stopProcessPattern(pattern));
      if (!workersStopped) {
        return NextResponse.json({ ok: false, error: 'Could not fully stop active manual worker processes' }, { status: 409 });
      }

      // Manual mode — just delete the .manual directory
      if (existsSync(MANUAL_DIR)) {
        rmSync(MANUAL_DIR, { recursive: true, force: true });
      }
      return NextResponse.json({ ok: true });
    }

    return withLockedJsonState(CONTROL_LOCK_FILE, () => {
      const orchestratorStopped = stopProcessPattern(ORCHESTRATOR_PATTERN);
      const runnerStopped = WORKER_PATTERNS.every((pattern) => stopProcessPattern(pattern));
      if (!orchestratorStopped || !runnerStopped) {
        return NextResponse.json({ ok: false, error: 'Could not fully stop active pipeline processes' }, { status: 409 });
      }

      // Pipeline mode — clear staging + reset active projects
      if (existsSync(STAGING_DIR)) {
        rmSync(STAGING_DIR, { recursive: true, force: true });
      }

      let resetFailures = 0;

      try {
        const dirs = readdirSync(BUILDS_DIR)
          .filter(name => name !== '.staging' && name !== '.manual')
          .map(name => join(BUILDS_DIR, name))
          .filter(p => {
            try { return statSync(p).isDirectory() && statSync(join(p, 'pipeline-events.json')).isFile(); }
            catch { return false; }
          });

        for (const dir of dirs) {
          try {
            const eventsFile = join(dir, 'pipeline-events.json');
            const state = JSON.parse(readFileSync(eventsFile, 'utf8'));
            const shouldReset =
              state.currentPhase !== 'concept' ||
              state.pipelineStatus === 'running' ||
              state.pipelineStatus === 'paused' ||
              state.pipelineStatus === 'failed' ||
              state.pipelineStatus === 'complete' ||
              !!state.buildComplete;

            if (shouldReset) {
              state.currentPhase = 'concept';
              state.projectDir = '';
              state.concept = '';
              state.activeAgent = '';
              state.buildComplete = false;
              state.pipelineStatus = 'idle';
              state.stopAfterPhase = 'none';
              state.resumeAction = 'none';
              state.resumeActionTarget = undefined;
              state.runFinalAudit = false;
              state.auditFindings = [];
              state.auditDeployPending = false;
              state.auditActionInFlight = false;
              state.agentStatus = { A: 'idle', B: 'idle', C: 'idle', D: 'idle', E: 'idle', S: 'idle' };
              state.sessions = {};
              state.events = [];
              state.usage = {
                inputTokens: 0,
                outputTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalCostUsd: 0,
              };
              if (state.runtime && typeof state.runtime === 'object') {
                state.runtime.activeTurn = null;
              }
              clearPendingApproval(dir);
              clearApprovedBashGrant(dir);
              writeJsonStateLocked(eventsFile, state as Record<string, unknown>);
            } else {
              clearPendingApproval(dir);
              clearApprovedBashGrant(dir);
            }
          } catch {
            resetFailures += 1;
          }
        }
      } catch {
        resetFailures += 1;
      }

      if (resetFailures > 0) {
        return NextResponse.json(
          { ok: false, error: `Reset completed with ${resetFailures} project reset failures` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
