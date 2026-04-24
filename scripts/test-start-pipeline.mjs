#!/usr/bin/env node
import route from '../src/app/api/start-pipeline/route.ts';

const req = new Request('http://localhost/api/start-pipeline', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    securityMode: 'fast',
    permissionMode: 'auto',
    runGoal: 'full-build',
    runFinalAudit: false,
    model: 'claude-sonnet-4-6',
    modelProvider: 'claude-cli',
  }),
});

(async () => {
  const res = await route.POST(req);
  const data = await res.json().catch(() => ({}));
  console.log('start-pipeline result:', data);

  // This route can validly return either success or a precondition error (no staging session).
  const okShape = data && (typeof data.success === 'boolean');
  if (!okShape) {
    console.error('unexpected response shape from start-pipeline');
    process.exit(1);
  }
})();
