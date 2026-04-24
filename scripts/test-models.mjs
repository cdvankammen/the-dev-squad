#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';

(async () => {
  try {
    const route = await import('../src/app/api/models/route.ts');

    const provider = process.argv[2] || 'occ';
    const req = new Request(`http://localhost/api/models?provider=${encodeURIComponent(provider)}`);
    const res = await route.GET(req);
    try {
      const data = await res.json();
      console.log('models route result:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('models route returned non-JSON or empty response');
    }
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
