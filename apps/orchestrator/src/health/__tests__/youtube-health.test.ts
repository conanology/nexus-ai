/**
 * Tests for YouTube API health check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkYouTubeHealth, getQuotaAlertLevel } from '../youtube-health.js';

// Mock dependencies
vi.mock('@nexus-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nexus-ai/core')>();
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

vi.mock('@google-cloud/monitoring', () => ({
  MetricServiceClient: vi.fn(),
}));

describe('checkYouTubeHealth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NEXUS_PROJECT_ID: 'test-project' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should return healthy status when quota is below 60%', async () => {
    const { MetricServiceClient } = await import('@google-cloud/monitoring');

    (MetricServiceClient as any).mockImplementation(() => ({
      listTimeSeries: vi.fn().mockResolvedValue([
        [
          {
            points: [
              {
                value: { int64Value: 5000 }, // 50% of 10000
              },
            ],
          },
        ],
      ]),
    }));

    const result = await checkYouTubeHealth();

    expect(result.service).toBe('youtube');
    expect(result.status).toBe('healthy');
    expect(result.metadata?.percentage).toBe(50);
    expect(result.metadata?.quotaUsed).toBe(5000);
  });

  it('should return degraded status when quota is between 60% and 80%', async () => {
    const { MetricServiceClient } = await import('@google-cloud/monitoring');

    (MetricServiceClient as any).mockImplementation(() => ({
      listTimeSeries: vi.fn().mockResolvedValue([
        [
          {
            points: [
              {
                value: { int64Value: 7000 }, // 70% of 10000
              },
            ],
          },
        ],
      ]),
    }));

    const result = await checkYouTubeHealth();

    expect(result.service).toBe('youtube');
    expect(result.status).toBe('degraded');
    expect(result.metadata?.percentage).toBe(70);
  });

  it('should return failed status when quota is at or above 95%', async () => {
    const { MetricServiceClient } = await import('@google-cloud/monitoring');

    (MetricServiceClient as any).mockImplementation(() => ({
      listTimeSeries: vi.fn().mockResolvedValue([
        [
          {
            points: [
              {
                value: { int64Value: 9600 }, // 96% of 10000
              },
            ],
          },
        ],
      ]),
    }));

    const result = await checkYouTubeHealth();

    expect(result.service).toBe('youtube');
    expect(result.status).toBe('failed');
    expect(result.metadata?.percentage).toBe(96);
  });

  it('should return failed status when project ID is not set', async () => {
    delete process.env.NEXUS_PROJECT_ID;

    const result = await checkYouTubeHealth();

    expect(result.service).toBe('youtube');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('NEXUS_PROJECT_ID');
  });

  it('should return failed status when Cloud Monitoring API fails', async () => {
    const { MetricServiceClient } = await import('@google-cloud/monitoring');

    (MetricServiceClient as any).mockImplementation(() => ({
      listTimeSeries: vi.fn().mockRejectedValue(new Error('API Error')),
    }));

    const result = await checkYouTubeHealth();

    expect(result.service).toBe('youtube');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('API Error');
  });

  it('should handle empty time series response', async () => {
    const { MetricServiceClient } = await import('@google-cloud/monitoring');

    (MetricServiceClient as any).mockImplementation(() => ({
      listTimeSeries: vi.fn().mockResolvedValue([[]]),
    }));

    const result = await checkYouTubeHealth();

    expect(result.service).toBe('youtube');
    expect(result.status).toBe('healthy');
    expect(result.metadata?.quotaUsed).toBe(0);
    expect(result.metadata?.percentage).toBe(0);
  });
});

describe('getQuotaAlertLevel', () => {
  it('should return null when quota is below 80%', () => {
    expect(getQuotaAlertLevel(50)).toBeNull();
    expect(getQuotaAlertLevel(79)).toBeNull();
  });

  it('should return WARNING when quota is between 80% and 95%', () => {
    const result = getQuotaAlertLevel(85);

    expect(result).not.toBeNull();
    expect(result?.severity).toBe('WARNING');
    expect(result?.message).toContain('85.0%');
    expect(result?.message).toContain('Approaching limit');
  });

  it('should return CRITICAL when quota is at or above 95%', () => {
    const result = getQuotaAlertLevel(96);

    expect(result).not.toBeNull();
    expect(result?.severity).toBe('CRITICAL');
    expect(result?.message).toContain('96.0%');
    expect(result?.message).toContain('will be skipped');
  });

  it('should return WARNING at exactly 80%', () => {
    const result = getQuotaAlertLevel(80);

    expect(result?.severity).toBe('WARNING');
  });

  it('should return CRITICAL at exactly 95%', () => {
    const result = getQuotaAlertLevel(95);

    expect(result?.severity).toBe('CRITICAL');
  });
});
