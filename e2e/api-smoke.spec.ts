/**
 * E2E: API Surface smoke tests
 * These run without a browser — they use Playwright's request context.
 * They verify that all major API routes return sane JSON envelopes.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('API surface (no browser)', () => {
  test('GET /api/health returns ok:true', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(Array.isArray(body.providers)).toBe(true);
  });

  test('GET /api/providers returns provider list', async ({ request }) => {
    const res = await request.get(`${BASE}/api/providers`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.providers)).toBe(true);
    expect(body.providers.length).toBeGreaterThan(0);
    // Every entry has required fields
    for (const p of body.providers) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(typeof p.available).toBe('boolean');
    }
  });

  test('GET /api/models?provider=claude-cli returns model list', async ({ request }) => {
    const res = await request.get(`${BASE}/api/models?provider=claude-cli`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.provider).toBe('string');
    expect(Array.isArray(body.models)).toBe(true);
    expect(typeof body.modelCount).toBe('number');
  });

  test('GET /api/state returns pipeline state', async ({ request }) => {
    const res = await request.get(`${BASE}/api/state`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Should have at least a phase or status field
    expect(body).toBeTruthy();
  });

  test('GET /api/pending returns array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/pending`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.pending ?? body)).toBe(true);
  });

  test('POST /api/chat with empty message returns error or response', async ({ request }) => {
    const res = await request.post(`${BASE}/api/chat`, {
      data: { message: 'ping', agentId: 'A' },
      headers: { 'Content-Type': 'application/json' },
    });
    // Should not return 500; 200 with streaming or 400 are both acceptable
    expect(res.status()).toBeLessThan(500);
  });
});
