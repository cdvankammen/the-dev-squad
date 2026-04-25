import assert from 'node:assert/strict';

async function load(modulePath, exportName) {
  const mod = await import(modulePath);
  const fn = mod[exportName];
  assert.equal(typeof fn, 'function', `${modulePath} should export ${exportName}`);
  return fn;
}

async function parseJson(res, label) {
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text), text };
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 220)}`);
  }
}

function req(body) {
  return { json: async () => body };
}

async function main() {
  const planGET = await load('../src/app/api/plan/route.ts', 'GET');
  const pendingGET = await load('../src/app/api/pending/route.ts', 'GET');
  const pipelineControlPOST = await load('../src/app/api/pipeline-control/route.ts', 'POST');
  const auditActionPOST = await load('../src/app/api/audit-action/route.ts', 'POST');
  const resetPOST = await load('../src/app/api/reset/route.ts', 'POST');

  const planRes = await parseJson(await planGET(), '/api/plan');
  assert([200, 404].includes(planRes.status), `/api/plan unexpected status ${planRes.status}`);
  if (planRes.status === 200) {
    assert('content' in planRes.data || 'plan' in planRes.data, '/api/plan(200) should include content/plan field');
  } else {
    assert('content' in planRes.data || 'error' in planRes.data, '/api/plan(404) should include content/error field');
  }

  const pendingRes = await parseJson(await pendingGET(), '/api/pending');
  assert.equal(pendingRes.status, 200, '/api/pending should return 200');
  if (pendingRes.data !== null) {
    assert('pending' in pendingRes.data || 'approval' in pendingRes.data, '/api/pending should include pending/approval field when object');
  }

  const pcInvalid = await parseJson(await pipelineControlPOST(req({ action: 'not-real' })), '/api/pipeline-control invalid');
  assert([200, 400, 500].includes(pcInvalid.status), `/api/pipeline-control invalid returned unexpected status ${pcInvalid.status}`);
  assert.equal(pcInvalid.data.success, false, '/api/pipeline-control invalid action should return success=false');

  const pcSet = await parseJson(await pipelineControlPOST(req({ action: 'stop-after-review' })), '/api/pipeline-control stop-after-review');
  assert.equal(pcSet.status, 200, '/api/pipeline-control stop-after-review should return 200');
  assert.equal(typeof pcSet.data.success, 'boolean', '/api/pipeline-control stop-after-review should return success boolean');

  const pcClear = await parseJson(await pipelineControlPOST(req({ action: 'clear-stop-after-review' })), '/api/pipeline-control clear-stop-after-review');
  assert.equal(pcClear.status, 200, '/api/pipeline-control clear-stop-after-review should return 200');
  assert.equal(typeof pcClear.data.success, 'boolean', '/api/pipeline-control clear-stop-after-review should return success boolean');

  const auditInvalid = await parseJson(await auditActionPOST(req({ action: 'not-real' })), '/api/audit-action invalid');
  assert.equal(auditInvalid.status, 400, '/api/audit-action invalid action should return 400');
  assert.equal(auditInvalid.data.success, false, '/api/audit-action invalid should return success=false');

  const resetManual = await parseJson(await resetPOST(req({ mode: 'manual' })), '/api/reset manual');
  assert.equal(resetManual.status, 200, '/api/reset manual should return 200');
  assert.equal(resetManual.data.ok, true, '/api/reset manual should return ok=true');

  const resetPipeline = await parseJson(await resetPOST(req({ mode: 'pipeline' })), '/api/reset pipeline');
  assert.equal(resetPipeline.status, 200, '/api/reset pipeline should return 200');
  assert.equal(resetPipeline.data.ok, true, '/api/reset pipeline should return ok=true');

  console.log('Extended API route checks OK');
  console.log(JSON.stringify({
    planStatus: planRes.status,
    pending: pendingRes.data,
    pipelineControlInvalid: { status: pcInvalid.status, body: pcInvalid.data },
    pipelineControlSet: { status: pcSet.status, body: pcSet.data },
    pipelineControlClear: { status: pcClear.status, body: pcClear.data },
    resetManual: resetManual.data,
    resetPipeline: resetPipeline.data,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
