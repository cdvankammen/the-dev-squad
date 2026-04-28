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
import os from 'node:os';

// ── Configuration ───────────────────────────────────────────────────

const MAX_AGENT_TURNS = parseInt(process.env.HTTP_SHIM_MAX_TURNS || '30', 10);
const TOOL_OUTPUT_LIMIT = parseInt(process.env.HTTP_SHIM_TOOL_OUTPUT_LIMIT || '12000', 10);
const BASH_TIMEOUT_MS = parseInt(process.env.HTTP_SHIM_BASH_TIMEOUT_MS || '60000', 10);
const HTTP_REQUEST_TIMEOUT_MS = parseInt(process.env.HTTP_SHIM_REQUEST_TIMEOUT_MS || '120000', 10);
const WEB_TOOL_TIMEOUT_MS = parseInt(process.env.HTTP_SHIM_WEB_TOOL_TIMEOUT_MS || '20000', 10);
const SESSION_DIR = path.join(os.homedir(), '.dev-squad-sessions');
const MAX_SESSION_CHARS = parseInt(process.env.HTTP_SHIM_MAX_SESSION_CHARS || '24000', 10);
const APPROVED_BASH_GRANT_FILE = 'pipeline-approved-bash.json';

// ── Session persistence (enables --resume across orchestrator calls) ────

/**
 * Save the full conversation history to disk so a future --resume call
 * can restore context. This is what enables Agent A→B→C→D→E continuity
 * when using local models via the http-runner-shim.
 */
function saveSession(sessionId, messages) {
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const file = path.join(SESSION_DIR, `${sessionId}.json`);
    fs.writeFileSync(file, JSON.stringify({
      sessionId,
      messages,
      updatedAt: new Date().toISOString(),
      messageCount: messages.length,
    }));
    debug(`Saved session ${sessionId} (${messages.length} messages)`);
  } catch (err) {
    debug(`Failed to save session ${sessionId}: ${err.message}`);
  }
}

/**
 * Load a previously saved session from disk.
 * Returns { sessionId, messages, updatedAt } or null if not found.
 */
function loadSession(sessionId) {
  try {
    const file = path.join(SESSION_DIR, `${sessionId}.json`);
    if (!fs.existsSync(file)) {
      debug(`Session file not found: ${file}`);
      return null;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    debug(`Loaded session ${sessionId} (${data.messages?.length || 0} messages)`);
    return data;
  } catch (err) {
    debug(`Failed to load session ${sessionId}: ${err.message}`);
    return null;
  }
}

/**
 * Trim session context to fit within a model's context window.
 * Keeps the system prompt (first message) + the most recent messages.
 * Drops the oldest non-system messages when total exceeds maxChars.
 */
function trimSessionContext(messages, maxChars = MAX_SESSION_CHARS) {
  const total = messages.reduce((sum, m) => sum + JSON.stringify(m).length, 0);
  if (total <= maxChars) return messages;

  debug(`Session context ${total} chars exceeds limit ${maxChars}, trimming...`);

  // Separate system prompt from conversation
  const system = messages[0]?.role === 'system' ? [messages[0]] : [];
  const rest = messages[0]?.role === 'system' ? messages.slice(1) : [...messages];
  const systemSize = system.reduce((s, m) => s + JSON.stringify(m).length, 0);
  const budget = maxChars - systemSize;

  // Keep messages from the end (most recent first)
  const kept = [];
  let size = 0;
  for (let i = rest.length - 1; i >= 0; i--) {
    const msgSize = JSON.stringify(rest[i]).length;
    if (size + msgSize > budget && kept.length > 0) break;
    kept.unshift(rest[i]);
    size += msgSize;
  }

  const dropped = rest.length - kept.length;
  if (dropped > 0) {
    debug(`Trimmed ${dropped} older messages from session context`);
    kept.unshift({
      role: 'user',
      content: `[System note: ${dropped} earlier messages were trimmed to fit the context window. The conversation continues from the most recent context.]`,
    });
  }

  return [...system, ...kept];
}

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

async function fetchWithTimeout(url, options = {}, timeoutMs = HTTP_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    debug(`POST ${url} (timeout=${timeoutMs}ms)`);
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      throw new Error(`HTTP request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
    resume: '',
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
      case '--resume':
      case '-r':
        parsed.resume = argv[i + 1] || '';
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
  {
    type: 'function',
    function: {
      name: 'WebSearch',
      description: 'Search the public web for current documentation, APIs, library usage, and reference material.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to run.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'WebFetch',
      description: 'Fetch the contents of a public URL for source verification or documentation lookup.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch.' },
        },
        required: ['url'],
      },
    },
  },
];

const KNOWN_TOOL_NAMES = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];

// ── Tool execution ──────────────────────────────────────────────────

function truncateOutput(text, limit = TOOL_OUTPUT_LIMIT) {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2) - 50;
  return `${text.slice(0, half)}\n\n... [truncated ${text.length - limit} chars] ...\n\n${text.slice(-half)}`;
}

// ── Text-based tool calling fallback ────────────────────────────────
// Some small models don't use the function calling API but still try to
// invoke tools by writing them in their text response. This parser
// extracts tool calls from patterns like:
//   Read({"file_path": "src/index.ts"})
//   ```tool_call\n{"name": "Read", "arguments": {"file_path": "..."}}\n```
//   <tool_call>{"name": "Bash", "arguments": {"command": "ls"}}</tool_call>

function parseToolCallsFromText(text) {
  const calls = [];
  if (!text) return calls;

  // Pattern 1: ToolName({"key": "value"})
  // Also tolerate noisy local-model prefixes like [TOOL_CALLS]Read(...) or TOOL_CALLS_Grep(...)
  const funcPattern = /([A-Za-z_\[\]\-:]+)\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
  let match;
  while ((match = funcPattern.exec(text)) !== null) {
    try {
      const toolName = normalizeToolName(match[1]);
      if (!KNOWN_TOOL_NAMES.includes(toolName)) continue;
      const args = JSON.parse(match[2]);
      calls.push({
        id: `text-tool-${crypto.randomUUID()}`,
        function: { name: toolName, arguments: JSON.stringify(args) },
      });
    } catch { /* skip malformed JSON */ }
  }
  if (calls.length > 0) return calls;

  // Pattern 2: ```tool_call\n{...}\n``` or <tool_call>{...}</tool_call>
  const blockPattern = /(?:```tool_call\s*\n([\s\S]*?)\n```|<tool_call>([\s\S]*?)<\/tool_call>)/g;
  while ((match = blockPattern.exec(text)) !== null) {
    try {
      const raw = JSON.parse(match[1] || match[2]);
      const toolName = normalizeToolName(raw.name);
      if (toolName && raw.arguments && KNOWN_TOOL_NAMES.includes(toolName)) {
        calls.push({
          id: `text-tool-${crypto.randomUUID()}`,
          function: {
            name: toolName,
            arguments: typeof raw.arguments === 'string'
              ? raw.arguments
              : JSON.stringify(raw.arguments),
          },
        });
      }
    } catch { /* skip malformed JSON */ }
  }
  if (calls.length > 0) return calls;

  // Pattern 3: JSON object with "tool" or "name" field in the text
  const jsonPattern = /\{[^{}]*"(?:tool|name)"\s*:\s*"([^"]+)"[^{}]*\}/g;
  while ((match = jsonPattern.exec(text)) !== null) {
    try {
      const raw = JSON.parse(match[0]);
      const name = normalizeToolName(raw.tool || raw.name);
      if (!KNOWN_TOOL_NAMES.includes(name)) continue;
      const args = raw.arguments || raw.input || raw.params || {};
      calls.push({
        id: `text-tool-${crypto.randomUUID()}`,
        function: {
          name,
          arguments: typeof args === 'string' ? args : JSON.stringify(args),
        },
      });
    } catch { /* skip */ }
  }

  return calls;
}

function normalizeToolName(name) {
  const raw = String(name || '').trim();
  if (!raw) return raw;

  const cleaned = raw
    .replace(/^\[TOOL_CALLS\]/i, '')
    .replace(/^TOOL_CALLS[_:-]*/i, '')
    .replace(/^\[+|\]+$/g, '')
    .trim();

  const lower = cleaned.toLowerCase();
  if (lower === 'read') return 'Read';
  if (lower === 'write') return 'Write';
  if (lower === 'edit') return 'Edit';
  if (lower === 'bash') return 'Bash';
  if (lower === 'glob') return 'Glob';
  if (lower === 'grep') return 'Grep';
  if (lower === 'websearch') return 'WebSearch';
  if (lower === 'webfetch') return 'WebFetch';

   const canonicalMatch = lower.match(/(^|[^a-z])(read|write|edit|bash|glob|grep|websearch|webfetch)([^a-z]|$)/i);
   if (canonicalMatch?.[2]) {
    const canonical = canonicalMatch[2].toLowerCase();
    if (canonical === 'read') return 'Read';
    if (canonical === 'write') return 'Write';
    if (canonical === 'edit') return 'Edit';
    if (canonical === 'bash') return 'Bash';
    if (canonical === 'glob') return 'Glob';
    if (canonical === 'grep') return 'Grep';
    if (canonical === 'websearch') return 'WebSearch';
    if (canonical === 'webfetch') return 'WebFetch';
   }

  return cleaned;
}

function normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.map((tc) => ({
    ...tc,
    function: {
      ...(tc?.function || {}),
      name: normalizeToolName(tc?.function?.name),
      arguments: tc?.function?.arguments || '{}',
    },
  }));
}

function isKnownToolName(name) {
  return KNOWN_TOOL_NAMES.includes(normalizeToolName(name));
}

function resolvePath(filePath) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

function findPipelineProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'pipeline-events.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir);
}

function readPipelinePhase(projectDir = findPipelineProjectRoot()) {
  try {
    const raw = fs.readFileSync(path.join(projectDir, 'pipeline-events.json'), 'utf8');
    const state = JSON.parse(raw);
    return String(state.currentPhase || 'concept');
  } catch {
    return 'concept';
  }
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getWriteGuardDecision(filePath) {
  const agent = process.env.PIPELINE_AGENT || '';
  const resolved = resolvePath(filePath);

  if (!agent) {
    return { allow: true, resolvedPath: resolved };
  }

  if (!['A', 'B', 'C', 'D', 'E', 'S'].includes(agent)) {
    return { allow: false, resolvedPath: resolved, message: `BLOCKED: Unknown agent identity '${agent}'` };
  }

  const projectDir = findPipelineProjectRoot(process.cwd());
  const normalized = resolved.split(path.sep).join('/').toLowerCase();
  const fileName = path.basename(resolved);

  if (!isPathInside(projectDir, resolved)) {
    return {
      allow: false,
      resolvedPath: resolved,
      message: `BLOCKED: Cannot write to ${resolved} — outside the active pipeline project`,
    };
  }

  if (normalized.includes('/.claude/')) {
    return {
      allow: false,
      resolvedPath: resolved,
      message: 'BLOCKED: Cannot modify hook/settings files under .claude',
    };
  }

  const currentPhase = readPipelinePhase(projectDir);

  switch (agent) {
    case 'A':
      if (currentPhase === 'concept') {
        return {
          allow: false,
          resolvedPath: resolved,
          message: 'BLOCKED: Agent A cannot write during Phase 0',
        };
      }
      if (fileName !== 'plan.md') {
        return {
          allow: false,
          resolvedPath: resolved,
          message: `BLOCKED: Agent A can only write plan.md, not ${fileName}`,
        };
      }
      break;
    case 'B':
      return { allow: false, resolvedPath: resolved, message: 'BLOCKED: Agent B cannot write files' };
    case 'C':
      if (fileName === 'plan.md') {
        return {
          allow: false,
          resolvedPath: resolved,
          message: 'BLOCKED: Agent C cannot modify plan.md — it is locked',
        };
      }
      break;
    case 'D':
      return { allow: false, resolvedPath: resolved, message: 'BLOCKED: Agent D cannot write files' };
    case 'E':
      return { allow: false, resolvedPath: resolved, message: 'BLOCKED: Agent E cannot write files' };
    case 'S':
    default:
      break;
  }

  return { allow: true, resolvedPath: resolved };
}

function approvedBashGrantPath(projectDir = process.cwd()) {
  return path.join(projectDir, APPROVED_BASH_GRANT_FILE);
}

function readApprovedBashGrant(projectDir = process.cwd()) {
  try {
    const file = approvedBashGrantPath(projectDir);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function clearApprovedBashGrant(projectDir = process.cwd(), requestId) {
  try {
    const current = readApprovedBashGrant(projectDir);
    if (!current) return;
    if (requestId && current.requestId !== requestId) return;
    fs.unlinkSync(approvedBashGrantPath(projectDir));
  } catch {
    // ignore
  }
}

function getBashGuardDecision(command) {
  const agent = process.env.PIPELINE_AGENT || '';
  const securityMode = process.env.PIPELINE_SECURITY_MODE || 'fast';

  if (!agent) {
    return { allow: true };
  }

  if (['A', 'B', 'E'].includes(agent)) {
    return {
      allow: false,
      message:
        agent === 'A'
          ? 'BLOCKED: Agent A cannot run Bash commands in pipeline mode.'
          : agent === 'B'
            ? 'BLOCKED: Agent B cannot run Bash commands in pipeline mode.'
            : 'BLOCKED: Agent E cannot run Bash commands in pipeline mode.',
    };
  }

  if (securityMode === 'strict' && (agent === 'C' || agent === 'D')) {
    const grant = readApprovedBashGrant(process.cwd());
    if (!grant) {
      return {
        allow: false,
        message: `Strict mode: Agent ${agent} Bash requires approval before running: ${command}`,
      };
    }

    if (grant.command !== command) {
      return {
        allow: false,
        message: `Strict mode: Agent ${agent} was approved for a different Bash command. Re-request approval for: ${command}`,
      };
    }

    clearApprovedBashGrant(process.cwd(), grant.requestId);
  }

  return { allow: true };
}

function getWebToolDecision(toolName) {
  const agent = process.env.PIPELINE_AGENT || '';

  if (!agent) {
    return { allow: true };
  }

  if (agent === 'A' || agent === 'B') {
    return { allow: true };
  }

  return {
    allow: false,
    message: `BLOCKED: Agent ${agent} cannot use ${toolName}`,
  };
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

async function performWebSearch(query) {
  const decision = getWebToolDecision('WebSearch');
  if (!decision.allow) return { is_error: true, content: decision.message };
  if (!query) return { is_error: true, content: 'WebSearch requires a non-empty query.' };

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'the-dev-squad-http-shim/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  }, WEB_TOOL_TIMEOUT_MS);

  if (!response.ok) {
    return { is_error: true, content: `WebSearch failed with HTTP ${response.status}` };
  }

  const html = await response.text();
  const results = [];
  const anchorPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null && results.length < 5) {
    const href = decodeHtmlEntities(match[1]);
    const title = decodeHtmlEntities(stripHtml(match[2]));
    const nearby = html.slice(match.index, match.index + 1200);
    const snippetMatch = nearby.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      || nearby.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const snippet = decodeHtmlEntities(stripHtml(snippetMatch?.[1] || ''));

    if (title || href) {
      results.push({ title, href, snippet });
    }
  }

  if (results.length === 0) {
    const fallback = stripHtml(html).slice(0, 2000) || 'No search results found.';
    return { is_error: false, content: truncateOutput(`Search results for "${query}":\n\n${fallback}`) };
  }

  const rendered = results.map((result, index) => {
    const lines = [`${index + 1}. ${result.title || '(untitled)'}`, `   ${result.href}`];
    if (result.snippet) lines.push(`   ${result.snippet}`);
    return lines.join('\n');
  }).join('\n\n');

  return { is_error: false, content: truncateOutput(`Search results for "${query}":\n\n${rendered}`) };
}

async function performWebFetch(url) {
  const decision = getWebToolDecision('WebFetch');
  if (!decision.allow) return { is_error: true, content: decision.message };
  if (!url) return { is_error: true, content: 'WebFetch requires a non-empty url.' };

  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'the-dev-squad-http-shim/1.0',
      Accept: 'text/html,application/json,text/plain,*/*',
    },
  }, WEB_TOOL_TIMEOUT_MS);

  const contentType = response.headers.get('content-type') || 'unknown';
  const rawBody = await response.text();
  const body = /html/i.test(contentType) ? stripHtml(rawBody) : rawBody;

  return {
    is_error: !response.ok,
    content: truncateOutput(`URL: ${url}\nStatus: ${response.status} ${response.statusText}\nContent-Type: ${contentType}\n\n${body}`),
  };
}

async function executeTool(name, input) {
  const normalizedName = normalizeToolName(name);
  try {
    switch (normalizedName) {
      case 'Read': {
        const fp = resolvePath(input.file_path);
        if (!fs.existsSync(fp)) return { is_error: true, content: `File not found: ${fp}` };
        const stat = fs.statSync(fp);
        if (stat.isDirectory()) {
          const entries = fs.readdirSync(fp).slice(0, 200);
          const rendered = entries.length > 0
            ? entries.map((entry) => path.join(fp, entry)).join('\n')
            : '(empty directory)';
          return { is_error: false, content: truncateOutput(rendered) };
        }
        const content = fs.readFileSync(fp, 'utf8');
        return { is_error: false, content: truncateOutput(content) };
      }

      case 'Write': {
        const writeGuard = getWriteGuardDecision(input.file_path);
        if (!writeGuard.allow) {
          return { is_error: true, content: writeGuard.message };
        }
        const fp = writeGuard.resolvedPath;
        const dir = path.dirname(fp);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fp, input.content, 'utf8');
        return { is_error: false, content: `Successfully wrote ${input.content.length} chars to ${fp}` };
      }

      case 'Edit': {
        const writeGuard = getWriteGuardDecision(input.file_path);
        if (!writeGuard.allow) {
          return { is_error: true, content: writeGuard.message };
        }
        const fp = writeGuard.resolvedPath;
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
        const guard = getBashGuardDecision(cmd);
        if (!guard.allow) {
          return { is_error: true, content: guard.message };
        }
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

      case 'WebSearch':
        return await performWebSearch(String(input.query || ''));

      case 'WebFetch':
        return await performWebFetch(String(input.url || ''));

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

function appendNormalizedMessage(messages, role, text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;

  const last = messages[messages.length - 1];
  if (last && last.role === role) {
    last.content = `${last.content}\n\n${trimmed}`.trim();
    return;
  }

  messages.push({ role, content: trimmed });
}

function summarizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return '';
  return toolCalls
    .map((tc) => {
      const name = tc?.function?.name || 'Tool';
      const args = tc?.function?.arguments || '{}';
      return `[Tool request: ${name} ${args}]`;
    })
    .join('\n');
}

function normalizeResumeMessages(messages) {
  const normalized = [];

  for (const message of messages || []) {
    if (!message || typeof message !== 'object') continue;

    if (message.role === 'system') {
      if (!normalized.some((entry) => entry.role === 'system')) {
        appendNormalizedMessage(normalized, 'system', toText(message.content));
      }
      continue;
    }

    if (message.role === 'assistant') {
      const assistantText = [
        toText(message.content),
        summarizeToolCalls(message.tool_calls),
      ].filter(Boolean).join('\n\n');
      appendNormalizedMessage(normalized, 'assistant', assistantText);
      continue;
    }

    if (message.role === 'tool') {
      const toolLabel = message.tool_call_id ? `[Tool result ${message.tool_call_id}]` : '[Tool result]';
      appendNormalizedMessage(normalized, 'user', `${toolLabel}\n${toText(message.content)}`);
      continue;
    }

    if (message.role === 'user') {
      appendNormalizedMessage(normalized, 'user', toText(message.content));
    }
  }

  return normalized;
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

  // ── Session resume support ──────────────────────────────────────
  // If --resume SESSION_ID was passed, load the saved conversation history.
  // This enables multi-turn agent continuity across orchestrator calls —
  // Agent A can plan, resume to refine, and Agents B→E get their own
  // persistent sessions too.
  let sessionId;
  let messages = [];
  let resumed = false;

  if (parsed.resume) {
    const saved = loadSession(parsed.resume);
    if (saved?.messages && saved.messages.length > 0) {
      sessionId = parsed.resume;
      messages = trimSessionContext(saved.messages, MAX_SESSION_CHARS);
      if (isLmStudio || isOllama) {
        messages = normalizeResumeMessages(messages);
      }
      resumed = true;
      debug(`Resumed session ${sessionId} with ${messages.length} messages (original: ${saved.messages.length})`);
    } else {
      debug(`Resume requested for ${parsed.resume} but no saved session found — starting fresh`);
      sessionId = parsed.resume; // keep the requested ID even if no history found
    }
  }

  if (!sessionId) {
    sessionId = `http-${crypto.randomUUID()}`;
  }

  emit({ type: 'system', session_id: sessionId });

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Build initial messages (only if NOT resuming with existing history)
  if (!resumed) {
    if (parsed.systemPrompt) {
      const toolInstructions = `

## Available Tools

You have access to these tools to complete your task:
- **Read**: Read file contents. Call with {"file_path": "path/to/file"}
- **Write**: Create or overwrite a file. Call with {"file_path": "path", "content": "..."}
- **Edit**: Replace exact text in a file. Call with {"file_path": "path", "old_string": "...", "new_string": "..."}
- **Bash**: Run a shell command. Call with {"command": "..."}
- **Glob**: Find files by pattern. Call with {"pattern": "src/**/*.ts"}
- **Grep**: Search text in files. Call with {"pattern": "searchTerm", "path": "dir"}
    - **WebSearch**: Search the public web. Call with {"query": "latest lm studio docs"}
    - **WebFetch**: Fetch a public URL. Call with {"url": "https://docs.example.com/page"}

Use these tools to explore the codebase, make changes, and verify your work.
When your task is complete, provide a clear summary of what you did.`;

      messages.push({ role: 'system', content: parsed.systemPrompt + toolInstructions });
    }
  }

  // Always add the new user prompt (this is the new task for this turn)
  appendNormalizedMessage(messages, 'user', parsed.prompt || 'Please respond briefly.');

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
      const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
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
          const retryResponse = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
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

    if (textContent) {
      finalResult = textContent;
    }

    // If no tool calls, we're done (model finished or doesn't support tools)
    // BUT first try to parse tool calls from the text response — some small
    // models write tool calls in their text instead of using function calling.
    let effectiveToolCalls = normalizeToolCalls(toolCalls).filter((tc) => isKnownToolName(tc?.function?.name));
    if ((!toolCalls || toolCalls.length === 0) && textContent && supportsTools) {
      const parsed = parseToolCallsFromText(textContent);
      if (parsed.length > 0) {
        debug(`Parsed ${parsed.length} tool call(s) from text response (text-based fallback)`);
        effectiveToolCalls = normalizeToolCalls(parsed).filter((tc) => isKnownToolName(tc?.function?.name));
      }
    }

    if (!effectiveToolCalls || effectiveToolCalls.length === 0 || !supportsTools) {
      messages.push({
        role: 'assistant',
        content: textContent || '',
      });
      if (textContent) {
        emit({
          type: 'assistant',
          message: {
            id: `msg-${crypto.randomUUID()}`,
            model,
            role: 'assistant',
            content: [{ type: 'text', text: textContent }],
          },
        });
      }
      break;
    }

    // Process tool calls — emit as tool_use events and execute them
    const toolUseBlocks = [];
    const toolResultMessages = [];

    for (const tc of effectiveToolCalls) {
      const toolName = normalizeToolName(tc.function?.name);
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
      const toolResult = await executeTool(toolName, toolInput);

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
      tool_calls: normalizeToolCalls(effectiveToolCalls),
    });

    // Add tool result messages to conversation history
    for (const trm of toolResultMessages) {
      messages.push(trm);
    }

    // Save session after each turn for resume support
    saveSession(sessionId, messages);

    // Check if the model's finish_reason indicates it's done
    if (choice.finish_reason === 'stop') {
      break;
    }
  }

  if (turn >= MAX_AGENT_TURNS) {
    debug(`Reached max turns (${MAX_AGENT_TURNS}), ending agent loop`);
    finalResult += '\n\n[http-runner-shim] Reached maximum turn limit.';
  }

  // Final save of the complete session for future --resume calls
  saveSession(sessionId, messages);

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
