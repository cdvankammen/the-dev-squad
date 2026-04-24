#!/usr/bin/env node

/**
 * HTTP Runner Shim
 *
 * Adapts OpenAI-compatible HTTP endpoints (OpenAI, LM Studio, etc.) to a
 * Claude Code-like `--output-format stream-json` stdout stream expected by
 * existing pipeline/chat parsers.
 */

import crypto from 'node:crypto';

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function normalizeBaseUrl(base) {
  if (!base) return 'https://api.openai.com/v1';
  const trimmed = base.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

function parseArgs(argv) {
  const parsed = {
    provider: process.env.MODEL_PROVIDER || 'openai-http',
    prompt: '',
    model: '',
    systemPrompt: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--provider':
        parsed.provider = argv[i + 1] || parsed.provider;
        i += 1;
        break;
      case '-p':
      case '--prompt':
        parsed.prompt = argv[i + 1] || '';
        i += 1;
        break;
      case '--model':
      case '-m':
        parsed.model = argv[i + 1] || '';
        i += 1;
        break;
      case '--system-prompt':
        parsed.systemPrompt = argv[i + 1] || '';
        i += 1;
        break;
      case '--append-system-prompt': {
        const extra = argv[i + 1] || '';
        parsed.systemPrompt = parsed.systemPrompt
          ? `${parsed.systemPrompt}\n${extra}`
          : extra;
        i += 1;
        break;
      }
      default:
        break;
    }
  }

  return parsed;
}

function toText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

async function callOpenAICompatible(parsed) {
  const isLmStudio = parsed.provider === 'lm-studio';
  const baseUrl = normalizeBaseUrl(
    isLmStudio
      ? (process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234/v1')
      : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
  );

  const apiKey = process.env.OPENAI_API_KEY || process.env.LM_STUDIO_API_KEY || '';
  const model =
    parsed.model ||
    process.env.OPENAI_MODEL ||
    process.env.LM_STUDIO_MODEL ||
    (isLmStudio ? 'local-model' : 'gpt-4o-mini');

  const messages = [];
  if (parsed.systemPrompt) {
    messages.push({ role: 'system', content: parsed.systemPrompt });
  }
  messages.push({ role: 'user', content: parsed.prompt || 'Please respond briefly.' });

  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: 0.2,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${raw.slice(0, 600)}`);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON from ${baseUrl}: ${(err && err.message) || String(err)}`);
  }

  const text = toText(payload?.choices?.[0]?.message?.content);
  return {
    model,
    text: text || '[http-runner-shim] Empty response content.',
    usage: payload?.usage,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const sessionId = `http-${crypto.randomUUID()}`;

  emit({ type: 'system', session_id: sessionId });

  try {
    const result = await callOpenAICompatible(parsed);

    emit({
      type: 'assistant',
      message: {
        id: `msg-${crypto.randomUUID()}`,
        model: result.model,
        role: 'assistant',
        content: [{ type: 'text', text: result.text }],
      },
    });

    emit({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: sessionId,
      result: result.text,
      usage: result.usage,
      total_cost_usd: 0,
    });
  } catch (error) {
    const message = `[http-runner-shim error] ${(error && error.message) || String(error)}`;
    process.stderr.write(`${message}\n`);

    emit({
      type: 'assistant',
      message: {
        id: `msg-${crypto.randomUUID()}`,
        model: parsed.model || parsed.provider,
        role: 'assistant',
        content: [{ type: 'text', text: message }],
      },
    });

    emit({
      type: 'result',
      subtype: 'error',
      is_error: true,
      session_id: sessionId,
      result: message,
      total_cost_usd: 0,
    });

    process.exitCode = 1;
  }
}

main();
