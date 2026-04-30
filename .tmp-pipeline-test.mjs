const base = process.env.DEVSQUAD_BASE_URL || 'http://localhost:3004';
const workingDir = '/Users/stillbulldog35/Documents/personalGithub/the-dev-squad';

async function j(path, init) {
  const res = await fetch(`${base}${path}`, init);
  return { status: res.status, text: await res.text() };
}

await j('/api/reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'pipeline' }),
});

const concept = {
  agent: 'S',
  mode: 'pipeline',
  message: 'Build a browser tic tac toe game with HTML, CSS, and JS. Create real files in the project directory and keep everything local.',
  provider: 'lm-studio',
  model: 'google/gemma-4-e2b',
  workingDir,
  securityMode: 'fast',
  permissionMode: 'auto',
  runGoal: 'full-build',
  runFinalAudit: true,
};

console.log('concept', await j('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(concept),
}));

console.log('start', await j('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...concept, message: 'start full build' }),
}));

for (let i = 0; i < 12; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const state = await fetch(`${base}/api/state?mode=pipeline`).then((r) => r.json());
  console.log(JSON.stringify({
    i,
    pipelineStatus: state.pipelineStatus,
    currentPhase: state.currentPhase,
    activeAgent: state.activeAgent,
    selectedProvider: state.selectedProvider,
    selectedModel: state.selectedModel,
    last: (state.events || []).slice(-4),
  }, null, 2));
  if (['failed', 'paused', 'complete', 'completed'].includes(String(state.pipelineStatus || '')) || state.buildComplete === true) {
    process.exit(0);
  }
}
