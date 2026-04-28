// Lightweight JSON repair utilities for the shim (JS runtime)
export function extractJsonLike(text) {
  if (!text) return null;
  const fenceMatch = /```(?:json|tool_call)?\s*([\s\S]*?)```/.exec(text);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const start = firstBrace >= 0 ? firstBrace : (firstBracket >= 0 ? firstBracket : -1);
  if (start === -1) return null;
  let end = text.lastIndexOf('}');
  if (end === -1) end = text.lastIndexOf(']');
  if (end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function replaceSmartQuotes(s) {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function removeComments(s) {
  return s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function fixTrailingCommas(s) {
  return s.replace(/,\s*([\]}])/g, '$1');
}

function replaceSingleQuotes(s) {
  return s.replace(/'([^']*?)'/g, '"$1"');
}

function replacePythonLiterals(s) {
  return s.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');
}

function balanceBraces(s) {
  const opens = (s.match(/[{}]/g) || []).filter((c) => c === '{').length;
  const closes = (s.match(/[{}]/g) || []).filter((c) => c === '}').length;
  let out = s;
  for (let i = closes; i < opens; i++) out += '}';
  return out;
}

export function repairJsonString(raw) {
  let s = String(raw || '');
  s = replaceSmartQuotes(s);
  s = removeComments(s);
  s = replacePythonLiterals(s);
  s = replaceSingleQuotes(s);
  s = balanceBraces(s);
  s = balanceBraces(s);
  s = fixTrailingCommas(s);
  return s;
}

export function parsePossiblyMalformedJson(raw) {
  const candidate = raw == null ? '' : String(raw).trim();
  if (!candidate) return {};
  try {
    return JSON.parse(candidate);
  } catch (e) {
    const extracted = extractJsonLike(candidate) || candidate;
    const repaired = repairJsonString(extracted);
    try {
      return JSON.parse(repaired);
    } catch (err) {
      const braceMatch = /\{[\s\S]*\}/.exec(repaired);
      if (braceMatch) {
        try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
      }
      const msg = `Failed to parse JSON after repair: ${err?.message || String(err)} -- original:${String(raw).slice(0, 800)}`;
      const eout = new Error(msg);
      eout.code = 'JSON_REPAIR_FAILED';
      throw eout;
    }
  }
}

export default { extractJsonLike, repairJsonString, parsePossiblyMalformedJson };
