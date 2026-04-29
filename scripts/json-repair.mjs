const TOOLISH_HINT = /tool_calls?|tool_use|name|tool|function|arguments|input|params/i;

function stripBom(value) {
  return value.replace(/^\uFEFF/, '');
}

function stripWholeWrapper(text) {
  let value = stripBom(String(text ?? '')).trim();
  const fenced = value.match(/^```(?:json|tool_call|tool_calls|javascript|js)?\s*([\s\S]*?)```$/i);
  if (fenced) value = fenced[1].trim();
  const tagged = value.match(/^<(?:tool_call|tool_calls|tool|json)[^>]*>([\s\S]*?)<\/(?:tool_call|tool_calls|tool|json)>$/i);
  if (tagged) value = tagged[1].trim();
  return value;
}

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function extractCodeFenceContents(text) {
  const blocks = [];
  const pattern = /```(?:json|tool_call|tool_calls|javascript|js)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = pattern.exec(String(text ?? ''))) !== null) {
    blocks.push(match[1].trim());
  }
  return dedupeStrings(blocks);
}

export function extractTagContents(text) {
  const blocks = [];
  const pattern = /<(tool_call|tool_calls|tool|json)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = pattern.exec(String(text ?? ''))) !== null) {
    blocks.push(match[2].trim());
  }
  return dedupeStrings(blocks);
}

export function extractBalancedJsonCandidates(text) {
  const source = String(text ?? '');
  const candidates = [];
  let start = -1;
  let stack = [];
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

function replaceSmartQuotes(value) {
  return value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function removeComments(value) {
  return value.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function replacePythonLiterals(value) {
  return value
    .replace(/\bNone\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false');
}

function stripJsonPrefixes(value) {
  return value
    .replace(/^\s*(?:json|tool_call|tool_calls|response)\s*[:=]\s*(?=[{\[])/i, '')
    .replace(/^\s*[A-Za-z_$][\w$]*\s*=\s*(?=[{\[])/, '')
    .replace(/;\s*$/, '');
}

function quoteUnquotedKeys(value) {
  return value.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3');
}

function replaceSingleQuotedKeys(value) {
  return value.replace(/([{,]\s*)'([^'\\]+?)'(\s*:)/g, '$1"$2"$3');
}

function replaceSingleQuotedStrings(value) {
  const escapeDoubleQuotes = (input) => input.replace(/"/g, '\\"');
  let output = value.replace(/(:\s*)'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, prefix, content) => {
    return `${prefix}"${escapeDoubleQuotes(content)}"`;
  });
  output = output.replace(/([\[, ]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*[,}\]])/g, (_match, prefix, content) => {
    return `${prefix}"${escapeDoubleQuotes(content)}"`;
  });
  return output;
}

function fixTrailingCommas(value) {
  return value.replace(/,\s*([}\]])/g, '$1');
}

function balanceDelimiter(value, openChar, closeChar) {
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

function normalizeParsedValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = stripWholeWrapper(value).trim();
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

function parseJsonCandidate(candidate) {
  const stripped = stripWholeWrapper(String(candidate ?? '').trim());
  if (!stripped) throw new Error('Empty JSON candidate');
  try {
    return normalizeParsedValue(JSON.parse(stripped));
  } catch {
    const repaired = repairJsonString(stripped);
    return normalizeParsedValue(JSON.parse(repaired));
  }
}

function collectJsonCandidates(text) {
  const raw = stripBom(String(text ?? '')).trim();
  if (!raw) return [];
  return dedupeStrings([
    stripWholeWrapper(raw),
    ...extractCodeFenceContents(raw),
    ...extractTagContents(raw),
    ...extractBalancedJsonCandidates(raw),
  ]).filter((candidate) => /[\[{]/.test(candidate));
}

export function extractJsonLike(text) {
  return collectJsonCandidates(text)[0] || null;
}

export function repairJsonString(raw) {
  let value = stripWholeWrapper(String(raw ?? ''));
  value = replaceSmartQuotes(value);
  value = stripJsonPrefixes(value);
  value = removeComments(value);
  value = replacePythonLiterals(value);
  value = replaceSingleQuotedKeys(value);
  value = quoteUnquotedKeys(value);
  value = replaceSingleQuotedStrings(value);
  // Ensure delimiters are balanced before removing trailing commas so that
  // a missing closing brace/bracket doesn't leave a trailing-comma followed
  // by the newly-added closer (e.g. '{"a":1,' -> '{"a":1,}') which would
  // still be invalid JSON. Balance first, then remove trailing commas.
  value = balanceDelimiter(value, '{', '}');
  value = balanceDelimiter(value, '[', ']');
  value = fixTrailingCommas(value);
  return value.trim();
}

export function parsePossiblyMalformedJson(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;

  const candidates = collectJsonCandidates(raw);
  if (candidates.length === 0) {
    throw Object.assign(new Error(`Failed to locate JSON in: ${String(raw).slice(0, 800)}`), {
      code: 'JSON_REPAIR_FAILED',
    });
  }

  let lastError = null;
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

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isToolLike(value) {
  if (!isObject(value)) return false;
  if (value.function && isObject(value.function)) {
    return Boolean(value.function.name || value.function.arguments || value.function.input);
  }
  return Boolean(value.name || value.tool);
}

function visitToolNodes(node, results) {
  if (Array.isArray(node)) {
    if (node.every(isToolLike)) {
      results.push(...node);
      return;
    }
    for (const item of node) visitToolNodes(item, results);
    return;
  }

  if (!isObject(node)) return;

  if (Array.isArray(node.tool_calls)) {
    visitToolNodes(node.tool_calls, results);
    return;
  }
  if (Array.isArray(node.calls)) {
    visitToolNodes(node.calls, results);
    return;
  }
  if (Array.isArray(node.tools)) {
    visitToolNodes(node.tools, results);
    return;
  }
  if (node.message) visitToolNodes(node.message, results);
  if (Array.isArray(node.content)) visitToolNodes(node.content, results);
  if (isToolLike(node)) results.push(node);
}

function dedupeToolCalls(calls) {
  const seen = new Set();
  const result = [];
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

export function extractStructuredToolCallsFromText(text) {
  const calls = [];
  for (const candidate of collectJsonCandidates(text)) {
    if (!TOOLISH_HINT.test(candidate)) continue;
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
  extractStructuredToolCallsFromText,
  extractTagContents,
  repairJsonString,
  parsePossiblyMalformedJson,
};
