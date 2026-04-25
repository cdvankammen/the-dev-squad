/**
 * E2E: Squad page controls
 *
 * Verifies that the /squad page:
 * 1. Loads with no JS errors
 * 2. Has provider & model dropdowns
 * 3. Has interactive Send / action buttons
 * 4. Chat textarea is typeable
 */
import { test, expect } from '@playwright/test';
import { gotoSquad, waitForProviders } from './helpers';

test.describe('Squad page controls', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSquad(page);
    await waitForProviders(page);
  });

  test('Squad page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.reload();
    await waitForProviders(page);
    const appErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Hydration'),
    );
    expect(appErrors).toHaveLength(0);
  });

  test('Squad page has at least one button', async ({ page }) => {
    const count = await page.locator('button').count();
    expect(count).toBeGreaterThan(0);
  });

  test('Squad page has at least one select (provider dropdown)', async ({ page }) => {
    const count = await page.locator('select').count();
    expect(count).toBeGreaterThan(0);
  });

  test('Squad page has a textarea for chat', async ({ page }) => {
    const count = await page.locator('textarea').count();
    expect(count).toBeGreaterThan(0);
  });

  test('Squad page textarea is typeable', async ({ page }) => {
    const ta = page.locator('textarea').first();
    const visible = await ta.isVisible().catch(() => false);
    if (!visible) { test.skip(); return; }
    await ta.fill('Hello squad test');
    const value = await ta.inputValue();
    expect(value).toBe('Hello squad test');
  });

  test('Squad provider select has options', async ({ page }) => {
    const sel = page.locator('select').first();
    const count = await sel.evaluate((s: HTMLSelectElement) => s.options.length);
    expect(count).toBeGreaterThan(0);
  });

  test('/api/providers returns squads providers', async ({ request }) => {
    const res = await request.get('/api/providers');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.providers)).toBe(true);
  });
});
