import { describe, expect, it } from 'vitest';
import { deriveSourceBadgeOverlay } from '../source-badge.js';

describe('deriveSourceBadgeOverlay', () => {
  it('returns repo badge details for github repo URL', () => {
    const badge = deriveSourceBadgeOverlay('https://github.com/vercel/next.js');
    expect(badge).not.toBeNull();
    expect(badge?.sourceKind).toBe('repository');
    expect(badge?.sourceName).toBe('vercel/next.js');
    expect(badge?.detail).toBe('github.com');
  });

  it('returns tweet badge details for x status URL', () => {
    const badge = deriveSourceBadgeOverlay('https://x.com/rauchg/status/123456789');
    expect(badge).not.toBeNull();
    expect(badge?.sourceKind).toBe('tweet');
    expect(badge?.sourceName).toBe('@rauchg');
    expect(badge?.icon).toBe('𝕏');
  });
});
