#!/usr/bin/env node
const provider = process.argv[2] || 'claude-cli';
const model = process.argv[3] || 'claude-sonnet-4-6';
const message = process.argv.slice(4).join(' ') || 'Reply with exactly OK';

async function main() {
  const route = await import('../src/app/api/chat/route.ts');
  const req = {
    async json() {
      return {
        agent: 'A',
        message,
        mode: 'manual',
        model,
        modelProvider: provider,
      };
    },
    url: 'http://localhost/api/chat',
  };

  const res = await route.POST(req);
  const body = await res.text();
  console.log(JSON.stringify({ provider, model, status: res.status, body: body.slice(0, 600) }, null, 2));

  if (res.status >= 500) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('test-chat-provider-smoke failed:', err?.stack || err?.message || String(err));
  process.exit(1);
});
