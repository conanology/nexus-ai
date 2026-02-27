import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexus-ai/core logger
// ---------------------------------------------------------------------------

vi.mock('@nexus-ai/core', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Stagehand mock helpers
// ---------------------------------------------------------------------------

/** Build a mock Stagehand page with configurable behaviour */
function makeMockPage(overrides: Record<string, unknown> = {}) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue('Some normal page content'),
    act: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://example.com/page'),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('PNG_DATA')),
    ...overrides,
  };
}

function makeMockStagehand(pageOverrides: Record<string, unknown> = {}) {
  const page = makeMockPage(pageOverrides);
  return {
    instance: {
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      page,
    },
    page,
    StagehandClass: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('captureWithAgenticBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const dummyPlaywrightPage = {} as import('playwright-core').Page;

  it('returns success with buffer on successful capture', async () => {
    const mock = makeMockStagehand();
    mock.StagehandClass.mockImplementation(() => mock.instance);

    vi.doMock('@browserbasehq/stagehand', () => ({
      Stagehand: mock.StagehandClass,
    }));

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'performance benchmarks',
    );

    expect(result.status).toBe('success');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer!.toString()).toBe('PNG_DATA');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.actionsPerformed.length).toBeGreaterThan(0);
    expect(result.failureReason).toBeUndefined();
  });

  it('returns timeout status when act() exceeds timeout', async () => {
    const mock = makeMockStagehand({
      // act() never resolves — will be beaten by the timeout
      act: vi.fn().mockImplementation(() => new Promise(() => {})),
    });
    mock.StagehandClass.mockImplementation(() => mock.instance);

    vi.doMock('@browserbasehq/stagehand', () => ({
      Stagehand: mock.StagehandClass,
    }));

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'find the chart',
      { timeoutMs: 50 }, // very short timeout
    );

    expect(result.status).toBe('timeout');
    expect(result.buffer).toBeNull();
    expect(result.failureReason).toContain('Timed out');
  });

  it('returns blocked status when CAPTCHA is detected before act()', async () => {
    const mock = makeMockStagehand({
      evaluate: vi.fn().mockResolvedValue('Please verify you are human to continue'),
    });
    mock.StagehandClass.mockImplementation(() => mock.instance);

    vi.doMock('@browserbasehq/stagehand', () => ({
      Stagehand: mock.StagehandClass,
    }));

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'find content',
    );

    expect(result.status).toBe('blocked');
    expect(result.buffer).toBeNull();
    expect(result.failureReason).toContain('CAPTCHA');
    expect(result.actionsPerformed).toContain('detected CAPTCHA/login wall');
  });

  it('returns blocked status when login wall is detected after navigation', async () => {
    let callCount = 0;
    const mock = makeMockStagehand({
      evaluate: vi.fn().mockImplementation(() => {
        callCount++;
        // First call (pre-act): normal content
        if (callCount === 1) return Promise.resolve('Normal page content');
        // Second call (post-act): login wall
        return Promise.resolve('You must sign in to continue viewing this content');
      }),
    });
    mock.StagehandClass.mockImplementation(() => mock.instance);

    vi.doMock('@browserbasehq/stagehand', () => ({
      Stagehand: mock.StagehandClass,
    }));

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'find content',
    );

    expect(result.status).toBe('blocked');
    expect(result.buffer).toBeNull();
    expect(result.failureReason).toContain('login wall');
  });

  it('returns error when domain hop exceeds limit', async () => {
    const mock = makeMockStagehand({
      // After act(), url() returns a different domain
      url: vi.fn().mockReturnValue('https://malicious-redirect.com/page'),
    });
    mock.StagehandClass.mockImplementation(() => mock.instance);

    vi.doMock('@browserbasehq/stagehand', () => ({
      Stagehand: mock.StagehandClass,
    }));

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'find content',
      { maxDomainHops: 0 }, // zero hops allowed
    );

    expect(result.status).toBe('error');
    expect(result.buffer).toBeNull();
    expect(result.failureReason).toContain('domain hops');
    expect(result.actionsPerformed).toEqual(
      expect.arrayContaining([expect.stringContaining('domain hop')]),
    );
  });

  it('returns error gracefully when Stagehand is not installed', async () => {
    vi.doMock('@browserbasehq/stagehand', () => {
      throw new Error('Cannot find module');
    });

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'find content',
    );

    expect(result.status).toBe('error');
    expect(result.buffer).toBeNull();
    expect(result.failureReason).toContain('not installed');
    expect(result.actionsPerformed).toEqual([]);
  });

  it('tracks all actions performed during navigation', async () => {
    const mock = makeMockStagehand();
    mock.StagehandClass.mockImplementation(() => mock.instance);

    vi.doMock('@browserbasehq/stagehand', () => ({
      Stagehand: mock.StagehandClass,
    }));

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'Kubernetes performance metrics',
    );

    expect(result.status).toBe('success');
    expect(result.actionsPerformed).toContain('initialized stagehand');
    expect(result.actionsPerformed).toEqual(
      expect.arrayContaining([expect.stringContaining('navigated to')]),
    );
    expect(result.actionsPerformed).toEqual(
      expect.arrayContaining([expect.stringContaining('acted: find')]),
    );
    expect(result.actionsPerformed).toContain('captured screenshot');
  });

  it('records elapsed time accurately', async () => {
    const mock = makeMockStagehand({
      // Add a small delay to act() to ensure elapsedMs > 0
      act: vi.fn().mockImplementation(() => new Promise((r) => setTimeout(r, 20))),
    });
    mock.StagehandClass.mockImplementation(() => mock.instance);

    vi.doMock('@browserbasehq/stagehand', () => ({
      Stagehand: mock.StagehandClass,
    }));

    const { captureWithAgenticBrowser } = await import('../agentic-browser.js');
    const before = Date.now();
    const result = await captureWithAgenticBrowser(
      dummyPlaywrightPage,
      'https://example.com/page',
      'content',
    );
    const after = Date.now();

    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.elapsedMs).toBeLessThanOrEqual(after - before + 50); // generous margin
  });
});
