import { test, expect } from '@playwright/test';

test.describe('Example Test Suite', () => {
  test('should verify Playwright is working', async ({ page }) => {
    // Navigate to a known public page to confirm the framework runs
    await page.goto('https://playwright.dev/');
    await expect(page).toHaveTitle(/Playwright/);
  });

  test('should demonstrate network-first pattern', async ({ page }) => {
    // Step 1: Register interception BEFORE navigation
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('playwright.dev') && resp.status() === 200,
    );

    // Step 2: Trigger navigation
    await page.goto('https://playwright.dev/');

    // Step 3: Await the response
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test('should demonstrate route mocking', async ({ page }) => {
    // Mock an API endpoint before navigation
    await page.route('**/api/health', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', uptime: 12345 }),
      }),
    );

    // Navigate and call the mocked endpoint via page evaluation
    await page.goto('https://playwright.dev/');
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/health');
      return resp.json();
    });

    expect(result).toEqual({ status: 'ok', uptime: 12345 });
  });
});
