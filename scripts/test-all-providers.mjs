#!/usr/bin/env node
/**
 * Live test all 9 providers against the running dev server.
 * Run: npx tsx scripts/test-all-providers.mjs
 */
const BASE = 'http://localhost:3000';
const providers = [
  'claude-cli', 'ccr', 'occ', 'openclaude',
  'ollama', 'lm-studio', 'openwebui', 'openai-compat', 'openai-http',
];

async function test(p) {
  try {
    const r = await fetch(`${BASE}/api/models?provider=${p}`, { signal: AbortSignal.timeout(12000) });
    const d = await r.json();
    const status = d.usedDiscovery
      ? (d.modelCount > 0 ? '✅ LIVE     ' : '⚠️  DISC=0   ')
      : '📋 FALLBACK ';
    console.log(`${status} ${p.padEnd(16)} ${d.modelCount} models`);
    if (d.models && d.models.length > 0 && d.models.length <= 5) {
      d.models.forEach(m => console.log(`             └─ ${m}`));
    } else if (d.models && d.models.length > 5) {
      d.models.slice(0, 4).forEach(m => console.log(`             └─ ${m}`));
      console.log(`             └─ ... +${d.models.length - 4} more`);
    }
  } catch (e) {
    console.log(`❌ ERROR      ${p.padEnd(16)} ${e.message}`);
  }
}

console.log('\n=== Provider Model Discovery Test ===');
console.log(`Hitting: ${BASE}/api/models\n`);
for (const p of providers) await test(p);
console.log('\nDone.\n');
