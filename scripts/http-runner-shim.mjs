#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('-')) continue;
    const key = arg.replace(/^--?/, '');
    const next = argv[i + 1];
    if (!next || next.startsWith('-')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function stripTrailingApiPath(baseUrl) {
  return String(baseUrl || '')
    .replace(/\/(?:v1|api(?:\/v1)?)\/?$/, '')
    .replace(/\/$/, '');
}

function pickBaseUrl(provider) {
  if (provider === 'lm-studio') return process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234';
  if (provider === 'ollama') return process.env.OLLAMA_BASE_URL || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434';
  if (provider === 'openwebui') return process.env.OPENWEBUI_BASE_URL || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:8080';
  return process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234';
}

function pickApiKey(provider) {
  if (provider === 'openwebui') return process.env.OPENWEBUI_API_KEY || process.env.OPENAI_API_KEY || '';
  return process.env.OPENAI_API_KEY || process.env.LM_STUDIO_API_KEY || process.env.OLLAMA_API_KEY || '';
}

function pickEndpointCandidates(provider, baseUrl) {
  const root = stripTrailingApiPath(baseUrl);
  if (provider === 'openwebui') {
    return [
      `${root}/api/chat/completions`,
      `${root}/v1/chat/completions`,
      `${root}/api/v1/chat/completions`,
    ];
  }
  return [
    `${root}/v1/chat/completions`,
    `${root}/api/chat/completions`,
    `${root}/api/v1/chat/completions`,
  ];
}

function textFromResponse(data) {
  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((block) => (typeof block?.text === 'string' ? block.text : '')).join('');
  }
  if (typeof choice.text === 'string') return choice.text;
  return '';
}

function structuredFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function maybeWritePlanFile(prompt, text) {
  const promptLower = String(prompt || '').toLowerCase();
  if (!promptLower.includes('plan.md') && !promptLower.includes('write the plan') && !promptLower.includes('planner')) return;
  try {
    const target = join(process.cwd(), 'plan.md');
    const content = `# Plan\n\n${String(text || '').trim()}\n`;
    writeFileSync(target, content, 'utf8');
  } catch {
    // non-fatal: the orchestrator will surface the missing file if we can't write it
  }
}

function readPrompt(args) {
  if (typeof args.p === 'string') return args.p;
  if (typeof args.prompt === 'string') return args.prompt;
  return '';
}

function readSystemPrompt(args) {
  if (typeof args['system-prompt'] === 'string') return args['system-prompt'];
  if (typeof args['system-prompt-file'] === 'string') {
    try {
      return readFileSync(args['system-prompt-file'], 'utf8');
    } catch {
      return '';
    }
  }
  return '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const provider = String(args.provider || process.env.MODEL_PROVIDER || 'openai-compat');
  const model = String(args.model || process.env.MODEL || '');
  const prompt = readPrompt(args);
  const systemPrompt = readSystemPrompt(args);
  const resume = String(args.resume || args.session || '');
  const sessionId = resume || randomUUID();
  const baseUrl = pickBaseUrl(provider);
  const apiKey = pickApiKey(provider);
  const endpoints = pickEndpointCandidates(provider, baseUrl);

  if (!model) {
    throw new Error(`Missing --model for provider '${provider}'`);
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    temperature: 0.2,
    stream: false,
  };

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        lastError = new Error(`${provider} chat request failed at ${endpoint}: HTTP ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const text = textFromResponse(data);
      const structured = structuredFromText(text);

      maybeWritePlanFile(prompt, text);

      process.stdout.write(JSON.stringify({ type: 'system', session_id: sessionId }) + '\n');
      process.stdout.write(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }) + '\n');
      process.stdout.write(JSON.stringify({
        type: 'result',
        session_id: sessionId,
        result: text,
        structured_output: structured,
        usage: {
          input_tokens: data?.usage?.prompt_tokens || 0,
          output_tokens: data?.usage?.completion_tokens || 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        total_cost_usd: 0,
      }) + '\n');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error(`Unable to contact provider '${provider}'`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});