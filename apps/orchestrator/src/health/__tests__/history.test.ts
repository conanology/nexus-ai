/**
 * Tests for health history functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHealthHistory, getQuickHealthStatus } from '../history.js';

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nexus-ai/core')>();
  return {
    ...actual,
    FirestoreClient: vi.fn(),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

describe('getHealthHistory', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return empty summary when no health checks found', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(null),
    }));

    const result = await getHealthHistory(7);

    expect(result.totalChecks).toBe(0);
    expect(result.overallHealth).toBe(100);
    expect(result.recurringIssues).toHaveLength(0);
  });

  it('should aggregate health checks correctly', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockHealthChecks = [
      {
        pipelineId: '2026-01-18',
        timestamp: '2026-01-18T06:00:00.000Z',
        allPassed: true,
        checks: [
          { service: 'gemini', status: 'healthy', latencyMs: 100 },
          { service: 'youtube', status: 'healthy', latencyMs: 200 },
          { service: 'twitter', status: 'healthy', latencyMs: 150 },
          { service: 'firestore', status: 'healthy', latencyMs: 50 },
          { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
          { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
        ],
        criticalFailures: [],
        warnings: [],
        totalDurationMs: 500,
      },
      {
        pipelineId: '2026-01-19',
        timestamp: '2026-01-19T06:00:00.000Z',
        allPassed: false,
        checks: [
          { service: 'gemini', status: 'failed', latencyMs: 30000, error: 'Timeout' },
          { service: 'youtube', status: 'healthy', latencyMs: 200 },
          { service: 'twitter', status: 'healthy', latencyMs: 150 },
          { service: 'firestore', status: 'healthy', latencyMs: 50 },
          { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
          { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
        ],
        criticalFailures: ['gemini'],
        warnings: [],
        totalDurationMs: 30500,
      },
    ];

    let callCount = 0;
    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockImplementation(() => {
        const doc = mockHealthChecks[callCount % mockHealthChecks.length];
        callCount++;
        return Promise.resolve(doc);
      }),
    }));

    const result = await getHealthHistory(2);

    expect(result.totalChecks).toBe(3);
    expect(result.services.gemini?.failures).toBeGreaterThan(0);
    expect(result.services.gemini?.uptimePercentage).toBeLessThan(100);
    expect(result.services.youtube?.uptimePercentage).toBe(100);
  });

  it('should calculate average latency correctly', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockHealthCheck = {
      pipelineId: '2026-01-20',
      timestamp: '2026-01-20T06:00:00.000Z',
      allPassed: true,
      checks: [
        { service: 'gemini', status: 'healthy', latencyMs: 100 },
        { service: 'youtube', status: 'healthy', latencyMs: 300 },
        { service: 'twitter', status: 'healthy', latencyMs: 150 },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: [],
      warnings: [],
      totalDurationMs: 500,
    };

    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(mockHealthCheck),
    }));

    const result = await getHealthHistory(1);

    expect(result.services.gemini?.avgLatencyMs).toBe(100);
    expect(result.services.youtube?.avgLatencyMs).toBe(300);
  });

  it('should identify recurring issues', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    // Mock 5 days with Gemini failing 3 times
    const mockDocs = Array.from({ length: 5 }, (_, i) => ({
      pipelineId: `2026-01-${15 + i}`,
      timestamp: `2026-01-${15 + i}T06:00:00.000Z`,
      allPassed: i < 2, // First 2 days pass, last 3 fail
      checks: [
        {
          service: 'gemini',
          status: i < 2 ? 'healthy' : 'failed',
          latencyMs: i < 2 ? 100 : 30000,
          error: i >= 2 ? 'API Error' : undefined,
        },
        { service: 'youtube', status: 'healthy', latencyMs: 200 },
        { service: 'twitter', status: 'healthy', latencyMs: 150 },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: i >= 2 ? ['gemini'] : [],
      warnings: [],
      totalDurationMs: 500,
    }));

    let callIndex = 0;
    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockImplementation(() => {
        if (callIndex < mockDocs.length) {
          return Promise.resolve(mockDocs[callIndex++]);
        }
        return Promise.resolve(null);
      }),
    }));

    const result = await getHealthHistory(5);

    expect(result.recurringIssues.length).toBeGreaterThan(0);
    expect(result.recurringIssues[0].service).toBe('gemini');
    expect(result.recurringIssues[0].frequency).toBe(3);
  });

  it('should include date range in result', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(null),
    }));

    const result = await getHealthHistory(7);

    expect(result.dateRange.start).toBeDefined();
    expect(result.dateRange.end).toBeDefined();
    expect(new Date(result.dateRange.start).getTime()).toBeLessThan(
      new Date(result.dateRange.end).getTime()
    );
  });
});

describe('getQuickHealthStatus', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return healthy status when all services are up', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockHealthCheck = {
      pipelineId: '2026-01-20',
      timestamp: '2026-01-20T06:00:00.000Z',
      allPassed: true,
      checks: [
        { service: 'gemini', status: 'healthy', latencyMs: 100 },
        { service: 'youtube', status: 'healthy', latencyMs: 200 },
        { service: 'twitter', status: 'healthy', latencyMs: 150 },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: [],
      warnings: [],
      totalDurationMs: 500,
    };

    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(mockHealthCheck),
    }));

    const result = await getQuickHealthStatus(7);

    expect(result.status).toBe('healthy');
    expect(result.overallHealth).toBe(100);
    expect(result.criticalIssues).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it('should return critical status when service has >50% failures', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    // All days have Gemini failing
    const mockHealthCheck = {
      pipelineId: '2026-01-20',
      timestamp: '2026-01-20T06:00:00.000Z',
      allPassed: false,
      checks: [
        { service: 'gemini', status: 'failed', latencyMs: 30000, error: 'Down' },
        { service: 'youtube', status: 'healthy', latencyMs: 200 },
        { service: 'twitter', status: 'healthy', latencyMs: 150 },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: ['gemini'],
      warnings: [],
      totalDurationMs: 30500,
    };

    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockResolvedValue(mockHealthCheck),
    }));

    const result = await getQuickHealthStatus(1);

    expect(result.status).toBe('critical');
    expect(result.criticalIssues).toBeGreaterThan(0);
  });

  it('should return degraded status for intermittent issues', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    // 2 days: 1 healthy, 1 with Gemini degraded
    const mockDocs = [
      {
        pipelineId: '2026-01-19',
        timestamp: '2026-01-19T06:00:00.000Z',
        allPassed: true,
        checks: [
          { service: 'gemini', status: 'healthy', latencyMs: 100 },
          { service: 'youtube', status: 'healthy', latencyMs: 200 },
          { service: 'twitter', status: 'healthy', latencyMs: 150 },
          { service: 'firestore', status: 'healthy', latencyMs: 50 },
          { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
          { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
        ],
        criticalFailures: [],
        warnings: [],
        totalDurationMs: 500,
      },
      {
        pipelineId: '2026-01-20',
        timestamp: '2026-01-20T06:00:00.000Z',
        allPassed: true,
        checks: [
          { service: 'gemini', status: 'failed', latencyMs: 100, error: 'Failed' },
          { service: 'youtube', status: 'healthy', latencyMs: 200 },
          { service: 'twitter', status: 'healthy', latencyMs: 150 },
          { service: 'firestore', status: 'healthy', latencyMs: 50 },
          { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
          { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
        ],
        criticalFailures: [],
        warnings: ['gemini'],
        totalDurationMs: 500,
      },
    ];

    let callIndex = 0;
    (FirestoreClient as any).mockImplementation(() => ({
      getDocument: vi.fn().mockImplementation(() => {
        if (callIndex < mockDocs.length) {
          return Promise.resolve(mockDocs[callIndex++]);
        }
        return Promise.resolve(null);
      }),
    }));

    const result = await getQuickHealthStatus(2);

    // 50% uptime on Gemini = degraded (between 50-90%)
    expect(result.status).toBe('degraded');
  });
});
