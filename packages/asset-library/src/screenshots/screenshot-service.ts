/**
 * Screenshot Service — captures real website screenshots using Playwright.
 *
 * Launches headless Chromium, navigates to URLs, and captures PNG screenshots
 * for use as scene backgrounds in the video pipeline.
 *
 * @module @nexus-ai/asset-library/screenshots/screenshot-service
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  waitForSelector?: string;
  waitMs?: number;
  darkMode?: boolean;
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
}

export interface ScreenshotRequest {
  id: string;
  url: string;
  options?: ScreenshotOptions;
}

// ---------------------------------------------------------------------------
// Browser instance management (lazy singleton)
// ---------------------------------------------------------------------------

let browserInstance: import('playwright-core').Browser | null = null;

async function getBrowser(): Promise<import('playwright-core').Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  try {
    const { chromium } = await import('playwright-core');
    // Launch will find the browser if PLAYWRIGHT_BROWSERS_PATH or default install exists
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  } catch {
    throw new Error(
      'Failed to launch Chromium. Ensure playwright-core is installed and a Chromium browser is available. ' +
      'Run: npx playwright install chromium',
    );
  }

  return browserInstance;
}

/**
 * Close the reusable browser instance. Call when all screenshots are done.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

// ---------------------------------------------------------------------------
// Cookie consent dismissal
// ---------------------------------------------------------------------------

const COOKIE_SELECTORS = [
  '[data-testid="cookie-accept"]',
  '.cookie-accept',
  '#accept-cookies',
  '#onetrust-accept-btn-handler',
  '.cc-accept',
  '[aria-label="Accept cookies"]',
  '[aria-label="Accept all cookies"]',
  '.js-consent-banner button',
  '[data-cookiebanner="accept_button"]',
  '.cky-btn-accept',
];

const COOKIE_BUTTON_TEXTS = [
  'Accept', 'Accept All', 'Accept all', 'OK', 'Got it', 'I agree', 'Allow all',
  'Accept & Continue', 'Agree', 'Consent', 'Close',
];

// ---------------------------------------------------------------------------
// User-Agent (realistic Chrome)
// ---------------------------------------------------------------------------

const REALISTIC_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Page validation — reject Cloudflare challenges, error pages, disambiguation
// ---------------------------------------------------------------------------

const BAD_PAGE_PATTERNS = [
  // Cloudflare / bot detection
  'verify you are human',
  'security verification',
  'challenge-platform',
  'checking your browser',
  'just a moment',
  'enable javascript and cookies',
  // Error pages
  'application error',
  '404 not found',
  'page not found',
  '500 internal server',
  '403 forbidden',
  'access denied',
  // Wikipedia disambiguation
  'may refer to',
  'disambiguation',
];

/**
 * Check if the page body text indicates a bad/useless page.
 * Returns null if the page should be skipped (invalid), the bodyText otherwise.
 */
async function validatePage(page: import('playwright-core').Page): Promise<string | null> {
  try {
    const bodyText = await page.evaluate('document.body?.innerText ?? ""') as string;
    if (bodyText.length < 50) return null;

    const lower = bodyText.toLowerCase();
    for (const pattern of BAD_PAGE_PATTERNS) {
      if (lower.includes(pattern)) return null;
    }
    return bodyText;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Smart scroll to content (past headers/hero images)
// ---------------------------------------------------------------------------

const CONTENT_SELECTORS = ['main', 'article', '#content', '[role="main"]', '.entry-content'];

async function scrollToContent(page: import('playwright-core').Page): Promise<void> {
  for (const selector of CONTENT_SELECTORS) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        // Add a small top margin so it's not flush against top
        await page.evaluate('window.scrollBy(0, -60)');
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // try next
    }
  }
  // Fallback: scroll past typical header area
  await page.evaluate('window.scrollTo(0, 200)');
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// CSS injection — hide cookie/consent banners via style override
// ---------------------------------------------------------------------------

/** CSS selectors targeting major cookie consent frameworks and common patterns */
const COOKIE_HIDE_CSS = `
  [class*="cookie" i], [id*="cookie" i],
  [class*="consent" i], [id*="consent" i],
  [class*="gdpr" i], [id*="gdpr" i],
  [class*="ccpa" i], [id*="ccpa" i],
  .onetrust-consent-sdk, #onetrust-banner-sdk, #onetrust-pc-sdk,
  .cc-window, .cc-banner, .cc-compliance,
  [class*="CookieConsent"], [class*="cookie-banner"],
  [class*="cookie-notice"], [class*="privacy-notice"],
  [role="dialog"][aria-label*="cookie" i],
  [role="dialog"][aria-label*="consent" i],
  .cky-consent-container, .cky-modal,
  #CybotCookiebotDialog, .CybotCookiebotDialogActive,
  #cookie-law-info-bar, .cli-modal,
  [data-nosnippet][class*="banner"],
  .fc-consent-root, .fc-dialog-container
  { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
`.trim();

/**
 * Inject CSS to proactively hide cookie/consent banners.
 * Belt-and-suspenders with the click-based dismissCookieConsent().
 */
async function injectCookieHideCSS(
  page: import('playwright-core').Page,
): Promise<void> {
  try {
    await page.addStyleTag({ content: COOKIE_HIDE_CSS });
  } catch {
    // Non-fatal — click-based handler will still try
  }
}

// ---------------------------------------------------------------------------
// Cookie consent click dismissal
// ---------------------------------------------------------------------------

async function dismissCookieConsent(
  page: import('playwright-core').Page,
): Promise<void> {
  // Try known selectors first
  for (const selector of COOKIE_SELECTORS) {
    try {
      const el = await page.$(selector);
      if (el && await el.isVisible()) {
        await el.click();
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // selector not found, try next
    }
  }

  // Try buttons by text content
  for (const text of COOKIE_BUTTON_TEXTS) {
    try {
      const btn = page.getByRole('button', { name: text, exact: false });
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // not found, try next
    }
  }
}

// ---------------------------------------------------------------------------
// captureWebsiteScreenshot
// ---------------------------------------------------------------------------

/**
 * Capture a screenshot of a website as a PNG buffer.
 *
 * Returns null if navigation fails, the page is blocked, or any error occurs.
 * Reuses a shared browser instance for efficiency.
 */
export async function captureWebsiteScreenshot(
  url: string,
  options: ScreenshotOptions = {},
): Promise<Buffer | null> {
  const {
    width = 1920,
    height = 1080,
    waitForSelector,
    waitMs = 3000,
    darkMode = true,
    fullPage = false,
    clip,
  } = options;

  let context: import('playwright-core').BrowserContext | null = null;

  try {
    const browser = await getBrowser();

    context = await browser.newContext({
      viewport: { width, height },
      colorScheme: darkMode ? 'dark' : 'light',
      locale: 'en-US',
      userAgent: REALISTIC_USER_AGENT,
      // Block unnecessary resources to speed up capture
      bypassCSP: true,
    });

    const page = await context.newPage();

    // Block heavy resources that aren't needed for screenshots
    await page.route('**/*.{mp4,webm,ogg,mp3,wav}', (route) => route.abort());

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 15_000,
    });

    // Wait for additional rendering
    await page.waitForTimeout(waitMs);

    // CSS injection to hide cookie/consent banners (belt-and-suspenders)
    await injectCookieHideCSS(page);

    // Validate page content (reject Cloudflare, error pages, disambiguation)
    const validated = await validatePage(page);
    if (validated === null) {
      console.log(`Screenshot skipped (bad page): ${url}`);
      return null;
    }

    // Try to click-dismiss cookie consent banners (secondary layer)
    await dismissCookieConsent(page);

    // Scroll to main content (past headers/hero banners)
    await scrollToContent(page);

    // Wait for specific selector if provided
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout: 5_000 });
      } catch {
        // Don't fail if selector not found — still capture the page
      }
    }

    // Capture screenshot
    const buffer = await page.screenshot({
      type: 'png',
      fullPage,
      ...(clip ? { clip } : {}),
    });

    const sizeBytes = buffer.length;
    console.log(
      `Screenshot captured: ${url} (${width}x${height}, ${formatBytes(sizeBytes)})`,
    );

    return buffer;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`Screenshot failed: ${url}: ${message}`);
    return null;
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// captureMultipleScreenshots
// ---------------------------------------------------------------------------

/**
 * Capture screenshots for multiple requests sequentially.
 *
 * Processes one at a time (one browser, one page), with a 1-second delay
 * between captures. Closes the browser when done.
 */
export async function captureMultipleScreenshots(
  requests: ScreenshotRequest[],
): Promise<Map<string, Buffer | null>> {
  const results = new Map<string, Buffer | null>();

  if (requests.length === 0) return results;

  try {
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const buffer = await captureWebsiteScreenshot(req.url, req.options);
      results.set(req.id, buffer);

      // Delay between captures (skip after last)
      if (i < requests.length - 1) {
        await sleep(1000);
      }
    }
  } finally {
    await closeBrowser();
  }

  return results;
}

// ---------------------------------------------------------------------------
// screenshotToDataUri
// ---------------------------------------------------------------------------

/**
 * Convert a PNG buffer to a data URI string.
 *
 * If the buffer exceeds 800KB, it's still returned as PNG (no image processing
 * library dependency). The pipeline handles large images gracefully.
 */
export function screenshotToDataUri(buffer: Buffer): string {
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
