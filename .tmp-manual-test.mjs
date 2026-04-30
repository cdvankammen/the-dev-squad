const base = process.env.DEVSQUAD_BASE_URL || 'http://localhost:3004';
const payload = {
  agent: 'A',
  mode: 'manual',
  message: 'Manual validation ping for A: respond with one short sentence and include A.',
  provider: 'lm-studio',
  model: 'google/gemma-4-e2b',
  workingDir: '/Users/stillbulldog35/Documents/personalGithub/the-dev-squad',
};

const res = await fetch(`${base}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log('chat', res.status, await res.text());

for (let i = 0; i < 12; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const state = await fetch(`${base}/api/state?mode=manual`).then((r) => r.json());
  const tail = (state.events || []).slice(-12);
  const hit = [...tail].reverse().find((e) => e.agent === 'A' && ['text', 'failure', 'status'].includes(e.type));
  if (hit) {
    console.log(JSON.stringify({ hit, tail }, null, 2));
    process.exit(0);
  }
}

console.log('NO_RESPONSE_EVENT');
