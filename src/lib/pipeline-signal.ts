function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function tryParseJsonString(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) && typeof parsed.status === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function extractBalancedStatusJson(text: string): string | null {
  const statusIndex = text.indexOf('"status"');
  if (statusIndex === -1) return null;

  const start = text.lastIndexOf('{', statusIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function parseSignalString(text: string, depth: number): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const direct = tryParseJsonString(trimmed);
  if (direct) return direct;

  const fenceMatches = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/gi) || [];
  for (const block of fenceMatches) {
    const inner = block.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const parsed = parseStructuredSignal(inner, depth + 1);
    if (parsed) return parsed;
  }

  const balanced = extractBalancedStatusJson(trimmed);
  if (balanced) {
    const parsed = tryParseJsonString(balanced);
    if (parsed) return parsed;
  }

  return null;
}

function looksLikeSignalRecord(value: Record<string, unknown>): boolean {
  return typeof value.status === 'string' && value.status.length > 0;
}

const WRAPPER_KEYS = ['structured_output', 'input', 'output', 'data', 'content', 'text', 'json', 'value'];

export function parseStructuredSignal(value: unknown, depth: number = 0): Record<string, unknown> | null {
  if (depth > 6 || value == null) return null;

  if (typeof value === 'string') {
    return parseSignalString(value, depth);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseStructuredSignal(item, depth + 1);
      if (parsed) return parsed;
    }
    return null;
  }

  if (!isRecord(value)) return null;
  if (looksLikeSignalRecord(value)) return value;

  for (const key of WRAPPER_KEYS) {
    if (!(key in value)) continue;
    const parsed = parseStructuredSignal(value[key], depth + 1);
    if (parsed) return parsed;
  }

  for (const nested of Object.values(value)) {
    if (nested !== null && (typeof nested === 'object' || typeof nested === 'string')) {
      const parsed = parseStructuredSignal(nested, depth + 1);
      if (parsed) return parsed;
    }
  }

  return null;
}

export function extractStructuredSignal(...candidates: unknown[]): Record<string, unknown> | null {
  for (const candidate of candidates) {
    const parsed = parseStructuredSignal(candidate);
    if (parsed) return parsed;
  }
  return null;
}
