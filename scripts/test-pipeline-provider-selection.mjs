import assert from 'node:assert/strict';
import {
  createStagingSession,
  startPipelineRun,
  loadPipelineState,
  resetPipelineState,
} from '../src/lib/pipeline-control.ts';

async function main() {
  const projectDir = process.cwd();
  await resetPipelineState(projectDir);

  await createStagingSession(projectDir, {
    provider: 'claude-cli',
    model: 'claude-sonnet-4-6',
    discoveredOnly: false,
  });

  const startResult = await startPipelineRun(projectDir, {
    securityMode: 'fast',
    runGoal: 'full-build',
    permissionMode: 'auto',
    runFinalAudit: false,
    model: 'haiku',
    modelProvider: 'ccr',
    discoveredOnly: true,
  });

  assert.equal(startResult.success, true, `startPipelineRun should succeed: ${JSON.stringify(startResult)}`);

  const state = await loadPipelineState(projectDir);
  assert(state, 'pipeline state must exist after start');
  assert.equal(state.selectedProvider, 'ccr', 'selectedProvider was not persisted to pipeline state');
  assert.equal(state.selectedModel, 'haiku', 'selectedModel was not persisted to pipeline state');
  assert.equal(state.discoveredOnly, true, 'discoveredOnly was not persisted to pipeline state');

  console.log('Pipeline provider/model selection persistence test OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
