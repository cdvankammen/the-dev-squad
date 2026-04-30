import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const base = process.env.BASE_URL || 'http://localhost:3004';
const workingDir = '/Users/stillbulldog35/Documents/personalGithub/the-dev-squad';
const concept = 'Build a browser tic tac toe game with HTML, CSS, and JS. Create real files in the project directory and keep everything local.';
const headers = { 'Content-Type': 'application/json' };
const startTime = Date.now();
const timeoutMs = 6 * 60 * 1000;

const metadataFiles = new Set([
  'plan.md',
  'build-plan.md',
  'build-plan-template.md',
  'checklist.md',
  'checklist-template.md',
  'pipeline-events.json',
  'pipeline-approved.json',
  'pipeline-pending.json',
  '.DS_Store',
]);

const expectedArtifacts = ['index.html', 'style.css', 'script.js'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function post(path, body) {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

async function getJson(path) {
  const res = await fetch(`${base}${path}`, { cache: 'no-store' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

function collectArtifacts(rootDir) {
  if (!rootDir || !existsSync(rootDir)) return [];
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['.git', '.claude', '.next', 'node_modules'].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (metadataFiles.has(basename(full))) continue;
      out.push({ path: full, size: statSync(full).size });
    }
  }
  walk(rootDir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const summary = {
  base,
  reset: null,
  concept: null,
  start: null,
  final: null,
  checkpoints: [],
};

summary.reset = await post('/api/reset', {});
summary.concept = await post('/api/chat', {
  agent: 'S',
  message: concept,
  mode: 'pipeline',
  model: 'google/gemma-4-e2b',
  provider: 'lm-studio',
  workingDir,
  securityMode: 'fast',
  permissionMode: 'auto',
  runGoal: 'full-build',
  runFinalAudit: true,
});
summary.start = await post('/api/chat', {
  agent: 'S',
  message: 'start full build',
  mode: 'pipeline',
  model: 'google/gemma-4-e2b',
  provider: 'lm-studio',
  workingDir,
  securityMode: 'fast',
  permissionMode: 'auto',
  runGoal: 'full-build',
  runFinalAudit: true,
});

let lastProjectDir = '';
while (Date.now() - startTime < timeoutMs) {
  const stateRes = await getJson('/api/state?mode=pipeline');
  const state = stateRes.json || {};
  const projectDir = String(state.projectDir || '');
  lastProjectDir = projectDir || lastProjectDir;
  const artifacts = collectArtifacts(projectDir);
  const checkpoint = {
    atSec: Math.round((Date.now() - startTime) / 1000),
    status: state.pipelineStatus || null,
    phase: state.currentPhase || null,
    activeAgent: state.activeAgent || null,
    projectDir: projectDir || null,
    artifactCount: artifacts.length,
    artifactPaths: artifacts.slice(0, 10).map((item) => item.path),
    lastEvents: Array.isArray(state.events) ? state.events.slice(-6) : [],
  };
  summary.checkpoints.push(checkpoint);

  const artifactNames = new Set(artifacts.map((item) => basename(item.path)));
  const hasExpectedArtifacts = expectedArtifacts.every((name) => artifactNames.has(name));

  if (hasExpectedArtifacts) {
    summary.final = {
      result: 'expected-artifacts-created',
      projectDir,
      artifacts,
      state: checkpoint,
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  if (state.pipelineStatus === 'failed') {
    summary.final = {
      result: 'pipeline-failed',
      projectDir,
      artifacts,
      state: checkpoint,
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  await sleep(8000);
}

summary.final = {
  result: 'timeout',
  projectDir: lastProjectDir,
  artifacts: collectArtifacts(lastProjectDir),
  state: summary.checkpoints.at(-1) || null,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(2);
