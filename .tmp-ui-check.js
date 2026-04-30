const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3004';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const badResponses = [];
  const stateResponses = [];
  const modelResponses = [];

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/state')) stateResponses.push({ url, status });
    if (url.includes('/api/models')) modelResponses.push({ url, status });
    if (status >= 400) badResponses.push({ url, status });
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Manual$/i }).click();
  await page.getByText('Planner').nth(0).click();
  const officeInput = page.getByPlaceholder(/Message Planner from the main box/i);
  await officeInput.waitFor({ state: 'visible', timeout: 15000 });
  await officeInput.fill('Office browser test ping to Planner.');
  await page.getByRole('button', { name: /^Send$/i }).first().click();
  await page.locator('text=You: Office browser test ping to Planner.').waitFor({ state: 'visible', timeout: 20000 });

  await page.getByRole('link', { name: /Open Squad View/i }).click();
  await page.getByText('Supervisor-first dev team').waitFor({ state: 'visible', timeout: 15000 });

  const providerSelect = page.locator('select[title="Provider"]').first();
  const modelSelect = page.locator('select[title="Model"]').first();
  const refreshButton = page.getByRole('button', { name: /Refresh Models/i }).first();
  const providerBox = await providerSelect.boundingBox();
  const modelBox = await modelSelect.boundingBox();
  const refreshBox = await refreshButton.boundingBox();

  await page.getByRole('button', { name: /^Manual$/i }).click();
  await page.getByRole('button', { name: /Planner/i }).first().click();
  const squadInput = page.getByPlaceholder(/Message Planner directly/i);
  await squadInput.waitFor({ state: 'visible', timeout: 15000 });
  await squadInput.fill('Squad browser test ping to Planner.');
  await page.getByRole('button', { name: /^Send$/i }).last().click();
  await page.locator('text=You: Squad browser test ping to Planner.').waitFor({ state: 'visible', timeout: 20000 });

  await providerSelect.selectOption('openwebui');
  await page.waitForTimeout(3000);

  const output = {
    squadControls: {
      providerY: providerBox?.y ?? null,
      modelY: modelBox?.y ?? null,
      refreshX: refreshBox?.x ?? null,
      stacked: !!providerBox && !!modelBox ? modelBox.y > providerBox.y + providerBox.height / 2 : false,
      refreshRightOfInputs: !!providerBox && !!refreshBox ? refreshBox.x > providerBox.x + providerBox.width / 2 : false,
    },
    error401s: badResponses.filter((entry) => entry.status === 401),
    badResponses: badResponses.slice(-20),
    recentStateCount: stateResponses.slice(-12).length,
    recentModelCount: modelResponses.slice(-12).length,
  };

  console.log(JSON.stringify(output, null, 2));
  await browser.close();
})();
