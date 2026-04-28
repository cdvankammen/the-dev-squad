#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { normalizeToolName, isKnownToolName, normalizeToolCalls } from '../src/lib/toolRegistry.ts';

function ok(msg) { console.log(`OK: ${msg}`); }

assert.equal(normalizeToolName('TOOL_CALLS_Grep'), 'Grep');
ok('normalizes noisy TOOL_CALLS_ prefix');

assert.equal(isKnownToolName('Grep'), true);
ok('recognizes Grep');

const calls = normalizeToolCalls([{ id: '1', function: { name: 'Grep', arguments: '{"pattern":"x"}' } }]);
assert.equal(Array.isArray(calls) && calls.length === 1 && calls[0].function.name === 'Grep', true);
ok('normalizeToolCalls produces normalized tool call');

console.log('tool-registry tests passed');
