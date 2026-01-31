import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for Nexus AI E2E tests.
 *
 * Environment variables:
 *   TEST_ENV  - Target environment (default: local)
 *   BASE_URL  - Application base URL
 *   CI        - Set by CI runners to adjust workers/retries
 */
export default defineConfig({
  testDir: path.resolve(__dirname, './tests/e2e'),
  outputDir: path.resolve(__dirname, './test-results'),

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
