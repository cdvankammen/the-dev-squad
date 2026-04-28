#!/usr/bin/env tsx
import { join } from 'path';
import { homedir } from 'os';
import { createStagingSession, startPipelineRun } from '../src/lib/pipeline-control';
import { readFileSync } from 'fs';

async function main() {
  try {
    const stagingDir = join(homedir(), 'Builds', '.staging');
    console.log('Creating staging session at', stagingDir);
    createStagingSession(stagingDir, { provider: 'lm-studio', model: 'test-model', concept: 'orchestrator smoke run' });

    console.log('Starting pipeline (production path) — this will spawn the orchestrator');
    const res = startPipelineRun({ model: 'test-model', modelProvider: 'lm-studio', runGoal: 'plan-only' });
    if (!res.success) {
      console.error('startPipelineRun failed:', res.error);
      process.exit(2);
    }

    const projectDir = res.projectDir;
    console.log('Spawned orchestrator for project:', projectDir);
    const eventsFile = join(projectDir || '.', 'pipeline-events.json');

    // Print initial contents
    console.log('Initial pipeline-events.json:');
    console.log(readFileSync(eventsFile, 'utf8'));
    console.log('\nTail events now (press Ctrl+C to stop)');
    // Tail by polling
    while (true) {
      try {
        const content = readFileSync(eventsFile, 'utf8');
        console.clear();
        console.log(content);
      } catch (err) {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error('Error during orchestrator smoke run:', err);
    process.exit(1);
  }
}

main();
