import assert from 'node:assert/strict';

async function loadModelsGET() {
  const mod = await import('../src/app/api/models/route.ts');
  const fn = mod.GET;
  assert.equal(typeof fn, 'function', '/api/models route should export GET');
  return fn;
}

async function fetchModels(modelsGET, provider) {
  const req = { url: `http://local/api/models?provider=${encodeURIComponent(provider)}` };
  const res = await modelsGET(req);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`models route returned non-JSON for ${provider}: ${text.slice(0, 180)}`);
  }
  assert.equal(res.status, 200, `models route status for ${provider} was ${res.status}`);
  assert.equal(data.provider, provider, `models route echoed wrong provider: expected ${provider}, got ${data.provider}`);
  assert(Array.isArray(data.models), `models route models should be array for ${provider}`);
  return data;
}

function sameList(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

async function main() {
  const modelsGET = await loadModelsGET();
  const sequence = ['claude-cli', 'openclaude', 'claude-cli', 'ccr', 'occ', 'ccr', 'openai-http', 'lm-studio', 'openai-http'];
  const snapshots = {};

  for (const provider of sequence) {
    const data = await fetchModels(modelsGET, provider);
    if (!snapshots[provider]) {
      snapshots[provider] = data.models;
    } else {
      assert(
        sameList(snapshots[provider], data.models),
        `provider ${provider} model list changed across calls in same run; first=${JSON.stringify(snapshots[provider])} now=${JSON.stringify(data.models)}`
      );
    }
  }

  const nonEmpty = Object.entries(snapshots).filter(([, list]) => Array.isArray(list) && list.length > 0);
  let foundDifference = false;
  for (let i = 0; i < nonEmpty.length; i++) {
    for (let j = i + 1; j < nonEmpty.length; j++) {
      const [pa, la] = nonEmpty[i];
      const [pb, lb] = nonEmpty[j];
      if (!sameList(la, lb)) {
        foundDifference = true;
        console.log(`provider lists differ as expected: ${pa} vs ${pb}`);
        i = nonEmpty.length;
        break;
      }
    }
  }
  if (nonEmpty.length >= 2) {
    assert(foundDifference, `all non-empty provider lists were identical: ${JSON.stringify(Object.fromEntries(nonEmpty))}`);
  }

  console.log('Provider model isolation test OK');
  console.log(JSON.stringify(snapshots, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
