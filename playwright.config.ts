import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for the-dev-squad.
 * Runs against the Next.js dev server at http://localhost:3000.
 *
 * Usage:
 *   npm run test:e2e              # headless
 *   npm run test:e2e:ui           # headed with trace viewer
 *   npm run test:e2e -- --project=chromium  # single browser
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // pipeline state is shared; keep sequential
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  /* Start the Next.js dev server automatically when running locally */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
