#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import {
  parsePossiblyMalformedJson,
  extractBalancedJsonCandidates,
  extractJsonLike,
  extractStructuredToolCallsFromText,
  repairJsonString,
} from './json-repair.mjs';

function ok(msg) {
  console.log(`OK: ${msg}`);
}

// Simple cases
assert.deepEqual(parsePossiblyMalformedJson('{"a":1}'), { a: 1 });
ok('parses valid JSON');

assert.deepEqual(parsePossiblyMalformedJson("{'a':'b'}"), { a: 'b' });
ok('repairs single quotes');

assert.deepEqual(parsePossiblyMalformedJson('{"a":1,'), { a: 1 });
ok('repairs trailing comma and missing brace');

assert.deepEqual(parsePossiblyMalformedJson('{a: True, nested: {value: None}}'), { a: true, nested: { value: null } });
ok('repairs unquoted keys and python literals');

assert.deepEqual(parsePossiblyMalformedJson('```json\n{"x": 2}\n```'), { x: 2 });
ok('extracts from code fence');

assert.deepEqual(
  parsePossiblyMalformedJson('<tool_call>{"tool_calls":[{"name":"Read","arguments":{"file_path":"src/index.ts"}}]}</tool_call>'),
  { tool_calls: [{ name: 'Read', arguments: { file_path: 'src/index.ts' } }] },
);
ok('extracts tool payloads from xml wrapper');

// Extract JSON-like
assert.equal(extractJsonLike('no json here'), null);
ok('extractJsonLike returns null when none');

assert.equal(extractBalancedJsonCandidates('before {"tool":"Read","arguments":{"file_path":"a"}} after').length > 0, true);
ok('extractBalancedJsonCandidates finds embedded JSON');

const toolCalls = extractStructuredToolCallsFromText('```tool_call\n{"tool_calls":[{"name":"TOOL_CALLS_Grep","arguments":{"pattern":"mock","path":"."}}]}\n```');
assert.equal(Array.isArray(toolCalls) && toolCalls.length === 1, true);
assert.equal(toolCalls[0].name || toolCalls[0].function?.name, 'TOOL_CALLS_Grep');
ok('extractStructuredToolCallsFromText finds structured tool arrays');

assert.equal(repairJsonString('{a: 1, trailing: true,}'), '{"a": 1, "trailing": true}');
ok('repairJsonString normalizes keys and trailing commas');

console.log('json-repair tests passed');
