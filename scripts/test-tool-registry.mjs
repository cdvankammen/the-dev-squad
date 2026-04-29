#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { normalizeToolName, isKnownToolName, normalizeToolCalls, TOOL_DEFINITIONS } from '../src/lib/toolRegistry.ts';

function ok(msg) { console.log(`OK: ${msg}`); }

assert.equal(normalizeToolName('TOOL_CALLS_Grep'), 'Grep');
ok('normalizes noisy TOOL_CALLS_ prefix');

assert.equal(normalizeToolName('functions.web_fetch'), 'WebFetch');
ok('normalizes dotted and underscored aliases');

assert.equal(isKnownToolName('Grep'), true);
ok('recognizes Grep');

assert.equal(isKnownToolName('http-get'), true);
ok('recognizes alias-based tool names');

const calls = normalizeToolCalls([{ id: '1', function: { name: 'Grep', arguments: '{"pattern":"x"}' } }]);
assert.equal(Array.isArray(calls) && calls.length === 1 && calls[0].function.name === 'Grep', true);
ok('normalizeToolCalls produces normalized tool call');

const wrapped = normalizeToolCalls({ tool_calls: [{ name: 'web_search', arguments: { query: 'lm studio docs' } }] });
assert.equal(wrapped.length, 1);
assert.equal(wrapped[0].function.name, 'WebSearch');
ok('normalizeToolCalls unwraps tool_calls payloads');

assert.equal(TOOL_DEFINITIONS.some((tool) => tool.function.name === 'WebFetch'), true);
ok('TOOL_DEFINITIONS exposes canonical tool metadata');

console.log('tool-registry tests passed');
