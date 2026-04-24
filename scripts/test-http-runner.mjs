#!/usr/bin/env node
import http from 'node:http';
import process from 'node:process';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function startMockServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mock-model-v1' }] }));
      return;
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      const model = payload?.model || 'mock-model-v1';
      const user = Array.isArray(payload?.messages)
        ? payload.messages.find((m) => m?.role === 'user')
        : null;
      const promptText = user?.content || '';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          model,
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: `mock-response:${promptText}`,
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 7, total_tokens: 17 },
        }),
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('failed to bind mock server');
  return {
    server,
    baseUrl: `http://127.0.0.1:${addr.port}/v1`,
  };
}

async function runProvider(createRunner, provider) {
  const runner = createRunner('host');
  const child = runner.spawn({
    prompt: `hello-${provider}`,
    model: 'mock-model-v1',
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

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
  });

  if (stderr.trim()) {
    console.log(`[${provider}] stderr:`, stderr.trim());
  }
  console.log(`[${provider}] exit=${exitCode}`);
  console.log(`[${provider}] stdout sample:`, stdout.trim().split('\n').slice(0, 3).join('\n'));

  assert(stdout.includes('mock-response:hello-'), `[${provider}] missing mock assistant text`);
  assert(stdout.includes('"type":"assistant"'), `[${provider}] missing assistant event`);
  assert(stdout.includes('"type":"result"'), `[${provider}] missing result event`);
}

async function main() {
  const { server, baseUrl } = await startMockServer();
  process.env.OPENAI_BASE_URL = baseUrl;
  process.env.LM_STUDIO_BASE_URL = baseUrl;
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

  try {
    const { createRunner } = await import('../pipeline/runner.ts');
    await runProvider(createRunner, 'openai-http');
    await runProvider(createRunner, 'lm-studio');
    console.log('HTTP runner shim integration OK');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('HTTP runner shim test failed:', err?.stack || err?.message || String(err));
  process.exit(1);
});
