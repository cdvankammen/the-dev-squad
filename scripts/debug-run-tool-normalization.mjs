#!/usr/bin/env node
import { createRunner } from '../pipeline/runner.ts';
async function main() {
  const runner = createRunner('host');
  const child = runner.spawn({
    prompt: `tool-normalization-lm-studio`,
    model: 'mock-model-v1',
    modelProvider: 'lm-studio',
    projectDir: process.cwd(),
    systemPrompt: 'You are a terse test assistant.',
  });

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  await new Promise((resolve) => child.on('close', resolve));
}

main().catch((err) => { console.error(err); process.exit(1); });
