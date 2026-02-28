import { afterEach, describe, expect, it } from 'vitest';
import { getRetentionProfile, inferRetentionProfile, getRetentionProfileConfig } from '../retention-profile.js';

const originalEnv = process.env.NEXUS_RETENTION_PROFILE;

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.NEXUS_RETENTION_PROFILE;
  } else {
    process.env.NEXUS_RETENTION_PROFILE = originalEnv;
  }
});

describe('retention profile auto selection', () => {
  it('selects aggressive for high virality topics', () => {
    const profile = inferRetentionProfile({ viralityScore: 92, audioDurationSec: 80, script: 'Breaking shift in AI chips right now' });
    expect(profile).toBe('aggressive');
  });

  it('selects balanced for long low-virality deep dives', () => {
    const profile = inferRetentionProfile({ viralityScore: 0.32, audioDurationSec: 10 * 60, script: 'Long form market analysis and context' });
    expect(profile).toBe('balanced');
  });

  it('defaults to premium for normal conditions', () => {
    const profile = inferRetentionProfile({ viralityScore: 0.6, audioDurationSec: 220, script: 'AI product update and implications' });
    expect(profile).toBe('premium');
  });

  it('uses env override when provided', () => {
    process.env.NEXUS_RETENTION_PROFILE = 'balanced';
    expect(getRetentionProfile({ viralityScore: 99, audioDurationSec: 40, script: 'breaking surge now' })).toBe('balanced');
  });

  it('returns config from inferred context', () => {
    const config = getRetentionProfileConfig({ viralityScore: 0.95, audioDurationSec: 50, script: 'breaking now' });
    expect(config.profile).toBe('aggressive');
    expect(config.targetCadencePerMin).toBeGreaterThanOrEqual(24);
  });
});
