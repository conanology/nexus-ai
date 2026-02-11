/**
 * Screenshot Service Tests
 *
 * Tests URL resolution, data URI conversion, and (when Playwright is available)
 * real screenshot capture.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveScreenshotUrl, URL_MAP } from '../screenshots/url-resolver.js';
import { screenshotToDataUri } from '../screenshots/screenshot-service.js';

// ---------------------------------------------------------------------------
// URL Resolver Tests
// ---------------------------------------------------------------------------

describe('resolveScreenshotUrl', () => {
  it('resolves "klarna" to the correct URL entry', () => {
    const result = resolveScreenshotUrl('klarna');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://www.klarna.com');
    expect(result!.waitForSelector).toBe('main');
  });

  it('resolves case-insensitively: "OPENAI" → openai entry', () => {
    const result = resolveScreenshotUrl('OPENAI');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://openai.com');
  });

  it('resolves case-insensitively: "Stripe" → stripe entry', () => {
    const result = resolveScreenshotUrl('Stripe');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://stripe.com');
  });

  it('returns null for unknown companies', () => {
    const result = resolveScreenshotUrl('unknowncompany');
    expect(result).toBeNull();
  });

  it('resolves aliases: "AWS" → amazon entry', () => {
    const result = resolveScreenshotUrl('AWS');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://aws.amazon.com');
  });

  it('resolves aliases: "ChatGPT" → chatgpt entry', () => {
    const result = resolveScreenshotUrl('ChatGPT');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://chatgpt.com');
  });

  it('resolves aliases: "Claude" → anthropic entry', () => {
    const result = resolveScreenshotUrl('Claude');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://www.anthropic.com');
  });

  it('resolves aliases: "Facebook" → meta entry', () => {
    const result = resolveScreenshotUrl('Facebook');
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://about.meta.com');
  });

  it('has at least 25 entries in URL_MAP', () => {
    expect(Object.keys(URL_MAP).length).toBeGreaterThanOrEqual(25);
  });
});

// ---------------------------------------------------------------------------
// screenshotToDataUri Tests
// ---------------------------------------------------------------------------

describe('screenshotToDataUri', () => {
  it('converts a PNG buffer to a valid data URI', () => {
    // Create a minimal PNG-like buffer
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const testBuffer = Buffer.concat([pngHeader, Buffer.alloc(100, 0xFF)]);

    const result = screenshotToDataUri(testBuffer);

    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(result.length).toBeGreaterThan('data:image/png;base64,'.length);
  });

  it('produces valid base64 that round-trips', () => {
    const original = Buffer.from('test-screenshot-data');
    const dataUri = screenshotToDataUri(original);

    // Extract base64 part and decode
    const base64 = dataUri.replace('data:image/png;base64,', '');
    const decoded = Buffer.from(base64, 'base64');

    expect(decoded.toString()).toBe('test-screenshot-data');
  });
});

// ---------------------------------------------------------------------------
// Live Screenshot Test (requires Playwright + Chromium)
// ---------------------------------------------------------------------------

describe('captureWebsiteScreenshot (live)', () => {
  let canRunPlaywright = false;

  beforeEach(async () => {
    try {
      const { chromium } = await import('playwright-core');
      // Check if a browser executable is available
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      canRunPlaywright = true;
    } catch {
      canRunPlaywright = false;
    }
  }, 30_000); // Chromium launch can be slow

  it('captures a real screenshot of example.com', async () => {
    if (!canRunPlaywright) {
      console.log('Skipping live screenshot test: Playwright/Chromium not available');
      return;
    }

    const { captureWebsiteScreenshot, closeBrowser } = await import(
      '../screenshots/screenshot-service.js'
    );

    try {
      const buffer = await captureWebsiteScreenshot('https://example.com', {
        width: 1280,
        height: 720,
        waitMs: 1000,
        darkMode: false,
      });

      expect(buffer).not.toBeNull();
      expect(buffer!.length).toBeGreaterThan(10_000); // Real screenshot > 10KB

      // Verify PNG header: 0x89 P N G
      expect(buffer![0]).toBe(0x89);
      expect(buffer![1]).toBe(0x50);
      expect(buffer![2]).toBe(0x4E);
      expect(buffer![3]).toBe(0x47);
    } finally {
      await closeBrowser();
    }
  }, 30_000); // 30s timeout for network

  it('returns null for an unreachable URL', async () => {
    if (!canRunPlaywright) {
      console.log('Skipping live screenshot test: Playwright/Chromium not available');
      return;
    }

    const { captureWebsiteScreenshot, closeBrowser } = await import(
      '../screenshots/screenshot-service.js'
    );

    try {
      const buffer = await captureWebsiteScreenshot(
        'https://this-domain-definitely-does-not-exist-12345.com',
        { waitMs: 500 },
      );

      expect(buffer).toBeNull();
    } finally {
      await closeBrowser();
    }
  }, 30_000);
});
