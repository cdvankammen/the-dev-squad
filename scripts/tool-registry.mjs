// Central tool registry for the http-runner shim (lightweight, runtime JS)
// Exports: TOOL_DEFINITIONS, TOOL_REGISTRY, KNOWN_TOOL_NAMES,
// normalizeToolName, normalizeToolCalls, isKnownToolName

import crypto from 'node:crypto';

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'Read',
      description: 'Read the contents of a file. Use this to examine source code, configuration, documentation, or any text file.',
      parameters: {
        type: 'object',
        properties: { file_path: { type: 'string', description: 'Absolute or relative path to the file to read.' } },
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
        properties: { command: { type: 'string', description: 'The shell command to execute.' } },
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
        properties: { pattern: { type: 'string', description: 'Glob pattern to match files (e.g., "src/**/*.ts").' } },
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
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'WebFetch',
      description: 'Fetch the contents of a public URL for source verification or documentation lookup.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
];

const registry = {
  Read: { id: 'Read', aliases: ['read', 'file.read', 'read_file', 'readfile'] },
  Write: { id: 'Write', aliases: ['write', 'file.write', 'write_file'] },
  Edit: { id: 'Edit', aliases: ['edit', 'file.edit', 'replace'] },
  Bash: { id: 'Bash', aliases: ['bash', 'sh', 'shell', 'run'] },
  Glob: { id: 'Glob', aliases: ['glob', 'find', 'ls', 'list'] },
  Grep: { id: 'Grep', aliases: ['grep', 'search', 'rg'] },
  WebSearch: { id: 'WebSearch', aliases: ['websearch', 'searchweb', 'web_search'] },
  WebFetch: { id: 'WebFetch', aliases: ['webfetch', 'fetch', 'http_get', 'http-get'] },
};

export const TOOL_REGISTRY = registry;
export const KNOWN_TOOL_NAMES = Object.keys(registry);

function canonicalFromAlias(lower) {
  for (const [k, v] of Object.entries(registry)) {
    if (k.toLowerCase() === lower) return k;
    if (v.aliases && v.aliases.includes(lower)) return k;
  }
  return null;
}

export function normalizeToolName(name) {
  const raw = String(name || '');
  if (!raw) return raw;
  let cleaned = raw.trim();
  // remove common noisy prefixes/suffixes
  cleaned = cleaned.replace(/^[\[\(]*TOOL[_: -]*/i, '');
  cleaned = cleaned.replace(/[^a-zA-Z0-9_\-]/g, '');
  const lower = cleaned.toLowerCase();
  const canonical = canonicalFromAlias(lower);
  if (canonical) return canonical;

  // try to extract an embedded canonical word
  const m = lower.match(/(read|write|edit|bash|glob|grep|websearch|webfetch)/);
  if (m) {
    return Object.keys(registry).find((k) => k.toLowerCase() === m[1]) || cleaned;
  }
  return cleaned;
}

export function isKnownToolName(name) {
  if (!name) return false;
  return KNOWN_TOOL_NAMES.includes(normalizeToolName(name));
}

export function normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.map((tc) => {
    const fn = (tc?.function || tc?.name) ? (tc.function || { name: tc.name, arguments: tc.arguments }) : {};
    const name = normalizeToolName(fn.name || '');
    const args = fn.arguments || tc.args || tc.arguments || '{}';
    return {
      id: tc.id || `tool-${crypto.randomUUID()}`,
      function: {
        name,
        arguments: typeof args === 'string' ? args : JSON.stringify(args),
      },
    };
  });
}

export default {
  TOOL_DEFINITIONS,
  TOOL_REGISTRY,
  KNOWN_TOOL_NAMES,
  normalizeToolName,
  normalizeToolCalls,
  isKnownToolName,
};
