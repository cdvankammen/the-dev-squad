/**
 * Central Tool Registry (TypeScript) — canonical names, aliases, helpers
 */
import { randomUUID } from 'node:crypto';

export const TOOL_DEFINITIONS = [
  { name: 'Read' },
  { name: 'Write' },
  { name: 'Edit' },
  { name: 'Bash' },
  { name: 'Glob' },
  { name: 'Grep' },
  { name: 'WebSearch' },
  { name: 'WebFetch' },
];

type RegistryEntry = { id: string; aliases?: string[] };
const registry: Record<string, RegistryEntry> = {
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

function canonicalFromAlias(lower: string): string | null {
  for (const [k, v] of Object.entries(registry)) {
    if (k.toLowerCase() === lower) return k;
    if (v.aliases && v.aliases.includes(lower)) return k;
  }
  return null;
}

export function normalizeToolName(name: unknown): string {
  const raw = String(name || '').trim();
  if (!raw) return raw;
  let cleaned = raw.replace(/^\[+|\]+$/g, '').trim();
  cleaned = cleaned.replace(/^TOOL[_:-]*/i, '').trim();
  cleaned = cleaned.replace(/[^a-zA-Z0-9_\-]/g, '');
  const lower = cleaned.toLowerCase();
  const canonical = canonicalFromAlias(lower);
  if (canonical) return canonical;
  const m = lower.match(/(read|write|edit|bash|glob|grep|websearch|webfetch)/);
  if (m) return Object.keys(registry).find((k) => k.toLowerCase() === m[1]) || cleaned;
  return cleaned;
}

export function isKnownToolName(name: unknown): boolean {
  if (!name) return false;
  return KNOWN_TOOL_NAMES.includes(normalizeToolName(name));
}

export function normalizeToolCalls(toolCalls: any[]): any[] {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.map((tc) => {
    const fn = (tc?.function || tc?.name) ? (tc.function || { name: tc.name, arguments: tc.arguments }) : {};
    const name = normalizeToolName(fn.name || '');
    const args = fn.arguments || tc.args || tc.arguments || '{}';
    return {
      id: tc.id || `tool-${randomUUID()}`,
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
