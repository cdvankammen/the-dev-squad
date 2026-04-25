#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}


function readManualEventTexts() {
  const manualStatePath = path.join(os.homedir(), 'Builds', '.manual', 'manual-state.json');
  if (!fs.existsSync(manualStatePath)) return [];
  try {
    const state = JSON.parse(fs.readFileSync(manualStatePath, 'utf8'));
    const events = Array.isArray(state?.events) ? state.events : [];
    return events
      .filter((evt) => evt?.type === 'text' && typeof evt?.text === 'string')
      .map((evt) => evt.text);
  } catch {
    return [];
  }
}


async function startMockServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      const model = payload?.model || 'mock-model';
      const userMessage = Array.isArray(payload?.messages)
        ? payload.messages.find((m) => m?.role === 'user')
        : null;
      const prompt = typeof userMessage?.content === 'string' ? userMessage.content : '';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        model,
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: `mock(${model}):${prompt}`,
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }));
      return;
    }

    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mock-openai-1' }, { id: 'mock-openai-2' }] }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to get mock server address');
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
  };
}

async function postChat(route, payload) {
  const req = {
    async json() {
      return payload;
    },
    url: 'http://localhost/api/chat',
  };
  const res = await route.POST(req);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

async function main() {
  const { server, baseUrl } = await startMockServer();
  process.env.OPENAI_BASE_URL = baseUrl;
  process.env.LM_STUDIO_BASE_URL = baseUrl;
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

  try {
    const route = await import('../src/app/api/chat/route.ts');

    const first = await postChat(route, {
      agent: 'A',
      message: 'hello-openai-1',
      mode: 'manual',
      model: 'mock-openai-1',
      modelProvider: 'openai-http',
    });
    const firstText = String(first.body?.text || '');
    console.log('openai-http first:', first.status, firstText.slice(0, 120));
    assert(first.status === 200, `openai-http first call failed: ${first.status}`);

    const second = await postChat(route, {
      agent: 'A',
      message: 'hello-openai-2',
      mode: 'manual',
      model: 'mock-openai-2',
      modelProvider: 'openai-http',
    });
    const secondText = String(second.body?.text || '');
    console.log('openai-http second:', second.status, secondText.slice(0, 120));
    assert(second.status === 200, `openai-http second call failed: ${second.status}`);

    const third = await postChat(route, {
      agent: 'B',
      message: 'hello-lmstudio-1',
      mode: 'manual',
      model: 'lm-mock-1',
      modelProvider: 'lm-studio',
    });
    const thirdText = String(third.body?.text || '');
    console.log('lm-studio:', third.status, thirdText.slice(0, 120));
    assert(third.status === 200, `lm-studio call failed: ${third.status}`);

    const eventTexts = readManualEventTexts();
    const hasModelAndPrompt = (model, prompt) => eventTexts.some((t) => t.includes(`mock(${model}):`) && t.includes(prompt));
    assert(hasModelAndPrompt('mock-openai-1', 'hello-openai-1'), 'openai-http provider/model was not applied in manual state events');
    assert(hasModelAndPrompt('mock-openai-2', 'hello-openai-2'), 'openai-http second provider/model was not applied in manual state events');
    assert(hasModelAndPrompt('lm-mock-1', 'hello-lmstudio-1'), 'lm-studio provider/model was not applied in manual state events');

    console.log('Manual provider switch + session resume test OK');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('test-chat-manual-provider-switch failed:', err?.stack || err?.message || String(err));
  process.exit(1);
});
