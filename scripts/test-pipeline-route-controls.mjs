import assert from 'node:assert/strict';

async function load(path, exportName = 'GET') {
  const mod = await import(path);
  const fn = mod[exportName];
  assert.equal(typeof fn, 'function', `${path} should export ${exportName}`);
  return fn;
}

async function parseJson(res, label) {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 220)}`);
  }
}

function fakeReq(body) {
  return { json: async () => body };
}

async function main() {
  const stateGET = await load('../src/app/api/state/route.ts', 'GET');
  const startPOST = await load('../src/app/api/start-pipeline/route.ts', 'POST');
  const stopPOST = await load('../src/app/api/stop-pipeline/route.ts', 'POST');
  const resumePOST = await load('../src/app/api/resume-pipeline/route.ts', 'POST');
  const approvePOST = await load('../src/app/api/approve/route.ts', 'POST');

  const stateRes = await stateGET({ nextUrl: { searchParams: new URLSearchParams('mode=pipeline') } });
  const stateData = await parseJson(stateRes, '/api/state');
  assert.equal(stateRes.status, 200, '/api/state should return 200');
  assert.equal(typeof stateData.json, 'object', '/api/state should return object JSON');

  const startRes = await startPOST(fakeReq({
    securityMode: 'fast',
    runGoal: 'full-build',
    permissionMode: 'auto',
    runFinalAudit: false,
    model: 'haiku',
    modelProvider: 'ccr',
    discoveredOnly: true,
  }));
  const startData = await parseJson(startRes, '/api/start-pipeline');
  assert.equal(startRes.status, 200, '/api/start-pipeline should return 200 JSON envelope');
  assert.equal(typeof startData.json.success, 'boolean', '/api/start-pipeline.success should be boolean');

  const stopRes = await stopPOST();
  const stopData = await parseJson(stopRes, '/api/stop-pipeline');
  assert.equal(stopRes.status, 200, '/api/stop-pipeline should return 200');
  assert.equal(typeof stopData.json.success, 'boolean', '/api/stop-pipeline.success should be boolean');

  const resumeRes = await resumePOST();
  const resumeData = await parseJson(resumeRes, '/api/resume-pipeline');
  assert.equal(resumeRes.status, 200, '/api/resume-pipeline should return 200');
  assert.equal(typeof resumeData.json.success, 'boolean', '/api/resume-pipeline.success should be boolean');

  const approveInvalidRes = await approvePOST(fakeReq({ action: 'bogus' }));
  const approveInvalid = await parseJson(approveInvalidRes, '/api/approve invalid');
  assert.equal(approveInvalidRes.status, 200, '/api/approve invalid action currently returns 200 envelope');
  assert.equal(approveInvalid.json.success, false, '/api/approve invalid action should return success=false');

  const approvePauseRes = await approvePOST(fakeReq({ action: 'pause' }));
  const approvePause = await parseJson(approvePauseRes, '/api/approve pause');
  assert.equal(approvePauseRes.status, 200, '/api/approve pause should return 200 envelope');
  assert.equal(typeof approvePause.json.success, 'boolean', '/api/approve pause success should be boolean');

  console.log('Pipeline route control surface test OK');
  console.log(JSON.stringify({
    start: startData.json,
    stop: stopData.json,
    resume: resumeData.json,
    approvePause: approvePause.json,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
