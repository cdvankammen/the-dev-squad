#!/usr/bin/env node
import http from 'node:http';
import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJsonLines(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

async function startMockServer() {
  let publicBaseUrl = '';
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mock-model-v1' }] }));
      return;
    }

    if (req.method === 'GET' && req.url === '/mock-web-page') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('mock-web-page-ok\nThis page was fetched by WebFetch.');
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

       const hasToolResult = Array.isArray(payload?.messages)
         ? payload.messages.some((m) => m?.role === 'tool')
         : false;

       if (String(promptText).includes('tool-normalization') && !hasToolResult) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'chatcmpl-mock-tool',
            object: 'chat.completion',
            model,
            choices: [
              {
                index: 0,
                finish_reason: 'tool_calls',
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: 'toolcall-1',
                      type: 'function',
                      function: {
                        name: 'TOOL_CALLS_Grep',
                        arguments: JSON.stringify({ pattern: 'mock-response', path: process.cwd() }),
                      },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
          }),
        );
        return;
      }

        if (String(promptText).includes('webfetch-test') && !hasToolResult) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'chatcmpl-mock-webfetch',
              object: 'chat.completion',
              model,
              choices: [
                {
                  index: 0,
                  finish_reason: 'tool_calls',
                  message: {
                    role: 'assistant',
                    content: '',
                    tool_calls: [
                      {
                        id: 'toolcall-webfetch-1',
                        type: 'function',
                        function: {
                          name: 'WebFetch',
                          arguments: JSON.stringify({ url: `${publicBaseUrl}/mock-web-page` }),
                        },
                      },
                    ],
                  },
                },
              ],
              usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
            }),
          );
          return;
        }

      if (hasToolResult) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
          const toolOutput = Array.isArray(payload?.messages)
            ? payload.messages.find((m) => m?.role === 'tool')?.content || ''
            : '';
        res.end(
          JSON.stringify({
            id: 'chatcmpl-mock-tool-finish',
            object: 'chat.completion',
            model,
            choices: [
              {
                index: 0,
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: String(promptText).includes('webfetch-test')
                    ? `webfetch-ok:${String(toolOutput).includes('mock-web-page-ok')}`
                    : 'tool-normalization-ok',
                },
              },
            ],
            usage: { prompt_tokens: 6, completion_tokens: 5, total_tokens: 11 },
          }),
        );
        return;
      }

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
  publicBaseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    server,
    baseUrl: `${publicBaseUrl}/v1`,
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

  const parsedEvents = parseJsonLines(stdout);
  const resultEvent = parsedEvents.find((event) => event.type === 'result');
  assert(resultEvent, `[${provider}] missing result line for session inspection`);
  const sessionId = resultEvent.session_id;
  assert(sessionId, `[${provider}] result event missing session id`);

  const sessionFile = path.join(os.homedir(), '.dev-squad-sessions', `${sessionId}.json`);
  assert(fs.existsSync(sessionFile), `[${provider}] missing saved session file ${sessionFile}`);
  const saved = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  const lastMessage = saved.messages?.[saved.messages.length - 1];
  assert(lastMessage?.role === 'assistant', `[${provider}] expected saved session to end on assistant, got ${lastMessage?.role || 'none'}`);
}

async function runToolNormalization(createRunner, provider) {
  const runner = createRunner('host');
  const child = runner.spawn({
    prompt: `tool-normalization-${provider}`,
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
    console.log(`[${provider}/tool-normalization] stderr:`, stderr.trim());
  }
  console.log(`[${provider}/tool-normalization] exit=${exitCode}`);

  assert(stdout.includes('tool-normalization-ok'), `[${provider}] noisy tool name run did not finish successfully`);
  assert(!stdout.includes('Unknown tool:'), `[${provider}] noisy tool name still hit unknown-tool handling`);

  const parsedEvents = parseJsonLines(stdout);
  const toolUseNames = parsedEvents
    .filter((event) => event.type === 'assistant' && event.message?.content)
    .flatMap((event) => event.message.content)
    .filter((block) => block?.type === 'tool_use')
    .map((block) => block.name);
  assert(toolUseNames.includes('Grep'), `[${provider}] noisy tool name was not normalized into a Grep tool_use block`);
}

async function runWebFetch(createRunner, provider) {
  const runner = createRunner('host');
  const child = runner.spawn({
    prompt: `webfetch-test-${provider}`,
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
    console.log(`[${provider}/webfetch] stderr:`, stderr.trim());
  }
  console.log(`[${provider}/webfetch] exit=${exitCode}`);

  assert(stdout.includes('webfetch-ok:true'), `[${provider}] WebFetch did not return the expected fetched content`);
  assert(!stdout.includes('Unknown tool: WebFetch'), `[${provider}] WebFetch was not recognized by the shim`);
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
    await runToolNormalization(createRunner, 'lm-studio');
    await runWebFetch(createRunner, 'lm-studio');
    console.log('HTTP runner shim integration OK');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('HTTP runner shim test failed:', err?.stack || err?.message || String(err));
  process.exit(1);
});
