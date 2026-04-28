/**
 * Simple JSON repair utilities for the-dev-squad
 * Aim: deterministically repair common JSON mistakes from LLM output.
 */
export function extractJsonLike(text: string): string | null {
  if (!text) return null;
  // Remove code fences and markdown wrappers
  const fenceMatch = /```(?:json|tool_call)?\s*([\s\S]*?)```/.exec(text);
  if (fenceMatch) return fenceMatch[1].trim();

  // Look for first { ... } or [ ... ] block
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const start = firstBrace >= 0 ? firstBrace : (firstBracket >= 0 ? firstBracket : -1);
  if (start === -1) return null;
  // find last matching close
  let end = text.lastIndexOf('}');
  if (end === -1) end = text.lastIndexOf(']');
  if (end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function replaceSmartQuotes(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function removeComments(s: string): string {
  return s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function fixTrailingCommas(s: string): string {
  return s.replace(/,\s*([\]}])/g, '$1');
}

function replaceSingleQuotes(s: string): string {
  // Replace single quotes used as JSON string delimiters with double quotes.
  // This is a heuristic and may mangle apostrophes in natural text.
  return s.replace(/'([^']*?)'/g, '"$1"');
}

function replacePythonLiterals(s: string): string {
  return s.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');
}

function balanceBraces(s: string): string {
  const opens = (s.match(/[{}]/g) || []).filter((c) => c === '{').length;
  const closes = (s.match(/[{}]/g) || []).filter((c) => c === '}').length;
  let out = s;
  for (let i = closes; i < opens; i++) out += '}';
  return out;
}

export function repairJsonString(raw: string): string {
  let s = String(raw || '');
  s = replaceSmartQuotes(s);
  s = removeComments(s);
  s = replacePythonLiterals(s);
  s = fixTrailingCommas(s);
  s = replaceSingleQuotes(s);
  s = balanceBraces(s);
  return s;
}

export function parsePossiblyMalformedJson(raw: string): any {
  const candidate = raw == null ? '' : String(raw).trim();
  if (!candidate) return {};

  // Try direct parse first
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // Try extract then repair
    const extracted = extractJsonLike(candidate) || candidate;
    const repaired = repairJsonString(extracted);
    try {
      return JSON.parse(repaired);
    } catch (err) {
      // As a last resort, try to find first {...} parse
      const braceMatch = /\{[\s\S]*\}/.exec(repaired);
      if (braceMatch) {
        try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
      }
      // Give up with a helpful error
      const msg = `Failed to parse JSON after repair: ${err?.message || String(err)} -- original:${String(raw).slice(0, 800)}`;
      const eout: any = new Error(msg);
      eout.code = 'JSON_REPAIR_FAILED';
      throw eout;
    }
  }
}

export default { extractJsonLike, repairJsonString, parsePossiblyMalformedJson };
