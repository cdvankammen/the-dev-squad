const base = process.env.BASE_URL || 'http://localhost:3004';
const headers = { 'Content-Type': 'application/json' };

async function readText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function main() {
  const manualPayload = {
    agent: 'A',
    message: 'Reply with a one-sentence acknowledgement that manual mode is working.',
    mode: 'manual',
    model: 'google/gemma-4-e2b',
    provider: 'lm-studio',
    workingDir: '/Users/stillbulldog35/Documents/personalGithub/the-dev-squad',
  };

  const manualRes = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(manualPayload),
  });
  const manualBody = await readText(manualRes);

  const manualStateRes = await fetch(`${base}/api/state?mode=manual`, { cache: 'no-store' });
  const manualState = await manualStateRes.json();

  const saveOpenWebUiRes = await fetch(`${base}/api/provider-config`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'openwebui',
      host: '10.2.0.22',
      port: 8080,
      apiKey: 'sk-89e75a3b0def449f8f3ff5cb68f43022',
    }),
  });
  const saveOpenWebUiBody = await readText(saveOpenWebUiRes);

  const openWebUiModelsRes = await fetch(`${base}/api/models?provider=openwebui`, { cache: 'no-store' });
  const openWebUiModelsBody = await readText(openWebUiModelsRes);

  const ollamaModelsRes = await fetch(`${base}/api/models?provider=ollama`, { cache: 'no-store' });
  const ollamaModelsBody = await readText(ollamaModelsRes);

  console.log(JSON.stringify({
    base,
    manual: {
      status: manualRes.status,
      body: manualBody,
      lastEvents: Array.isArray(manualState?.events) ? manualState.events.slice(-6) : [],
    },
    openwebui: {
      saveStatus: saveOpenWebUiRes.status,
      saveBody: saveOpenWebUiBody,
      modelsStatus: openWebUiModelsRes.status,
      modelsBody: openWebUiModelsBody.slice(0, 1500),
    },
    ollama: {
      modelsStatus: ollamaModelsRes.status,
      modelsBody: ollamaModelsBody.slice(0, 1500),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
