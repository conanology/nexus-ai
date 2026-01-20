/**
 * Tests for performHealthCheck orchestration function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  performHealthCheck,
  hasCriticalFailures,
  getHealthCheckSummary,
} from '../perform-health-check.js';

// Mock all health checkers
vi.mock('../gemini-health.js', () => ({
  checkGeminiHealth: vi.fn(),
}));

vi.mock('../youtube-health.js', () => ({
  checkYouTubeHealth: vi.fn(),
}));

vi.mock('../twitter-health.js', () => ({
  checkTwitterHealth: vi.fn(),
}));

vi.mock('../firestore-health.js', () => ({
  checkFirestoreHealth: vi.fn(),
}));

vi.mock('../storage-health.js', () => ({
  checkStorageHealth: vi.fn(),
}));

vi.mock('../secrets-health.js', () => ({
  checkSecretsHealth: vi.fn(),
}));

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nexus-ai/core')>();
  return {
    ...actual,
    FirestoreClient: vi.fn().mockImplementation(() => ({
      setDocument: vi.fn().mockResolvedValue(undefined),
    })),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

describe('performHealthCheck', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up default mocks for all health checkers
    const { checkGeminiHealth } = await import('../gemini-health.js');
    const { checkYouTubeHealth } = await import('../youtube-health.js');
    const { checkTwitterHealth } = await import('../twitter-health.js');
    const { checkFirestoreHealth } = await import('../firestore-health.js');
    const { checkStorageHealth } = await import('../storage-health.js');
    const { checkSecretsHealth } = await import('../secrets-health.js');

    (checkGeminiHealth as any).mockResolvedValue({
      service: 'gemini',
      status: 'healthy',
      latencyMs: 100,
    });

    (checkYouTubeHealth as any).mockResolvedValue({
      service: 'youtube',
      status: 'healthy',
      latencyMs: 200,
      metadata: { quotaUsed: 1000, quotaLimit: 10000, percentage: 10 },
    });

    (checkTwitterHealth as any).mockResolvedValue({
      service: 'twitter',
      status: 'healthy',
      latencyMs: 150,
    });

    (checkFirestoreHealth as any).mockResolvedValue({
      service: 'firestore',
      status: 'healthy',
      latencyMs: 50,
    });

    (checkStorageHealth as any).mockResolvedValue({
      service: 'cloud-storage',
      status: 'healthy',
      latencyMs: 75,
    });

    (checkSecretsHealth as any).mockResolvedValue({
      service: 'secret-manager',
      status: 'healthy',
      latencyMs: 25,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return allPassed true when all services are healthy', async () => {
    const result = await performHealthCheck('2026-01-20');

    expect(result.allPassed).toBe(true);
    expect(result.criticalFailures).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.checks).toHaveLength(6);
  });

  it('should include all 6 service checks', async () => {
    const result = await performHealthCheck('2026-01-20');

    const services = result.checks.map((c) => c.service);
    expect(services).toContain('gemini');
    expect(services).toContain('youtube');
    expect(services).toContain('twitter');
    expect(services).toContain('firestore');
    expect(services).toContain('cloud-storage');
    expect(services).toContain('secret-manager');
  });

  it('should return allPassed false when critical service fails', async () => {
    const { checkGeminiHealth } = await import('../gemini-health.js');

    (checkGeminiHealth as any).mockResolvedValue({
      service: 'gemini',
      status: 'failed',
      latencyMs: 30000,
      error: 'API unavailable',
    });

    const result = await performHealthCheck('2026-01-20');

    expect(result.allPassed).toBe(false);
    expect(result.criticalFailures).toContain('gemini');
  });

  it('should return allPassed true when non-critical service fails', async () => {
    const { checkTwitterHealth } = await import('../twitter-health.js');

    (checkTwitterHealth as any).mockResolvedValue({
      service: 'twitter',
      status: 'failed',
      latencyMs: 5000,
      error: 'Rate limited',
    });

    const result = await performHealthCheck('2026-01-20');

    expect(result.allPassed).toBe(true);
    expect(result.criticalFailures).toHaveLength(0);
    expect(result.warnings).toContain('twitter');
  });

  it('should add degraded services to warnings', async () => {
    const { checkStorageHealth } = await import('../storage-health.js');

    (checkStorageHealth as any).mockResolvedValue({
      service: 'cloud-storage',
      status: 'degraded',
      latencyMs: 500,
      error: 'Slow response',
    });

    const result = await performHealthCheck('2026-01-20');

    expect(result.allPassed).toBe(true);
    expect(result.warnings).toContain('cloud-storage');
  });

  it('should include timestamp in result', async () => {
    const result = await performHealthCheck('2026-01-20');

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('should include totalDurationMs in result', async () => {
    const result = await performHealthCheck('2026-01-20');

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle rejected promises from health checkers', async () => {
    const { checkGeminiHealth } = await import('../gemini-health.js');

    (checkGeminiHealth as any).mockRejectedValue(new Error('Unexpected error'));

    const result = await performHealthCheck('2026-01-20');

    expect(result.allPassed).toBe(false);
    expect(result.criticalFailures).toContain('gemini');

    const geminiCheck = result.checks.find((c) => c.service === 'gemini');
    expect(geminiCheck?.status).toBe('failed');
    expect(geminiCheck?.error).toContain('Unexpected error');
  });

  it('should store results in Firestore', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    await performHealthCheck('2026-01-20');

    const mockInstance = (FirestoreClient as any).mock.results[0].value;
    expect(mockInstance.setDocument).toHaveBeenCalledWith(
      'pipelines/2026-01-20',
      'health',
      expect.objectContaining({
        pipelineId: '2026-01-20',
        allPassed: true,
      })
    );
  });

  it('should continue even if Firestore storage fails', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    (FirestoreClient as any).mockImplementation(() => ({
      setDocument: vi.fn().mockRejectedValue(new Error('Storage error')),
    }));

    const result = await performHealthCheck('2026-01-20');

    // Should still return valid result
    expect(result.allPassed).toBe(true);
    expect(result.checks).toHaveLength(6);
  });

  it('should track multiple critical failures', async () => {
    const { checkGeminiHealth } = await import('../gemini-health.js');
    const { checkYouTubeHealth } = await import('../youtube-health.js');
    const { checkFirestoreHealth } = await import('../firestore-health.js');

    (checkGeminiHealth as any).mockResolvedValue({
      service: 'gemini',
      status: 'failed',
      latencyMs: 100,
      error: 'Failed',
    });

    (checkYouTubeHealth as any).mockResolvedValue({
      service: 'youtube',
      status: 'failed',
      latencyMs: 100,
      error: 'Failed',
      metadata: { quotaUsed: 0, quotaLimit: 10000, percentage: 0 },
    });

    (checkFirestoreHealth as any).mockResolvedValue({
      service: 'firestore',
      status: 'failed',
      latencyMs: 100,
      error: 'Failed',
    });

    const result = await performHealthCheck('2026-01-20');

    expect(result.allPassed).toBe(false);
    expect(result.criticalFailures).toHaveLength(3);
    expect(result.criticalFailures).toContain('gemini');
    expect(result.criticalFailures).toContain('youtube');
    expect(result.criticalFailures).toContain('firestore');
  });
});

describe('hasCriticalFailures', () => {
  it('should return true when criticalFailures is not empty', () => {
    const result = {
      timestamp: new Date().toISOString(),
      allPassed: false,
      checks: [],
      criticalFailures: ['gemini'] as any,
      warnings: [],
      totalDurationMs: 100,
    };

    expect(hasCriticalFailures(result)).toBe(true);
  });

  it('should return false when criticalFailures is empty', () => {
    const result = {
      timestamp: new Date().toISOString(),
      allPassed: true,
      checks: [],
      criticalFailures: [] as any,
      warnings: [],
      totalDurationMs: 100,
    };

    expect(hasCriticalFailures(result)).toBe(false);
  });
});

describe('getHealthCheckSummary', () => {
  it('should return healthy summary when all pass', () => {
    const result = {
      timestamp: new Date().toISOString(),
      allPassed: true,
      checks: new Array(6).fill({ service: 'gemini', status: 'healthy', latencyMs: 100 }),
      criticalFailures: [] as any,
      warnings: [] as any,
      totalDurationMs: 500,
    };

    const summary = getHealthCheckSummary(result);

    expect(summary).toContain('All 6 services healthy');
    expect(summary).toContain('500ms');
  });

  it('should include warnings in summary', () => {
    const result = {
      timestamp: new Date().toISOString(),
      allPassed: true,
      checks: new Array(6).fill({ service: 'gemini', status: 'healthy', latencyMs: 100 }),
      criticalFailures: [] as any,
      warnings: ['cloud-storage'] as any,
      totalDurationMs: 500,
    };

    const summary = getHealthCheckSummary(result);

    expect(summary).toContain('5 healthy');
    expect(summary).toContain('1 degraded');
    expect(summary).toContain('cloud-storage');
  });

  it('should show critical failures in summary', () => {
    const result = {
      timestamp: new Date().toISOString(),
      allPassed: false,
      checks: new Array(6).fill({ service: 'gemini', status: 'healthy', latencyMs: 100 }),
      criticalFailures: ['gemini', 'youtube'] as any,
      warnings: ['twitter'] as any,
      totalDurationMs: 500,
    };

    const summary = getHealthCheckSummary(result);

    expect(summary).toContain('CRITICAL');
    expect(summary).toContain('2 failed');
    expect(summary).toContain('gemini');
    expect(summary).toContain('youtube');
  });
});
