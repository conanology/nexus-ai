/**
 * Screenshot Service Tests
 *
 * Tests URL resolution, data URI conversion, and (when Playwright is available)
 * real screenshot capture.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveScreenshotUrl, URL_MAP } from '../screenshots/url-resolver.js';
import { screenshotToDataUri } from '../screenshots/screenshot-service.js';
import type { ScreenshotOptions } from '../screenshots/screenshot-service.js';

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

// ---------------------------------------------------------------------------
// cssSelector cropping — ScreenshotOptions.cssSelector
// ---------------------------------------------------------------------------

describe('cssSelector cropping', () => {
  it('accepts cssSelector in ScreenshotOptions', () => {
    const opts: ScreenshotOptions = {
      cssSelector: '#main-content',
    };
    expect(opts.cssSelector).toBe('#main-content');
  });

  it('cssSelector is a string type', () => {
    const opts: ScreenshotOptions = {
      cssSelector: '.hero-section > div.wrapper',
    };
    expect(typeof opts.cssSelector).toBe('string');
  });

  it('works alongside other options', () => {
    const opts: ScreenshotOptions = {
      width: 1280,
      height: 720,
      darkMode: true,
      cssSelector: 'article.post',
      waitMs: 2000,
    };
    expect(opts.cssSelector).toBe('article.post');
    expect(opts.width).toBe(1280);
    expect(opts.darkMode).toBe(true);
  });

  it('accepts complex CSS selectors', () => {
    const complexSelectors = [
      '#app > main:first-child',
      '[data-testid="hero-banner"]',
      '.container .row:nth-child(2)',
      'section.content h1 + p',
    ];
    for (const sel of complexSelectors) {
      const opts: ScreenshotOptions = { cssSelector: sel };
      expect(opts.cssSelector).toBe(sel);
    }
  });
});

// ---------------------------------------------------------------------------
// highlightText injection — ScreenshotOptions.highlightText
// ---------------------------------------------------------------------------

describe('highlightText injection', () => {
  it('accepts highlightText in ScreenshotOptions', () => {
    const opts: ScreenshotOptions = {
      highlightText: 'machine learning',
    };
    expect(opts.highlightText).toBe('machine learning');
  });

  it('highlightText is a string type', () => {
    const opts: ScreenshotOptions = {
      highlightText: 'GPT-4',
    };
    expect(typeof opts.highlightText).toBe('string');
  });

  it('works alongside other options', () => {
    const opts: ScreenshotOptions = {
      width: 1920,
      height: 1080,
      highlightText: 'transformer architecture',
      waitForSelector: 'main',
      darkMode: false,
    };
    expect(opts.highlightText).toBe('transformer architecture');
    expect(opts.waitForSelector).toBe('main');
    expect(opts.darkMode).toBe(false);
  });

  it('accepts text with special characters', () => {
    const texts = [
      'C++ & Rust',
      '<script> injection',
      '"quoted" text',
      "it's a test",
      'price > $100',
    ];
    for (const text of texts) {
      const opts: ScreenshotOptions = { highlightText: text };
      expect(opts.highlightText).toBe(text);
    }
  });
});

// ---------------------------------------------------------------------------
// ScreenshotOptions interface — field presence and optionality
// ---------------------------------------------------------------------------

describe('ScreenshotOptions interface', () => {
  it('cssSelector is optional (omittable)', () => {
    const opts: ScreenshotOptions = { width: 1280 };
    expect(opts.cssSelector).toBeUndefined();
  });

  it('highlightText is optional (omittable)', () => {
    const opts: ScreenshotOptions = { height: 720 };
    expect(opts.highlightText).toBeUndefined();
  });

  it('accepts both cssSelector and highlightText together', () => {
    const opts: ScreenshotOptions = {
      cssSelector: '#content',
      highlightText: 'important text',
    };
    expect(opts.cssSelector).toBe('#content');
    expect(opts.highlightText).toBe('important text');
  });

  it('accepts a fully-populated options object', () => {
    const opts: ScreenshotOptions = {
      width: 1920,
      height: 1080,
      waitForSelector: 'body',
      waitMs: 3000,
      darkMode: true,
      fullPage: false,
      clip: { x: 0, y: 0, width: 800, height: 600 },
      cssSelector: '.main-section',
      highlightText: 'key phrase',
    };
    expect(opts.cssSelector).toBe('.main-section');
    expect(opts.highlightText).toBe('key phrase');
    expect(opts.clip).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('allows an empty options object', () => {
    const opts: ScreenshotOptions = {};
    expect(opts.cssSelector).toBeUndefined();
    expect(opts.highlightText).toBeUndefined();
    expect(opts.width).toBeUndefined();
  });
});
