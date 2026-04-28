/**
 * E2E: Persistence + pipeline payload + failed-send recovery
 *
 * Covers the regressions this branch introduced/fixed:
 * 1. Selected provider/model should persist across reloads
 * 2. Start Pipeline should send provider/model/per-agent model overrides
 * 3. A failed chat request must not permanently disable the chat UI
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoHome, gotoSquad, waitForProviders } from './helpers';

const EMPTY_STATE = {
  concept: '',
  projectDir: '',
  currentPhase: 'concept',
  securityMode: 'fast',
  runGoal: 'full-build',
  runFinalAudit: false,
  stopAfterPhase: 'none',
  pipelineStatus: 'idle',
  resumeAction: 'none',
  activeAgent: '',
  agentStatus: { A: 'idle', B: 'idle', C: 'idle', D: 'idle', E: 'idle', S: 'idle' },
  sessions: {},
  buildComplete: false,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostUsd: 0 },
  runtime: { activeTurn: null },
  events: [],
  auditFindings: [],
  auditDeployPending: false,
  auditActionInFlight: false,
};

async function mockStableAppApis(page: Page) {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('__pw_storage_reset__')) {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.sessionStorage.setItem('__pw_storage_reset__', '1');
    }
  });

  await page.route('**/api/state?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_STATE),
    });
  });

  await page.route('**/api/pending?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pending: [] }),
    });
  });

  await page.route('**/api/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: [
          { id: 'claude-cli', label: 'Claude Code CLI', available: true },
          { id: 'lm-studio', label: 'LM Studio', available: true },
        ],
      }),
    });
  });

  await page.route(/\/api\/models\?provider=claude-cli.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        provider: 'claude-cli',
        models: ['claude-opus-4-6'],
        modelCount: 1,
        usedDiscovery: false,
        fallbackUsed: true,
        resolvedBaseUrl: null,
      }),
    });
  });

  await page.route(/\/api\/models\?provider=lm-studio.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        provider: 'lm-studio',
        models: ['local-model-a', 'local-model-b'],
        modelCount: 2,
        usedDiscovery: true,
        fallbackUsed: false,
        resolvedBaseUrl: 'http://127.0.0.1:1234',
      }),
    });
  });

  await page.route('**/api/provider-config?**', async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id');
    if (id === 'lm-studio') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: { id: 'lm-studio', host: '127.0.0.1', port: 1234, apiKey: '' },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ config: null }),
    });
  });
}

test.describe('Persistence and recovery flows', () => {
  test('selected provider and model persist across reloads on the main page', async ({ page }) => {
    await mockStableAppApis(page);
    await gotoHome(page);
    await waitForProviders(page);

    const providerSelect = page.getByTestId('provider-select');
    const modelSelect = page.getByTestId('model-select');

    await providerSelect.selectOption('lm-studio');
    await expect(modelSelect).toHaveValue('local-model-a');
    await modelSelect.selectOption('local-model-b');

    await expect(providerSelect).toHaveValue('lm-studio');
    await expect(modelSelect).toHaveValue('local-model-b');
    await expect(page.getByText(/endpoint:/i)).toContainText('http://127.0.0.1:1234');

    await page.reload();
    await waitForProviders(page);

    await expect(page.getByTestId('provider-select')).toHaveValue('lm-studio');
    await expect(page.getByTestId('model-select')).toHaveValue('local-model-b');
    await expect(page.getByText(/endpoint:/i)).toContainText('http://127.0.0.1:1234');
  });

  test('start pipeline sends provider, model, and per-agent overrides', async ({ page }) => {
    await mockStableAppApis(page);

    let capturedBody: Record<string, unknown> | null = null;
    await page.route('**/api/start-pipeline', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, projectDir: '/tmp/playwright-pipeline' }),
      });
    });

    await gotoHome(page);
    await waitForProviders(page);

    await page.getByTestId('provider-select').selectOption('lm-studio');
    await expect(page.getByTestId('model-select')).toHaveValue('local-model-a');
    await page.getByTestId('model-select').selectOption('local-model-a');
    await page.getByTestId('agent-model-A').selectOption('local-model-b');
    await page.getByTestId('start-pipeline-button').click();

    await expect.poll(() => Boolean(capturedBody)).toBe(true);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!).toMatchObject({
      modelProvider: 'lm-studio',
      model: 'local-model-a',
      agentModels: {
        A: 'local-model-b',
      },
    });
  });

  test('failed chat requests do not permanently disable the squad chat UI', async ({ page }) => {
    await mockStableAppApis(page);

    let chatCalls = 0;
    await page.route('**/api/chat', async (route) => {
      chatCalls += 1;
      await route.fulfill({
        status: 502,
        contentType: 'text/plain',
        body: 'upstream provider error',
      });
    });

    await gotoSquad(page);
    await waitForProviders(page);

    const textarea = page.locator('textarea').first();
    const sendButton = page.getByRole('button', { name: /^send$/i });

    await textarea.fill('first failing message');
    await sendButton.click();

    await expect(page.getByText(/chat request failed/i)).toBeVisible();
    await expect(textarea).toBeEnabled();
    await expect(sendButton).toBeEnabled();
    await expect.poll(() => chatCalls).toBe(1);

    await textarea.fill('second attempt after failure');
    await sendButton.click();
    await expect.poll(() => chatCalls).toBe(2);
    await expect(textarea).toBeEnabled();
    await expect(sendButton).toBeEnabled();
  });
});
