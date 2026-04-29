#!/usr/bin/env node
import {
  parsePossiblyMalformedJson,
  repairJsonString,
  extractJsonLike,
  extractBalancedJsonCandidates
} from './json-repair.mjs';

const inputs = [
  '{"a":1,',
  "{'a':'b'}",
  '```json\n{"x": 2}\n```',
  '{a: True, nested: {value: None}}'
];

for (const input of inputs) {
  console.log('-----');
  console.log('INPUT:', input);
  try {
    const parsed = parsePossiblyMalformedJson(input);
    console.log('PARSED:', JSON.stringify(parsed));
  } catch (e) {
    console.log('PARSE ERROR:', e.message, e.code || '');
    try {
      const extracted = extractJsonLike(input);
      console.log('EXTRACTED:', extracted);
      const repaired = repairJsonString(extracted || input);
      console.log('REPAIRED:', repaired);
    } catch (e2) {
      console.log('REPAIR ERROR:', e2.message || e2);
    }
  }
}
