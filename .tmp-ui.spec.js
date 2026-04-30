const { test, expect } = require('playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3004';

test('office and squad manual messaging and provider controls behave sanely', async ({ page }) => {
  const badResponses = [];
  const stateResponses = [];
  const modelResponses = [];

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/state')) stateResponses.push({ url, status });
    if (url.includes('/api/models')) modelResponses.push({ url, status });
    if (status >= 400) {
      badResponses.push({ url, status });
    }
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Office View')).toBeVisible();

  await page.getByRole('button', { name: /^Manual$/i }).click();
  await page.getByText('Planner').nth(0).click();
  const officeInput = page.getByPlaceholder(/Message Planner from the main box/i);
  await expect(officeInput).toBeVisible();
  await officeInput.fill('Office browser test ping to Planner.');
  await page.getByRole('button', { name: /^Send$/i }).first().click();
  await expect(page.locator('text=You: Office browser test ping to Planner.')).toBeVisible({ timeout: 20000 });

  await page.getByRole('link', { name: /Open Squad View/i }).click();
  await expect(page.getByText('Supervisor-first dev team')).toBeVisible();

  const providerSelect = page.locator('select[title="Provider"]').first();
  const modelSelect = page.locator('select[title="Model"]').first();
  const refreshButton = page.getByRole('button', { name: /Refresh Models/i }).first();
  const providerBox = await providerSelect.boundingBox();
  const modelBox = await modelSelect.boundingBox();
  const refreshBox = await refreshButton.boundingBox();

  if (!providerBox || !modelBox || !refreshBox) {
    throw new Error('Could not resolve Squad control bounding boxes');
  }

  console.log(JSON.stringify({
    squadControls: {
      providerY: providerBox.y,
      modelY: modelBox.y,
      refreshX: refreshBox.x,
      stacked: modelBox.y > providerBox.y + providerBox.height / 2,
      refreshRightOfInputs: refreshBox.x > providerBox.x + providerBox.width / 2,
    },
  }, null, 2));

  await page.getByRole('button', { name: /^Manual$/i }).click();
  await page.getByRole('button', { name: /Planner/i }).first().click();
  const squadInput = page.getByPlaceholder(/Message Planner directly/i);
  await expect(squadInput).toBeVisible();
  await squadInput.fill('Squad browser test ping to Planner.');
  await page.getByRole('button', { name: /^Send$/i }).last().click();
  await expect(page.locator('text=You: Squad browser test ping to Planner.')).toBeVisible({ timeout: 20000 });

  await providerSelect.selectOption('openwebui');
  await page.waitForTimeout(2500);

  const error401s = badResponses.filter((entry) => entry.status === 401);
  const recentState = stateResponses.slice(-12);
  const recentModels = modelResponses.slice(-12);

  console.log(JSON.stringify({
    recentStateCount: recentState.length,
    recentModelCount: recentModels.length,
    error401s,
  }, null, 2));

  expect(error401s.length).toBe(0);
  expect(modelBox.y).toBeGreaterThan(providerBox.y);
  expect(refreshBox.x).toBeGreaterThan(providerBox.x + providerBox.width / 2);
});
