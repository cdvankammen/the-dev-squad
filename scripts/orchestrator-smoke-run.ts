#!/usr/bin/env tsx
import { join } from 'path';
import { homedir } from 'os';
import { createStagingSession, findLatestProject, readPipelineState, startPipelineRun, stopPipelineRun } from '../src/lib/pipeline-control';
import { existsSync, readFileSync, rmSync } from 'fs';

const provider = process.env.SMOKE_PROVIDER || process.argv[2] || 'lm-studio';
const model = process.env.SMOKE_MODEL || process.argv[3] || 'mistralai/ministral-3-3b';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || process.argv[4] || 45000);
const autoStopExisting = process.env.SMOKE_AUTO_STOP !== '0';
const smokeConcept = `orchestrator smoke run (${provider})`;
const smokeProjectDir = join(
  homedir(),
  'Builds',
  smokeConcept
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'orchestrator-smoke-run',
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readState(file: string): Record<string, any> | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isSmokeRun(projectDir: string, state: Record<string, any> | null) {
  const concept = String(state?.concept || '').toLowerCase();
  return projectDir.includes('orchestrator-smoke-run') || concept.includes('orchestrator smoke run');
}

function stopExistingSmokeRunIfNeeded() {
  const latestProject = findLatestProject();
  if (!latestProject) return;

  const latestState = readPipelineState(latestProject) as Record<string, any> | null;
  const latestStatus = String(latestState?.pipelineStatus || '');
  if (latestStatus !== 'running') return;
  if (!autoStopExisting) return;
  if (!isSmokeRun(latestProject, latestState)) return;

  console.log(`Stopping existing smoke run at ${latestProject}`);
  stopPipelineRun(latestProject);
}

function resetSmokeProjectDirIfNeeded() {
  if (!autoStopExisting) return;
  if (!existsSync(smokeProjectDir)) return;
  const state = readState(join(smokeProjectDir, 'pipeline-events.json'));
  if (!isSmokeRun(smokeProjectDir, state)) return;
  console.log(`Removing stale smoke project at ${smokeProjectDir}`);
  rmSync(smokeProjectDir, { recursive: true, force: true });
}

async function main() {
  try {
    stopExistingSmokeRunIfNeeded();
    resetSmokeProjectDirIfNeeded();

    const stagingDir = join(homedir(), 'Builds', '.staging');
    console.log('Creating staging session at', stagingDir);
    createStagingSession(stagingDir, { provider, model, concept: smokeConcept });

    console.log('Starting pipeline (production path) — this will spawn the orchestrator');
    let res = startPipelineRun({ model, modelProvider: provider, runGoal: 'plan-only' });
    if (!res.success && /already active/i.test(String(res.error || '')) && autoStopExisting) {
      stopExistingSmokeRunIfNeeded();
      res = startPipelineRun({ model, modelProvider: provider, runGoal: 'plan-only' });
    }

    if (!res.success) {
      const latestProject = findLatestProject();
      const latestState = latestProject ? readPipelineState(latestProject) as Record<string, any> | null : null;
      console.error('startPipelineRun failed:', res.error);
      if (latestProject) {
        console.error('Latest project:', latestProject);
        console.error('Latest status:', latestState?.pipelineStatus || 'unknown');
        console.error('Latest concept:', latestState?.concept || 'unknown');
      }
      process.exit(2);
    }

    const projectDir = res.projectDir;
    console.log('Spawned orchestrator for project:', projectDir);
    const eventsFile = join(projectDir || '.', 'pipeline-events.json');

    const startedAt = Date.now();
    let lastState: Record<string, any> | null = null;

    while (Date.now() - startedAt < timeoutMs) {
      lastState = readState(eventsFile);
      const pipelineStatus = String(lastState?.pipelineStatus || 'unknown');
      const currentPhase = String(lastState?.currentPhase || 'concept');
      const eventCount = Array.isArray(lastState?.events) ? lastState.events.length : 0;
      console.log(`[smoke] status=${pipelineStatus} phase=${currentPhase} events=${eventCount}`);

      if (pipelineStatus === 'paused' || pipelineStatus === 'failed' || pipelineStatus === 'complete') {
        break;
      }

      await sleep(2500);
    }

    const finalState = readState(eventsFile);
    if (!finalState) {
      console.error('Could not read final pipeline state from', eventsFile);
      process.exit(3);
    }

    const events = Array.isArray(finalState.events) ? finalState.events : [];
    const tail = events.slice(-12);
    const failureEvents = events.filter((event: any) => /fetch failed|api call failed|failed|fallback/i.test(String(event?.text || '')));

    console.log('\n=== smoke summary ===');
    console.log(JSON.stringify({
      provider,
      model,
      projectDir,
      pipelineStatus: finalState.pipelineStatus,
      currentPhase: finalState.currentPhase,
      activeAgent: finalState.activeAgent,
      activeTurnStatus: finalState.runtime?.activeTurn?.status,
      activeTurnLastEventAt: finalState.runtime?.activeTurn?.lastEventAt,
      eventCount: events.length,
      failureCount: failureEvents.length,
    }, null, 2));

    console.log('\n=== last events ===');
    for (const event of tail) {
      console.log(`${event.time} [${event.agent}/${event.phase}/${event.type}] ${event.text}`);
    }

    if (failureEvents.length > 0) {
      console.log('\n=== matched failure-like events ===');
      for (const event of failureEvents.slice(-8)) {
        console.log(`${event.time} [${event.agent}/${event.phase}/${event.type}] ${event.text}`);
      }
    }
  } catch (err) {
    console.error('Error during orchestrator smoke run:', err);
    process.exit(1);
  }
}

main();
