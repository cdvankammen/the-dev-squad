import assert from 'node:assert/strict';

async function loadGet(modulePath, label) {
  const mod = await import(modulePath);
  const fn = mod.GET;
  assert.equal(typeof fn, 'function', `${label} should export GET`);
  return fn;
}

async function parseJsonResponse(res, label) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 180)}`);
  }
  return data;
}

async function main() {
  const healthGET = await loadGet('../src/app/api/health/route.ts', '/api/health');
  const providersGET = await loadGet('../src/app/api/providers/route.ts', '/api/providers');
  const modelsGET = await loadGet('../src/app/api/models/route.ts', '/api/models');

  const healthRes = await healthGET();
  const health = await parseJsonResponse(healthRes, '/api/health');
  assert.equal(healthRes.status, 200, '/api/health should return 200');
  assert.equal(health.ok, true, '/api/health should contain ok=true');

  const providersRes = await providersGET();
  const providersData = await parseJsonResponse(providersRes, '/api/providers');
  assert.equal(providersRes.status, 200, '/api/providers should return 200');
  assert(Array.isArray(providersData.providers), '/api/providers.providers should be an array');

  const providerIds = providersData.providers.map((p) => p.id);
  for (const id of providerIds) {
    const req = { url: `http://local/api/models?provider=${encodeURIComponent(id)}` };
    const modelsRes = await modelsGET(req);
    const modelsData = await parseJsonResponse(modelsRes, `/api/models?provider=${id}`);
    assert.equal(modelsRes.status, 200, `/api/models should return 200 for ${id}`);
    assert.equal(modelsData.provider, id, `models.provider mismatch for ${id}`);
    assert(Array.isArray(modelsData.models), `models array missing for ${id}`);
    assert(typeof modelsData.modelCount === 'number', `modelCount missing for ${id}`);
    assert(typeof modelsData.usedDiscovery === 'boolean', `usedDiscovery missing for ${id}`);
    assert(typeof modelsData.fallbackUsed === 'boolean', `fallbackUsed missing for ${id}`);
  }

  console.log('API surface smoke test OK');
  console.log(JSON.stringify({
    providerCount: providerIds.length,
    providers: providerIds,
    health,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
