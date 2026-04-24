#!/usr/bin/env node
import route from '../src/app/api/start-pipeline/route.ts';

(async () => {
  try {
    const body = {
      securityMode: 'fast',
      permissionMode: 'auto',
      runGoal: 'full-build',
      runFinalAudit: false,
      model: 'claude-sonnet-4-6',
      modelProvider: 'occ',
    };
    const req = new Request('http://localhost/api/start-pipeline', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const res = await route.POST(req);
    const data = await res.json().catch(() => null);
    console.log('start-pipeline result:', data);
  } catch (err) {
    console.error('test failed', err);
    process.exit(1);
  }
})();
