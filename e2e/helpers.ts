/**
 * Shared helpers for the-dev-squad Playwright E2E tests.
 */
import { type Page, expect } from '@playwright/test';

/** Navigate to the main pipeline page and wait for it to be ready */
export async function gotoHome(page: Page) {
  await page.goto('/');
  // Wait for at least one nav button to be visible (proves hydration done)
  await page.waitForSelector('button, select', { timeout: 10_000 });
}

/** Navigate to the Squad page */
export async function gotoSquad(page: Page) {
  await page.goto('/squad');
  await page.waitForSelector('button, select', { timeout: 10_000 });
}

/** Return the provider <select> element */
export function providerSelect(page: Page) {
  return page.locator('select[data-testid="provider-select"], select').first();
}

/** Return the model <select> element */
export function modelSelect(page: Page) {
  return page.locator('select[data-testid="model-select"], select').nth(1);
}

/** Wait until the /api/providers call has settled (i.e. options populated) */
export async function waitForProviders(page: Page) {
  await page.waitForFunction(
    () => {
      const sel = document.querySelectorAll('select');
      // At least one select with more than 1 option means providers loaded
      return Array.from(sel).some((s) => s.options.length > 1);
    },
    { timeout: 10_000 },
  );
}

/** Select a provider by its value string, wait for model dropdown to update */
export async function selectProvider(page: Page, providerId: string) {
  const sel = providerSelect(page);
  await sel.selectOption(providerId);
  // Short pause for model fetch debounce
  await page.waitForTimeout(600);
}

/** Type a message and submit it via the send button or Enter key */
export async function sendManualMessage(page: Page, message: string) {
  const textarea = page.locator('textarea').first();
  await textarea.fill(message);
  // Try dedicated send button first; fallback to Enter
  const sendBtn = page.locator('button[type="submit"], button[aria-label*="send" i], button:has-text("Send")').first();
  const btnVisible = await sendBtn.isVisible().catch(() => false);
  if (btnVisible) {
    await sendBtn.click();
  } else {
    await textarea.press('Enter');
  }
}

/** Assert that the API returns 200 with JSON body */
export async function assertApiJson(page: Page, path: string) {
  const res = await page.request.get(path);
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body;
}
