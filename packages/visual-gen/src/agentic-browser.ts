/**
 * Agentic Browser — Stagehand-based intelligent screenshot capture fallback.
 *
 * When static CSS selectors fail, this module uses Stagehand's natural language
 * navigation to autonomously find and capture the target content.
 *
 * @module @nexus-ai/visual-gen/agentic-browser
 */

import { logger } from '@nexus-ai/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Playwright Page interface for type-safe parameter passing */
interface PlaywrightPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(options?: Record<string, unknown>): Promise<Buffer>;
  url(): string;
}

export interface AgenticCaptureResult {
  buffer: Buffer | null;
  status: 'success' | 'timeout' | 'blocked' | 'error';
  elapsedMs: number;
  actionsPerformed: string[];
  failureReason?: string;
}

interface AgenticCaptureOptions {
  timeoutMs?: number;
  maxDomainHops?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_DOMAIN_HOPS = 1;

/** Patterns indicating CAPTCHA or login wall */
const BLOCKED_PATTERNS = [
  'captcha',
  'recaptcha',
  'hcaptcha',
  'verify you are human',
  'are you a robot',
  'sign in to continue',
  'log in to continue',
  'login required',
  'please sign in',
  'access denied',
  'forbidden',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function isBlocked(bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return BLOCKED_PATTERNS.some((p) => lower.includes(p));
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Attempt to capture a screenshot using Stagehand's agentic browser.
 *
 * Uses natural language instructions to navigate the page and find
 * the target content when CSS selectors fail.
 *
 * @param page - Existing Playwright page (already navigated to the URL)
 * @param url - Target URL (for domain hop detection)
 * @param searchObjective - What to find (from scene narration content)
 * @param options - Timeout and domain hop configuration
 * @returns Capture result with screenshot buffer or failure details
 */
export async function captureWithAgenticBrowser(
  _page: PlaywrightPage,
  url: string,
  searchObjective: string,
  options?: AgenticCaptureOptions,
): Promise<AgenticCaptureResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxDomainHops = options?.maxDomainHops ?? DEFAULT_MAX_DOMAIN_HOPS;
  const startTime = Date.now();
  const actions: string[] = [];

  // Step 1: Try to import Stagehand
  let Stagehand: any;
  try {
    const mod = await import('@browserbasehq/stagehand');
    Stagehand = mod.Stagehand ?? mod.default;
  } catch {
    logger.warn('Stagehand not installed — agentic browser fallback unavailable');
    return {
      buffer: null,
      status: 'error',
      elapsedMs: Date.now() - startTime,
      actionsPerformed: [],
      failureReason: 'Stagehand package not installed',
    };
  }

  if (!Stagehand) {
    return {
      buffer: null,
      status: 'error',
      elapsedMs: Date.now() - startTime,
      actionsPerformed: [],
      failureReason: 'Stagehand export not found',
    };
  }

  // Step 2: Initialize Stagehand with the existing page's browser context
  let stagehand: any;
  try {
    stagehand = new Stagehand({
      env: 'LOCAL',
      enableCaching: false,
    });
    await stagehand.init();
    actions.push('initialized stagehand');

    // Navigate Stagehand's page to the same URL
    await stagehand.page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });
    actions.push(`navigated to ${url}`);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ url, error: msg }, 'Stagehand initialization failed');
    return {
      buffer: null,
      status: 'error',
      elapsedMs: elapsed,
      actionsPerformed: actions,
      failureReason: `Stagehand init failed: ${msg}`,
    };
  }

  const originalOrigin = getOrigin(url);
  let domainHops = 0;

  try {
    // Step 3: Check for CAPTCHA/login wall before acting
    const bodyText = await stagehand.page.evaluate('document.body?.innerText ?? ""') as string;
    if (isBlocked(bodyText)) {
      actions.push('detected CAPTCHA/login wall');
      return {
        buffer: null,
        status: 'blocked',
        elapsedMs: Date.now() - startTime,
        actionsPerformed: actions,
        failureReason: 'Page blocked by CAPTCHA or login wall',
      };
    }

    // Step 4: Use act() with timeout to navigate to the objective
    const actPromise = stagehand.page.act({
      action: `Find and scroll to the section about: ${searchObjective}. If you see a relevant element, click on it to reveal more detail.`,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Agentic browser timeout')), timeoutMs);
    });

    try {
      await Promise.race([actPromise, timeoutPromise]);
      actions.push(`acted: find "${searchObjective.slice(0, 60)}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timeout')) {
        return {
          buffer: null,
          status: 'timeout',
          elapsedMs: Date.now() - startTime,
          actionsPerformed: actions,
          failureReason: `Timed out after ${timeoutMs}ms`,
        };
      }
      throw err;
    }

    // Step 5: Check domain hop
    const currentUrl = stagehand.page.url();
    const currentOrigin = getOrigin(currentUrl);
    if (currentOrigin !== originalOrigin) {
      domainHops++;
      actions.push(`domain hop: ${originalOrigin} → ${currentOrigin}`);

      if (domainHops > maxDomainHops) {
        return {
          buffer: null,
          status: 'error',
          elapsedMs: Date.now() - startTime,
          actionsPerformed: actions,
          failureReason: `Exceeded max domain hops (${maxDomainHops})`,
        };
      }
    }

    // Step 6: Check for CAPTCHA after navigation
    const postActBody = await stagehand.page.evaluate('document.body?.innerText ?? ""') as string;
    if (isBlocked(postActBody)) {
      actions.push('detected CAPTCHA/login wall after navigation');
      return {
        buffer: null,
        status: 'blocked',
        elapsedMs: Date.now() - startTime,
        actionsPerformed: actions,
        failureReason: 'Blocked by CAPTCHA or login wall after navigation',
      };
    }

    // Step 7: Capture screenshot
    await stagehand.page.waitForTimeout(500);
    const buffer = await stagehand.page.screenshot({ type: 'png' });
    actions.push('captured screenshot');

    logger.info(
      { url, elapsedMs: Date.now() - startTime, actionsCount: actions.length },
      '[AgenticBrowser] Capture successful',
    );

    return {
      buffer,
      status: 'success',
      elapsedMs: Date.now() - startTime,
      actionsPerformed: actions,
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ url, error: msg, elapsed }, '[AgenticBrowser] Capture failed');

    return {
      buffer: null,
      status: 'error',
      elapsedMs: elapsed,
      actionsPerformed: actions,
      failureReason: msg,
    };
  } finally {
    try {
      await stagehand.close();
    } catch {
      // cleanup silently
    }
  }
}
