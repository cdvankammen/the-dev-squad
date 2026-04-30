import fs from 'node:fs';

const base = process.env.DEVSQUAD_BASE_URL || 'http://localhost:3004';
const workingDir = process.env.DEVSQUAD_WORKDIR || '/Users/stillbulldog35/Documents/personalGithub/the-dev-squad';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path, init) {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
}

function parseIso(value) {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : 0;
}

async function validateCoreEndpoints() {
  const paths = ['/api/health', '/api/state?mode=pipeline', '/api/state?mode=manual', '/api/providers', '/api/mcp'];
  const out = [];
  for (const path of paths) {
    const r = await fetchJson(path);
    out.push({ path, status: r.status, preview: r.text.slice(0, 220) });
  }
  return out;
}

async function validateProviders() {
  const providersRes = await fetchJson('/api/providers');
  const providers = Array.isArray(providersRes.json?.providers) ? providersRes.json.providers : [];
  const matrix = [];
  for (const p of providers) {
    const id = String(p.id || '');
    const modelRes = await fetchJson(`/api/models?provider=${encodeURIComponent(id)}`);
    matrix.push({
      provider: id,
      status: modelRes.status,
      models: Array.isArray(modelRes.json?.models) ? modelRes.json.models.length : -1,
      error: modelRes.json?.error || null,
    });
  }
  return matrix;
}

async function validateManualBots() {
  const bots = ['S', 'A', 'B', 'C', 'D', 'E'];
  const results = [];

  for (const agent of bots) {
    const requestTime = Date.now();
    const payload = {
      agent,
      mode: 'manual',
      message: `Manual validation ping for ${agent}: respond with one short sentence and include ${agent}.`,
      provider: 'lm-studio',
      model: 'google/gemma-4-e2b',
      workingDir,
    };

    const chatRes = await fetchJson('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let gotResponseEvent = false;
    let responseSnippet = '';

    for (let i = 0; i < 22; i += 1) {
      await sleep(2000);
      const stateRes = await fetchJson('/api/state?mode=manual');
      const events = Array.isArray(stateRes.json?.events) ? stateRes.json.events : [];
      const found = [...events].reverse().find((e) =>
        String(e?.agent || '') === agent &&
        parseIso(e?.time) >= requestTime &&
        ['text', 'status', 'failure'].includes(String(e?.type || ''))
      );
      if (found) {
        gotResponseEvent = true;
        responseSnippet = String(found.text || '').slice(0, 160);
        break;
      }
    }

    results.push({
      agent,
      chatStatus: chatRes.status,
      accepted: chatRes.status === 200,
      gotResponseEvent,
      responseSnippet,
      responsePreview: chatRes.text.slice(0, 160),
    });
  }

  return results;
}

async function runTicTacToePipeline() {
  const resetRes = await fetchJson('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'pipeline' }),
  });

  const conceptPayload = {
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

  const conceptRes = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(conceptPayload),
  });

  const startRes = await fetchJson('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...conceptPayload, message: 'start full build' }),
  });

  let finalState = null;
  const timeline = [];
  for (let i = 0; i < 96; i += 1) {
    await sleep(5000);
    const stateRes = await fetchJson('/api/state?mode=pipeline');
    const s = stateRes.json || {};
    const marker = `${s.pipelineStatus}|${s.currentPhase}|${s.activeAgent || '-'}`;
    if (!timeline.length || timeline[timeline.length - 1] !== marker) {
      timeline.push(marker);
    }

    const terminal = s.pipelineStatus === 'failed' || s.pipelineStatus === 'completed' || s.buildComplete === true || s.pipelineStatus === 'paused';
    if (terminal) {
      finalState = s;
      break;
    }
  }

  if (!finalState) {
    const stateRes = await fetchJson('/api/state?mode=pipeline');
    finalState = stateRes.json || {};
  }

  const projectDir = String(finalState.projectDir || '');
  const files = {
    plan: projectDir ? fs.existsSync(`${projectDir}/plan.md`) : false,
    index: projectDir ? fs.existsSync(`${projectDir}/index.html`) : false,
    style: projectDir ? fs.existsSync(`${projectDir}/style.css`) : false,
    script: projectDir ? fs.existsSync(`${projectDir}/script.js`) : false,
  };

  const events = Array.isArray(finalState.events) ? finalState.events : [];
  const tail = events.slice(-12);

  return {
    resetStatus: resetRes.status,
    conceptStatus: conceptRes.status,
    startStatus: startRes.status,
    final: {
      pipelineStatus: finalState.pipelineStatus,
      currentPhase: finalState.currentPhase,
      activeAgent: finalState.activeAgent,
      selectedProvider: finalState.selectedProvider,
      selectedModel: finalState.selectedModel,
      requestedWorkingDir: finalState.requestedWorkingDir,
      projectDir,
      fileChecks: files,
    },
    timeline,
    eventsTail: tail,
  };
}

async function validateMcpCalls() {
  const payloads = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'devsquad.pipeline_state', arguments: { mode: 'pipeline' } },
    },
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'devsquad.supervisor_message',
        arguments: {
          mode: 'manual',
          message: 'MCP validation ping: acknowledge supervisor channel is active.',
          provider: 'lm-studio',
          model: 'google/gemma-4-e2b',
          workingDir,
        },
      },
    },
  ];

  const out = [];
  for (const p of payloads) {
    const r = await fetchJson('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    out.push({ id: p.id, method: p.method, status: r.status, preview: r.text.slice(0, 240) });
  }
  return out;
}

async function main() {
  const summary = {
    base,
    startedAt: new Date().toISOString(),
    endpointChecks: await validateCoreEndpoints(),
    providerMatrix: await validateProviders(),
    mcpChecks: await validateMcpCalls(),
    manualBotChecks: await validateManualBots(),
    tictactoePipeline: await runTicTacToePipeline(),
    finishedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
