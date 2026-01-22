/**
 * Tests for health check failure handler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HealthCheckResult } from '@nexus-ai/core';

// Mock @nexus-ai/notifications FIRST
vi.mock('@nexus-ai/notifications', () => ({
  sendDiscordAlert: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock @nexus-ai/core
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
    logIncident: vi.fn().mockResolvedValue('incident-123'),
    inferRootCause: vi.fn().mockReturnValue('unknown'),
    mapSeverity: vi.fn().mockReturnValue('CRITICAL'),
    getBufferDeploymentCandidate: vi.fn().mockResolvedValue({ id: 'bf-1' }),
    getBufferHealthStatus: vi.fn().mockResolvedValue({ availableCount: 3, status: 'healthy' }),
    FirestoreClient: vi.fn(() => ({
      setDocument: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

// Import handler AFTER mocks
import {
  handleHealthCheckFailure,
  getFailureResponse,
} from '../failure-handler.js';

describe('handleHealthCheckFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should skip pipeline when critical failures exist', async () => {
    const healthResult: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      allPassed: false,
      checks: [
        { service: 'gemini', status: 'failed', latencyMs: 100, error: 'API unavailable' },
        { service: 'youtube', status: 'healthy', latencyMs: 200 },
        { service: 'twitter', status: 'healthy', latencyMs: 150 },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: ['gemini'],
      warnings: [],
      totalDurationMs: 500,
    };

    const result = await handleHealthCheckFailure('2026-01-20', healthResult);

    expect(result.shouldSkipPipeline).toBe(true);
    expect(result.alertsSent.length).toBeGreaterThan(0);
    expect(result.alertsSent[0].severity).toBe('CRITICAL');
  });

  it('should not skip pipeline when only non-critical failures exist', async () => {
    const healthResult: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      allPassed: true,
      checks: [
        { service: 'gemini', status: 'healthy', latencyMs: 100 },
        { service: 'youtube', status: 'healthy', latencyMs: 200 },
        { service: 'twitter', status: 'degraded', latencyMs: 150, error: 'Rate limited' },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'degraded', latencyMs: 75, error: 'Slow' },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: [],
      warnings: ['twitter', 'cloud-storage'],
      totalDurationMs: 500,
    };

    const result = await handleHealthCheckFailure('2026-01-20', healthResult);

    expect(result.shouldSkipPipeline).toBe(false);
  });

  it('should trigger buffer deployment on critical failure', async () => {
    const healthResult: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      allPassed: false,
      checks: [
        { service: 'gemini', status: 'failed', latencyMs: 100, error: 'Failed' },
        { service: 'youtube', status: 'healthy', latencyMs: 200 },
        { service: 'twitter', status: 'healthy', latencyMs: 150 },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: ['gemini'],
      warnings: [],
      totalDurationMs: 500,
    };

    const result = await handleHealthCheckFailure('2026-01-20', healthResult);

    expect(result.bufferDeploymentTriggered).toBe(true);
  });

  it('should include correct services in alert', async () => {
    const healthResult: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      allPassed: false,
      checks: [
        { service: 'gemini', status: 'failed', latencyMs: 100, error: 'Failed' },
        { service: 'youtube', status: 'failed', latencyMs: 200, error: 'Quota exceeded' },
        { service: 'twitter', status: 'healthy', latencyMs: 150 },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: ['gemini', 'youtube'],
      warnings: [],
      totalDurationMs: 500,
    };

    const result = await handleHealthCheckFailure('2026-01-20', healthResult);

    const criticalAlert = result.alertsSent.find(a => a.severity === 'CRITICAL');
    expect(criticalAlert?.services).toContain('gemini');
    expect(criticalAlert?.services).toContain('youtube');
  });

  it('should generate warning alert for degraded services', async () => {
    const healthResult: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      allPassed: true,
      checks: [
        { service: 'gemini', status: 'healthy', latencyMs: 100 },
        { service: 'youtube', status: 'healthy', latencyMs: 200 },
        { service: 'twitter', status: 'failed', latencyMs: 150, error: 'Auth failed' },
        { service: 'firestore', status: 'healthy', latencyMs: 50 },
        { service: 'cloud-storage', status: 'healthy', latencyMs: 75 },
        { service: 'secret-manager', status: 'healthy', latencyMs: 25 },
      ],
      criticalFailures: [],
      warnings: ['twitter'],
      totalDurationMs: 500,
    };

    const result = await handleHealthCheckFailure('2026-01-20', healthResult);

    expect(result.shouldSkipPipeline).toBe(false);
    const warningAlert = result.alertsSent.find(a => a.severity === 'WARNING');
    expect(warningAlert).toBeDefined();
    expect(warningAlert?.services).toContain('twitter');
  });

  it('should handle all services healthy', async () => {
    const healthResult: HealthCheckResult = {
      timestamp: new Date().toISOString(),
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

    const result = await handleHealthCheckFailure('2026-01-20', healthResult);

    expect(result.shouldSkipPipeline).toBe(false);
    expect(result.alertsSent).toHaveLength(0);
    expect(result.bufferDeploymentTriggered).toBe(false);
  });
});

describe('getFailureResponse', () => {
  it('should return skip-pipeline for CRITICAL services', () => {
    const geminiResponse = getFailureResponse('gemini');
    expect(geminiResponse.action).toBe('skip-pipeline');
    expect(geminiResponse.alertType).toBe('CRITICAL');
    expect(geminiResponse.shouldAlertDiscord).toBe(true);

    const youtubeResponse = getFailureResponse('youtube');
    expect(youtubeResponse.action).toBe('skip-pipeline');

    const firestoreResponse = getFailureResponse('firestore');
    expect(firestoreResponse.action).toBe('skip-pipeline');
    expect(firestoreResponse.shouldAlertEmail).toBe(true); // Per AC #4
  });

  it('should return continue-degraded for DEGRADED services', () => {
    const storageResponse = getFailureResponse('cloud-storage');
    expect(storageResponse.action).toBe('continue-degraded');
    expect(storageResponse.alertType).toBe('WARNING');
    expect(storageResponse.shouldAlertDiscord).toBe(false);
  });

  it('should return continue-normal for RECOVERABLE services', () => {
    const twitterResponse = getFailureResponse('twitter');
    expect(twitterResponse.action).toBe('continue-normal');
    expect(twitterResponse.alertType).toBe('WARNING');
    expect(twitterResponse.shouldAlertDiscord).toBe(false);
  });

  it('should require email alert for Firestore failures', () => {
    const firestoreResponse = getFailureResponse('firestore');
    expect(firestoreResponse.shouldAlertEmail).toBe(true);
  });

  it('should not require email alert for other critical failures', () => {
    const geminiResponse = getFailureResponse('gemini');
    expect(geminiResponse.shouldAlertEmail).toBe(false);

    const youtubeResponse = getFailureResponse('youtube');
    expect(youtubeResponse.shouldAlertEmail).toBe(false);
  });
});
