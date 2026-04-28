#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { parsePossiblyMalformedJson, extractJsonLike, repairJsonString } from './json-repair.mjs';

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

assert.deepEqual(parsePossiblyMalformedJson('```json\n{"x": 2}\n```'), { x: 2 });
ok('extracts from code fence');

// Extract JSON-like
assert.equal(extractJsonLike('no json here'), null);
ok('extractJsonLike returns null when none');

console.log('json-repair tests passed');
