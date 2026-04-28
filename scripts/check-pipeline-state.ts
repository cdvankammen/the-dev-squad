#!/usr/bin/env tsx
import { join } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { createStagingSession, startPipelineRun, loadPipelineState } from '../src/lib/pipeline-control';

async function main() {
  try {
    // Create a temporary project dir under the repo for a staging session
    const tmp = join(process.cwd(), 'tmp-pipeline-check');
    mkdirSync(tmp, { recursive: true });

    console.log('Creating staging session at', tmp);
    createStagingSession(tmp, { provider: 'lm-studio', model: 'test-model', concept: 'verify persistence' });

    console.log('Starting pipeline run (programmatic path) with model/provider...');
    const result = startPipelineRun(tmp, {
      securityMode: 'fast',
      runGoal: 'plan-only',
      model: 'test-model',
      modelProvider: 'lm-studio',
      agentModels: { A: 'test-model', C: 'test-model' },
    });

    if (!result.success) {
      console.error('startPipelineRun failed:', result.error);
      process.exit(2);
    }

    const state = loadPipelineState(tmp);
    if (!state) {
      console.error('Could not read pipeline state at', tmp);
      process.exit(3);
    }

    console.log('\npipeline-events.json content:');
    console.log(JSON.stringify(state, null, 2));

    console.log('\nSelected controls:');
    console.log('selectedModel:', state.selectedModel);
    console.log('selectedProvider:', state.selectedProvider);
    console.log('agentModels:', state.agentModels);

    console.log('\nSuccess — pipeline-events.json contains the persisted selections.');
  } catch (err) {
    console.error('Error during check:', err);
    process.exit(1);
  }
}

main();
