#!/usr/bin/env node
import path from 'path';
import { readFileSync } from 'fs';

(async () => {
  try {
    // Load the route module via tsx (this file will be executed with npx tsx)
    const route = await import('../src/app/api/chat/route.ts');

    // Mock a NextRequest-like object whose json() throws to simulate a parse
    // error or other unexpected runtime failure in the handler.
    const mockReq = {
      async json() { throw new Error('simulated request.json() failure for testing'); },
      url: 'http://localhost/api/chat'
    };

    const res = await route.POST(mockReq);
    console.log('Route returned (status/property snapshot):', { status: res?.status || 'unknown', ok: !!res });

    // Read the tail of the server log so we can inspect what was written.
    const logPath = path.join(process.cwd(), 'logs', 'server-errors.log');
    try {
      const contents = readFileSync(logPath, 'utf8');
      const tail = contents.split('\n').slice(-60).join('\n');
      console.log('\n--- server log tail ---\n');
      console.log(tail);
    } catch (e) {
      console.log('No server log found at', logPath);
    }
  } catch (err) {
    console.error('Test script failed:', err);
    process.exit(1);
  }
})();
