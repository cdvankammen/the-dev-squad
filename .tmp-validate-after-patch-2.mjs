const bases = ['http://localhost:3004', 'http://192.168.1.191:3004'];
for (const base of bases) {
  try {
    const stateRes = await fetch(`${base}/api/state?mode=manual`);
    console.log('state', base, stateRes.status);
  } catch (error) {
    console.log('state', base, 'ERR', error?.message || String(error));
  }
}
const base = 'http://localhost:3004';
const chatRes = await fetch(`${base}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: 'A',
    message: 'Reply with exactly: manual-ui-visible',
    mode: 'manual',
    model: 'google/gemma-4-e2b',
    provider: 'lm-studio',
    workingDir: '/Users/stillbulldog35/Documents/personalGithub/the-dev-squad'
  }),
});
console.log('chat', chatRes.status, await chatRes.text());
const state = await fetch(`${base}/api/state?mode=manual`).then((r) => r.json());
console.log('lastEvents', JSON.stringify((state.events || []).slice(-4), null, 2));
const openwebui = await fetch(`${base}/api/models?provider=openwebui`).then((r) => r.json());
console.log('openwebui', JSON.stringify({ status: openwebui.status, error: openwebui.error, models: openwebui.models?.length || 0 }, null, 2));
const ollama = await fetch(`${base}/api/models?provider=ollama`).then((r) => r.json());
console.log('ollama', JSON.stringify({ status: ollama.status, error: ollama.error, models: ollama.models?.length || 0 }, null, 2));
