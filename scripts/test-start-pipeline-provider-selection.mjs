import assert from 'node:assert/strict';
import os from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function loadControl() {
  const mod = await import('../src/lib/pipeline-control.ts');
  const startPipelineRun = mod.startPipelineRun;
  const readPipelineState = mod.readPipelineState;
  const stopPipelineRun = mod.stopPipelineRun;
  assert.equal(typeof startPipelineRun, 'function', 'startPipelineRun export missing');
  assert.equal(typeof readPipelineState, 'function', 'readPipelineState export missing');
  assert.equal(typeof stopPipelineRun, 'function', 'stopPipelineRun export missing');
  return { startPipelineRun, readPipelineState, stopPipelineRun };
}

function seedStaging() {
  const stagingDir = join(os.homedir(), 'Builds', '.staging');
  mkdirSync(stagingDir, { recursive: true });
  const seed = {
    concept: 'provider selection persistence recheck',
    sessions: { A: 'seed-session-a' },
    model: 'claude-sonnet-4-6',
    provider: 'claude-cli',
    discoveredOnly: false,
  };
  writeFileSync(join(stagingDir, 'pipeline-events.json'), JSON.stringify(seed, null, 2), 'utf8');
}

async function main() {
  const { startPipelineRun, readPipelineState, stopPipelineRun } = await loadControl();

  try {
    stopPipelineRun();
  } catch {
    // ignore
  }

  seedStaging();

  const result = startPipelineRun({
    securityMode: 'fast',
    permissionMode: 'auto',
    runGoal: 'full-build',
    runFinalAudit: false,
    model: 'haiku',
    modelProvider: 'ccr',
    discoveredOnly: true,
  });

  if (!result.success) {
    const msg = String(result.error || '');
    if (msg.includes('already active')) {
      console.log('Pipeline provider/model persistence test skipped (active pipeline lock):', msg);
      return;
    }
    throw new Error(`startPipelineRun failed unexpectedly: ${JSON.stringify(result)}`);
  }

  assert(result.projectDir, 'startPipelineRun should return projectDir on success');
  const state = readPipelineState(result.projectDir);
  assert(state, 'pipeline state should exist after successful startPipelineRun');
  assert.equal(state.selectedProvider, 'ccr', 'selectedProvider was not persisted to pipeline state');
  assert.equal(state.selectedModel, 'haiku', 'selectedModel was not persisted to pipeline state');
  assert.equal(state.discoveredOnly, true, 'discoveredOnly was not persisted to pipeline state');

  try {
    stopPipelineRun();
  } catch {
    // ignore
  }

  console.log('Pipeline provider/model background selection persistence test OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
