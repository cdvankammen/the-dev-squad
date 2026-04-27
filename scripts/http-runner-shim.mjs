#!/usr/bin/env node

/**
 * HTTP Runner Shim — Multi-Turn Agent Loop
 *
 * Adapts OpenAI-compatible HTTP endpoints (Ollama, LM Studio, OpenAI, etc.)
 * to a Claude Code-like `--output-format stream-json` stdout stream expected
 * by the pipeline orchestrator.
 *
 * v2: Supports multi-turn agentic execution with tool calling (function
 * calling via the OpenAI chat completions API). This allows local models to
 * drive the full 5-agent pipeline (A→B→C→D→E) just like Claude Code CLI
 * does — reading files, writing files, editing code, and running shell
 * commands autonomously.
 *
 * Fallback: When the model does NOT support function calling (or the
 * provider returns a plain text response), the shim gracefully falls back
 * to single-shot mode — exactly as the v1 shim worked.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';

// ── Configuration ───────────────────────────────────────────────────

const MAX_AGENT_TURNS = parseInt(process.env.HTTP_SHIM_MAX_TURNS || '30', 10);
const TOOL_OUTPUT_LIMIT = parseInt(process.env.HTTP_SHIM_TOOL_OUTPUT_LIMIT || '12000', 10);
const BASH_TIMEOUT_MS = parseInt(process.env.HTTP_SHIM_BASH_TIMEOUT_MS || '60000', 10);

// ── Emit stream-json events (orchestrator-compatible) ───────────────

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function debug(msg) {
  if (process.env.HTTP_SHIM_DEBUG === '1') {
    process.stderr.write(`[http-shim-debug] ${msg}\n`);
  }
}

// ── URL helpers ─────────────────────────────────────────────────────

function normalizeBaseUrl(base) {
  if (!base) return 'https://api.openai.com/v1';
  const trimmed = base.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

// ── Arg parsing (supports all flags buildClaudeArgs emits) ──────────

function parseArgs(argv) {
  const parsed = {
    provider: process.env.MODEL_PROVIDER || 'openai-http',
    prompt: '',
    model: '',
    systemPrompt: '',
    systemPromptFile: '',
    effort: '',
    outputFormat: '',
    verbose: false,
    permissionMode: '',
    jsonSchema: null,
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
      case '--system-prompt-file':
        parsed.systemPromptFile = argv[i + 1] || '';
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
      case '--effort':
        parsed.effort = argv[i + 1] || '';
        i += 1;
        break;
      case '--output-format':
        parsed.outputFormat = argv[i + 1] || '';
        i += 1;
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      case '--permission-mode':
      case '--dangerously-skip-permissions':
        if (a === '--dangerously-skip-permissions') {
          parsed.permissionMode = 'dangerously-skip-permissions';
        } else {
          parsed.permissionMode = argv[i + 1] || '';
          i += 1;
        }
        break;
      case '--json-schema':
        try { parsed.jsonSchema = JSON.parse(argv[i + 1] || '{}'); } catch { /* ignore */ }
        i += 1;
        break;
      default:
        break;
    }
  }

  // Load system prompt from file if --system-prompt-file was provided
  if (parsed.systemPromptFile && !parsed.systemPrompt) {
    try {
      parsed.systemPrompt = fs.readFileSync(parsed.systemPromptFile, 'utf8').trim();
      debug(`Loaded system prompt from ${parsed.systemPromptFile} (${parsed.systemPrompt.length} chars)`);
    } catch (err) {
      debug(`Failed to read system prompt file ${parsed.systemPromptFile}: ${err.message}`);
    }
  }

  return parsed;
}

// ── Tool definitions (OpenAI function calling format) ───────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'Read',
      description: 'Read the contents of a file. Use this to examine source code, configuration, documentation, or any text file.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute or relative path to the file to read.' },
        },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Write',
      description: 'Write content to a file, creating it if necessary. Use this to create new files or completely replace existing file content.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file to write.' },
          content: { type: 'string', description: 'The full content to write to the file.' },
        },
        required: ['file_path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Edit',
      description: 'Make a targeted edit to a file by replacing an exact string with a new string. The old_string must match exactly (including whitespace).',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file to edit.' },
          old_string: { type: 'string', description: 'The exact text to find and replace.' },
          new_string: { type: 'string', description: 'The replacement text.' },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Bash',
      description: 'Run a shell command. Use this for installing packages, running tests, checking file structure, git operations, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute.' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Glob',
      description: 'Find files matching a glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to match files (e.g., "src/**/*.ts").' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Grep',
      description: 'Search for a pattern in files.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'The text or regex pattern to search for.' },
          path: { type: 'string', description: 'Directory or file path to search in. Defaults to current directory.' },
        },
        required: ['pattern'],
      },
    },
  },
];

// ── Tool execution ──────────────────────────────────────────────────

function truncateOutput(text, limit = TOOL_OUTPUT_LIMIT) {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2) - 50;
  return `${text.slice(0, half)}\n\n... [truncated ${text.length - limit} chars] ...\n\n${text.slice(-half)}`;
}

function resolvePath(filePath) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

function executeTool(name, input) {
  try {
    switch (name) {
      case 'Read': {
        const fp = resolvePath(input.file_path);
        if (!fs.existsSync(fp)) return { is_error: true, content: `File not found: ${fp}` };
        const content = fs.readFileSync(fp, 'utf8');
        return { is_error: false, content: truncateOutput(content) };
      }

      case 'Write': {
        const fp = resolvePath(input.file_path);
        const dir = path.dirname(fp);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fp, input.content, 'utf8');
        return { is_error: false, content: `Successfully wrote ${input.content.length} chars to ${fp}` };
      }

      case 'Edit': {
        const fp = resolvePath(input.file_path);
        if (!fs.existsSync(fp)) return { is_error: true, content: `File not found: ${fp}` };
        const existing = fs.readFileSync(fp, 'utf8');
        if (!existing.includes(input.old_string)) {
          return { is_error: true, content: `old_string not found in ${fp}. Make sure it matches exactly.` };
        }
        const count = existing.split(input.old_string).length - 1;
        if (count > 1) {
          return { is_error: true, content: `old_string matches ${count} locations in ${fp}. It must match exactly once. Add more context to make it unique.` };
        }
        const updated = existing.replace(input.old_string, input.new_string);
        fs.writeFileSync(fp, updated, 'utf8');
        return { is_error: false, content: `Successfully edited ${fp}` };
      }

      case 'Bash': {
        const cmd = input.command;
        try {
          const output = execSync(cmd, {
            cwd: process.cwd(),
            encoding: 'utf8',
            timeout: BASH_TIMEOUT_MS,
            maxBuffer: 1024 * 1024 * 10,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return { is_error: false, content: truncateOutput(output || '(no output)') };
        } catch (err) {
          const stderr = err.stderr ? err.stderr.toString() : '';
          const stdout = err.stdout ? err.stdout.toString() : '';
          const combined = `Exit code: ${err.status || 1}\n${stdout}\n${stderr}`.trim();
          return { is_error: true, content: truncateOutput(combined) };
        }
      }

      case 'Glob': {
        const pattern = input.pattern;
        try {
          // Use find or ls with glob — cross-platform approach
          const cmd = process.platform === 'win32'
            ? `dir /s /b "${pattern}"`
            : `find . -path "./${pattern}" -o -name "${pattern}" 2>/dev/null | head -200`;
          const output = execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
          return { is_error: false, content: truncateOutput(output || '(no matches)') };
        } catch {
          return { is_error: false, content: '(no matches)' };
        }
      }

      case 'Grep': {
        const searchPath = input.path ? resolvePath(input.path) : process.cwd();
        try {
          const cmd = `grep -rn --include='*' "${input.pattern.replace(/"/g, '\\"')}" "${searchPath}" 2>/dev/null | head -100`;
          const output = execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
          return { is_error: false, content: truncateOutput(output || '(no matches)') };
        } catch {
          return { is_error: false, content: '(no matches)' };
        }
      }

      default:
        return { is_error: true, content: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { is_error: true, content: `Tool execution error: ${err.message || String(err)}` };
  }
}

// ── Content helpers ─────────────────────────────────────────────────

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

// ── Multi-turn agent loop ───────────────────────────────────────────

async function agentLoop(parsed) {
  const isLmStudio = parsed.provider === 'lm-studio';
  const isOllama = parsed.provider === 'ollama';
  const baseUrl = normalizeBaseUrl(
    isLmStudio
      ? (process.env.LM_STUDIO_BASE_URL || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234/v1')
      : isOllama
        ? (process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1')
        : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
  );

  const apiKey = process.env.OPENAI_API_KEY || process.env.LM_STUDIO_API_KEY || '';
  const model =
    parsed.model ||
    process.env.OPENAI_MODEL ||
    process.env.LM_STUDIO_MODEL ||
    (isLmStudio ? 'local-model' : isOllama ? 'llama3.2' : 'gpt-4o-mini');

  const sessionId = `http-${crypto.randomUUID()}`;
  emit({ type: 'system', session_id: sessionId });

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Build initial messages
  const messages = [];

  if (parsed.systemPrompt) {
    // Enhance system prompt with tool-usage instructions for local models
    const toolInstructions = `

## Available Tools

You have access to these tools to complete your task:
- **Read**: Read file contents. Call with {"file_path": "path/to/file"}
- **Write**: Create or overwrite a file. Call with {"file_path": "path", "content": "..."}
- **Edit**: Replace exact text in a file. Call with {"file_path": "path", "old_string": "...", "new_string": "..."}
- **Bash**: Run a shell command. Call with {"command": "..."}
- **Glob**: Find files by pattern. Call with {"pattern": "src/**/*.ts"}
- **Grep**: Search text in files. Call with {"pattern": "searchTerm", "path": "dir"}

Use these tools to explore the codebase, make changes, and verify your work.
When your task is complete, provide a clear summary of what you did.`;

    messages.push({ role: 'system', content: parsed.systemPrompt + toolInstructions });
  }

  messages.push({ role: 'user', content: parsed.prompt || 'Please respond briefly.' });

  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let finalResult = '';
  let turn = 0;

  // Detect if the provider supports tool calling by trying the first request
  // with tools. If it fails or returns no tool_calls, we fall back to
  // single-shot mode.
  let supportsTools = true;

  while (turn < MAX_AGENT_TURNS) {
    turn += 1;
    debug(`Turn ${turn}/${MAX_AGENT_TURNS}`);

    const requestBody = {
      model,
      messages,
      stream: false,
      temperature: 0.2,
    };

    // Include tool definitions if the provider supports them
    if (supportsTools) {
      requestBody.tools = TOOL_DEFINITIONS;
      requestBody.tool_choice = 'auto';
    }

    let payload;
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const raw = await response.text();
      if (!response.ok) {
        // If tools caused a failure, retry without tools (single-shot fallback)
        if (supportsTools && (response.status === 400 || response.status === 422)) {
          debug('Provider rejected tool definitions — falling back to single-shot mode');
          supportsTools = false;
          delete requestBody.tools;
          delete requestBody.tool_choice;
          const retryResponse = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
          });
          const retryRaw = await retryResponse.text();
          if (!retryResponse.ok) {
            throw new Error(`HTTP ${retryResponse.status}: ${retryRaw.slice(0, 600)}`);
          }
          payload = JSON.parse(retryRaw);
        } else {
          throw new Error(`HTTP ${response.status}: ${raw.slice(0, 600)}`);
        }
      } else {
        payload = JSON.parse(raw);
      }
    } catch (err) {
      throw new Error(`API call failed: ${err.message || String(err)}`);
    }

    // Accumulate usage
    if (payload?.usage) {
      totalUsage.prompt_tokens += payload.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += payload.usage.completion_tokens || 0;
      totalUsage.total_tokens += payload.usage.total_tokens || 0;
    }

    const choice = payload?.choices?.[0];
    if (!choice) {
      throw new Error('No choice in API response');
    }

    const message = choice.message;
    const toolCalls = message?.tool_calls;
    const textContent = message?.content || '';

    // Emit any text content as an assistant message
    if (textContent) {
      const contentBlocks = [{ type: 'text', text: textContent }];

      emit({
        type: 'assistant',
        message: {
          id: `msg-${crypto.randomUUID()}`,
          model,
          role: 'assistant',
          content: contentBlocks,
        },
      });

      finalResult = textContent;
    }

    // If no tool calls, we're done (model finished or doesn't support tools)
    if (!toolCalls || toolCalls.length === 0 || !supportsTools) {
      break;
    }

    // Process tool calls — emit as tool_use events and execute them
    const toolUseBlocks = [];
    const toolResultMessages = [];

    for (const tc of toolCalls) {
      const toolName = tc.function?.name;
      let toolInput;
      try {
        toolInput = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        toolInput = {};
      }
      const toolUseId = tc.id || `tool-${crypto.randomUUID()}`;

      // Emit tool_use event (orchestrator sees this)
      toolUseBlocks.push({
        type: 'tool_use',
        id: toolUseId,
        name: toolName,
        input: toolInput,
      });

      // Execute the tool
      debug(`Executing tool: ${toolName}(${JSON.stringify(toolInput).slice(0, 200)})`);
      const toolResult = executeTool(toolName, toolInput);

      // Emit tool_result event as a user message (orchestrator expects this)
      emit({
        type: 'user',
        message: {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: toolResult.content,
            is_error: toolResult.is_error,
          }],
        },
      });

      // Build the tool result message for the next API call
      toolResultMessages.push({
        role: 'tool',
        tool_call_id: toolUseId,
        content: toolResult.content,
      });
    }

    // Emit the assistant message with tool_use blocks
    if (toolUseBlocks.length > 0) {
      const contentBlocks = [];
      if (textContent) contentBlocks.push({ type: 'text', text: textContent });
      contentBlocks.push(...toolUseBlocks);

      emit({
        type: 'assistant',
        message: {
          id: `msg-${crypto.randomUUID()}`,
          model,
          role: 'assistant',
          content: contentBlocks,
        },
      });
    }

    // Add assistant message (with tool_calls) to conversation history
    messages.push({
      role: 'assistant',
      content: textContent || null,
      tool_calls: toolCalls,
    });

    // Add tool result messages to conversation history
    for (const trm of toolResultMessages) {
      messages.push(trm);
    }

    // Check if the model's finish_reason indicates it's done
    if (choice.finish_reason === 'stop') {
      break;
    }
  }

  if (turn >= MAX_AGENT_TURNS) {
    debug(`Reached max turns (${MAX_AGENT_TURNS}), ending agent loop`);
    finalResult += '\n\n[http-runner-shim] Reached maximum turn limit.';
  }

  // Emit final result event
  emit({
    type: 'result',
    subtype: 'success',
    is_error: false,
    session_id: sessionId,
    result: finalResult,
    usage: {
      input_tokens: totalUsage.prompt_tokens,
      output_tokens: totalUsage.completion_tokens,
    },
    total_cost_usd: 0,
  });

  return { model, sessionId, finalResult, usage: totalUsage };
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  try {
    await agentLoop(parsed);
  } catch (error) {
    const sessionId = `http-${crypto.randomUUID()}`;
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
