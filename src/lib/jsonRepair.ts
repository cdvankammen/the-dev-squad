/**
 * Simple JSON repair utilities for the-dev-squad
 * Aim: deterministically repair common JSON mistakes from LLM output.
 */
// This file is a TypeScript port of the scripts/json-repair.mjs utilities.
// It provides robust, heuristic-driven JSON extraction and repair helpers
// used across the the-dev-squad codebase to normalize LLM outputs.

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '');
}

function stripWholeWrapper(text: string | null | undefined): string {
  let value = stripBom(String(text ?? '')).trim();
  const fenced = value.match(/^```(?:json|tool_call|tool_calls|javascript|js)?\s*([\s\S]*?)```$/i);
  if (fenced) value = fenced[1].trim();
  const tagged = value.match(/^<(?:tool_call|tool_calls|tool|json)[^>]*>([\s\S]*?)<\/(?:tool_call|tool_calls|tool|json)>$/i);
  if (tagged) value = tagged[1].trim();
  return value;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function extractCodeFenceContents(text: string): string[] {
  const blocks: string[] = [];
  const pattern = /```(?:json|tool_call|tool_calls|javascript|js)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(String(text ?? ''))) !== null) {
    blocks.push(match[1].trim());
  }
  return dedupeStrings(blocks);
}

export function extractTagContents(text: string): string[] {
  const blocks: string[] = [];
  const pattern = /<(tool_call|tool_calls|tool|json)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(String(text ?? ''))) !== null) {
    blocks.push(match[2].trim());
  }
  return dedupeStrings(blocks);
}

export function extractBalancedJsonCandidates(text: string): string[] {
  const source = String(text ?? '');
  const candidates: string[] = [];
  let start = -1;
  let stack: string[] = [];
  let inString = false;
  let quote = '';
  let escape = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (start === -1) {
      if (char === '{' || char === '[') {
        start = i;
        stack = [char];
        inString = false;
        quote = '';
        escape = false;
      }
      continue;
    }

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      quote = char;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }

    if (char === '}' || char === ']') {
      const last = stack[stack.length - 1];
      if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
        stack.pop();
        if (stack.length === 0) {
          candidates.push(source.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  if (start !== -1) {
    candidates.push(source.slice(start));
  }

  return dedupeStrings(candidates);
}

function replaceSmartQuotes(value: string): string {
  return value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function removeComments(value: string): string {
  let output = '';
  let inString = false;
  let quote = '';
  let escape = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if (inString) {
      output += char;
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === quote) {
        inString = false;
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === '/' && value[i + 1] === '/') {
      while (i < value.length && value[i] !== '\n') i += 1;
      if (i < value.length) output += '\n';
      continue;
    }

    if (char === '/' && value[i + 1] === '*') {
      i += 2;
      while (i < value.length - 1 && !(value[i] === '*' && value[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function replacePythonLiterals(value: string): string {
  return value
    .replace(/\bNone\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false');
}

function stripJsonPrefixes(value: string): string {
  return value
    .replace(/^\s*(?:json|tool_call|tool_calls|response)\s*[:=]\s*(?=[{\[])/i, '')
    .replace(/^\s*[A-Za-z_$][\w$]*\s*=\s*(?=[{\[])/, '')
    .replace(/;\s*$/, '');
}

function quoteUnquotedKeys(value: string): string {
  return value.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3');
}

function replaceSingleQuotedKeys(value: string): string {
  return value.replace(/([{,]\s*)'([^'\\]+?)'(\s*:)/g, '$1"$2"$3');
}

function replaceSingleQuotedStrings(value: string): string {
  const escapeDoubleQuotes = (input: string) => input.replace(/"/g, '\\"');
  let output = value.replace(/(:\s*)'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, prefix, content) => {
    return `${prefix}"${escapeDoubleQuotes(content)}"`;
  });
  output = output.replace(/([\[, ]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*[,}\]])/g, (_match, prefix, content) => {
    return `${prefix}"${escapeDoubleQuotes(content)}"`;
  });
  return output;
}

function fixTrailingCommas(value: string): string {
  return value.replace(/,\s*([}\]])/g, '$1');
}

function balanceDelimiter(value: string, openChar: string, closeChar: string): string {
  let opens = 0;
  let closes = 0;
  let inString = false;
  let quote = '';
  let escape = false;

  for (const char of value) {
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === openChar) opens += 1;
    if (char === closeChar) closes += 1;
  }

  if (opens > closes) {
    return value + closeChar.repeat(opens - closes);
  }
  return value;
}

function normalizeParsedValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = stripWholeWrapper(value as string).trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;

  try {
    return normalizeParsedValue(JSON.parse(trimmed));
  } catch {
    try {
      return normalizeParsedValue(JSON.parse(repairJsonString(trimmed)));
    } catch {
      return value;
    }
  }
}

function parseJsonCandidate(candidate: string): unknown {
  const stripped = stripWholeWrapper(String(candidate ?? '').trim());
  if (!stripped) throw new Error('Empty JSON candidate');
  try {
    return normalizeParsedValue(JSON.parse(stripped));
  } catch {
    const repaired = repairJsonString(stripped);
    return normalizeParsedValue(JSON.parse(repaired));
  }
}

function collectJsonCandidates(text: string): string[] {
  const raw = stripBom(String(text ?? '')).trim();
  if (!raw) return [];
  return dedupeStrings([
    stripWholeWrapper(raw),
    ...extractCodeFenceContents(raw),
    ...extractTagContents(raw),
    ...extractBalancedJsonCandidates(raw),
  ]).filter((candidate) => /[\[{]/.test(candidate));
}

export function extractJsonLike(text: string): string | null {
  return collectJsonCandidates(text)[0] || null;
}

export function repairJsonString(raw: string): string {
  let value = stripWholeWrapper(String(raw ?? ''));
  value = replaceSmartQuotes(value);
  value = stripJsonPrefixes(value);
  value = removeComments(value);
  value = replacePythonLiterals(value);
  value = replaceSingleQuotedKeys(value);
  value = quoteUnquotedKeys(value);
  value = replaceSingleQuotedStrings(value);
  // Balance delimiters first then remove trailing commas
  value = balanceDelimiter(value, '{', '}');
  value = balanceDelimiter(value, '[', ']');
  value = fixTrailingCommas(value);
  return value.trim();
}

export function parsePossiblyMalformedJson(raw: unknown): unknown {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;

  const candidates = collectJsonCandidates(String(raw));
  if (candidates.length === 0) {
    const err = Object.assign(new Error(`Failed to locate JSON in: ${String(raw).slice(0, 800)}`), {
      code: 'JSON_REPAIR_FAILED',
    });
    throw err;
  }

  let lastError: any = null;
  for (const candidate of candidates) {
    try {
      return parseJsonCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const message = `Failed to parse JSON after repair: ${lastError?.message || String(lastError)} -- original:${String(raw).slice(0, 800)}`;
  throw Object.assign(new Error(message), { code: 'JSON_REPAIR_FAILED' });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isToolLike(value: unknown): boolean {
  if (!isObject(value)) return false;
  const node = value as Record<string, unknown>;
  if (node.function && isObject(node.function)) {
    return Boolean((node.function as Record<string, unknown>).name || (node.function as Record<string, unknown>).arguments || (node.function as Record<string, unknown>).input);
  }
  return Boolean(node.name || node.tool);
}

function visitToolNodes(node: unknown, results: any[]) {
  if (Array.isArray(node)) {
    if (node.every(isToolLike)) {
      results.push(...(node as any[]));
      return;
    }
    for (const item of node) visitToolNodes(item, results);
    return;
  }

  if (!isObject(node)) return;

  const obj = node as Record<string, unknown>;

  if (Array.isArray(obj.tool_calls)) {
    visitToolNodes(obj.tool_calls, results);
    return;
  }
  if (Array.isArray(obj.calls)) {
    visitToolNodes(obj.calls, results);
    return;
  }
  if (Array.isArray(obj.tools)) {
    visitToolNodes(obj.tools, results);
    return;
  }
  if (obj.message) visitToolNodes(obj.message, results);
  if (Array.isArray(obj.content)) visitToolNodes(obj.content, results);
  if (isToolLike(obj)) results.push(obj);
}

function dedupeToolCalls(calls: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const call of calls) {
    const key = JSON.stringify({
      name: call?.function?.name || call?.name || call?.tool || '',
      arguments: call?.function?.arguments || call?.arguments || call?.input || call?.params || null,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(call);
  }
  return result;
}

export function extractStructuredToolCallsFromText(text: string): any[] {
  const calls: any[] = [];
  for (const candidate of collectJsonCandidates(text)) {
    if (!/tool_calls?|tool_use|name|tool|function|arguments|input|params/i.test(candidate)) continue;
    try {
      const parsed = parsePossiblyMalformedJson(candidate);
      visitToolNodes(parsed, calls);
    } catch {
      // ignore candidate parse failures and continue trying other candidates
    }
  }
  return dedupeToolCalls(calls);
}

export default {
  extractBalancedJsonCandidates,
  extractCodeFenceContents,
  extractJsonLike,
  extractTagContents,
  repairJsonString,
  parsePossiblyMalformedJson,
  extractStructuredToolCallsFromText,
};
