#!/usr/bin/env node
import process from 'node:process';

function summarizeStdout(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      // ignore non-JSON lines
    }
  }
  const assistant = parsed.find((evt) => evt?.type === 'assistant');
  const result = parsed.find((evt) => evt?.type === 'result');
  return {
    lineCount: lines.length,
    hasAssistant: Boolean(assistant),
    resultSubtype: result?.subtype || null,
    isError: Boolean(result?.is_error),
    resultText: typeof result?.result === 'string' ? result.result.slice(0, 160) : null,
  };
}

async function runProvider(createRunner, provider, model) {
  const runner = createRunner('host');
  const child = runner.spawn({
    prompt: 'Reply with exactly OK and nothing else.',
    model,
    modelProvider: provider,
    projectDir: process.cwd(),
    systemPrompt: 'You are a terse test assistant.',
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await Promise.race([
    new Promise((resolve) => child.on('close', (code) => resolve(code ?? 0))),
    new Promise((resolve) =>
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(-1);
      }, 90_000),
    ),
  ]);

  const summary = summarizeStdout(stdout);
  return {
    provider,
    model,
    exitCode,
    stderr: stderr.trim().slice(0, 300),
    summary,
  };
}

async function main() {
  const { createRunner } = await import('../pipeline/runner.ts');

  const tests = [
    { provider: 'ccr', model: process.env.CCR_TEST_MODEL || 'haiku' },
    { provider: 'occ', model: process.env.OCC_TEST_MODEL || 'claude-sonnet-4-6' },
    { provider: 'openclaude', model: process.env.OPENCLAUDE_TEST_MODEL || 'haiku' },
  ];

  const results = [];
  for (const t of tests) {
    try {
      const result = await runProvider(createRunner, t.provider, t.model);
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const fail = {
        provider: t.provider,
        model: t.model,
        error: error?.message || String(error),
      };
      results.push(fail);
      console.log(JSON.stringify(fail, null, 2));
    }
  }

  const strict = process.argv.includes('--strict');
  const hardFail = results.some((r) => r.exitCode === -1);
  if (hardFail && strict) process.exit(1);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
