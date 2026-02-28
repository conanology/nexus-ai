import { describe, expect, it } from 'vitest';
import { buildAssetCaptureStrategy } from '../asset-intelligence.js';

describe('buildAssetCaptureStrategy', () => {
  it('classifies X/Twitter status URLs as tweet and normalizes to vxtwitter', () => {
    const strategy = buildAssetCaptureStrategy('https://x.com/user/status/1234567890', 'According to this tweet...');

    expect(strategy.isScreenshottable).toBe(true);
    expect(strategy.sourceKind).toBe('tweet');
    expect(strategy.normalizedUrl).toContain('vxtwitter.com/user/status/1234567890');
    expect(strategy.displayMode).toBe('foreground');
  });

  it('classifies GitHub repo URLs as repository with repo-friendly defaults', () => {
    const strategy = buildAssetCaptureStrategy('https://github.com/vercel/next.js');

    expect(strategy.isScreenshottable).toBe(true);
    expect(strategy.sourceKind).toBe('repository');
    expect(strategy.waitMs).toBeGreaterThanOrEqual(5000);
    expect(strategy.cssSelector).toBe('main');
  });

  it('blocks paywalled/unsupported domains from capture', () => {
    const strategy = buildAssetCaptureStrategy('https://www.nytimes.com/2026/01/01/technology/example.html');

    expect(strategy.isScreenshottable).toBe(false);
    expect(strategy.blockedReason).toBe('blocked-domain');
  });

  it('classifies arXiv URLs as paper sources', () => {
    const strategy = buildAssetCaptureStrategy('https://arxiv.org/abs/2501.12345', 'New paper shows...');

    expect(strategy.isScreenshottable).toBe(true);
    expect(strategy.sourceKind).toBe('paper');
    expect(strategy.displayMode).toBe('foreground');
  });
});
