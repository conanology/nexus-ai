/**
 * Tests for health check types
 *
 * Validates type definitions, constants, and type guards for health check system.
 */

import { describe, it, expect } from 'vitest';
import {
  SERVICE_CRITICALITY,
  HEALTH_CHECK_TIMEOUT_MS,
  MAX_HEALTH_CHECK_DURATION_MS,
  YOUTUBE_QUOTA_THRESHOLDS,
  type HealthCheckStatus,
  type HealthCheckService,
  type IndividualHealthCheck,
  type HealthCheckResult,
  type YouTubeQuotaCheck,
  type HealthHistorySummary,
} from '../health.js';

describe('health types', () => {
  describe('SERVICE_CRITICALITY', () => {
    it('should define criticality for all services', () => {
      const services: HealthCheckService[] = [
        'gemini',
        'youtube',
        'twitter',
        'firestore',
        'cloud-storage',
        'secret-manager',
      ];

      for (const service of services) {
        expect(SERVICE_CRITICALITY[service]).toBeDefined();
        expect(['CRITICAL', 'DEGRADED', 'RECOVERABLE']).toContain(
          SERVICE_CRITICALITY[service]
        );
      }
    });

    it('should mark critical services correctly', () => {
      expect(SERVICE_CRITICALITY['gemini']).toBe('CRITICAL');
      expect(SERVICE_CRITICALITY['youtube']).toBe('CRITICAL');
      expect(SERVICE_CRITICALITY['firestore']).toBe('CRITICAL');
      expect(SERVICE_CRITICALITY['secret-manager']).toBe('CRITICAL');
    });

    it('should mark non-critical services correctly', () => {
      expect(SERVICE_CRITICALITY['cloud-storage']).toBe('DEGRADED');
      expect(SERVICE_CRITICALITY['twitter']).toBe('RECOVERABLE');
    });
  });

  describe('constants', () => {
    it('should define health check timeout', () => {
      expect(HEALTH_CHECK_TIMEOUT_MS).toBe(30000);
    });

    it('should define max total duration', () => {
      expect(MAX_HEALTH_CHECK_DURATION_MS).toBe(120000);
    });

    it('should define YouTube quota thresholds', () => {
      expect(YOUTUBE_QUOTA_THRESHOLDS.HEALTHY).toBe(60);
      expect(YOUTUBE_QUOTA_THRESHOLDS.WARNING).toBe(80);
      expect(YOUTUBE_QUOTA_THRESHOLDS.CRITICAL).toBe(95);
    });

    it('should have ordered YouTube thresholds', () => {
      expect(YOUTUBE_QUOTA_THRESHOLDS.HEALTHY).toBeLessThan(
        YOUTUBE_QUOTA_THRESHOLDS.WARNING
      );
      expect(YOUTUBE_QUOTA_THRESHOLDS.WARNING).toBeLessThan(
        YOUTUBE_QUOTA_THRESHOLDS.CRITICAL
      );
    });
  });

  describe('type shapes', () => {
    it('should allow valid IndividualHealthCheck', () => {
      const check: IndividualHealthCheck = {
        service: 'gemini',
        status: 'healthy',
        latencyMs: 245,
      };

      expect(check.service).toBe('gemini');
      expect(check.status).toBe('healthy');
      expect(check.latencyMs).toBe(245);
    });

    it('should allow IndividualHealthCheck with error', () => {
      const check: IndividualHealthCheck = {
        service: 'youtube',
        status: 'failed',
        latencyMs: 30000,
        error: 'Connection timeout',
      };

      expect(check.error).toBe('Connection timeout');
    });

    it('should allow IndividualHealthCheck with metadata', () => {
      const check: IndividualHealthCheck = {
        service: 'youtube',
        status: 'degraded',
        latencyMs: 500,
        metadata: {
          quotaUsed: 7500,
          quotaLimit: 10000,
          percentage: 75,
        },
      };

      expect(check.metadata?.quotaUsed).toBe(7500);
    });

    it('should allow valid HealthCheckResult', () => {
      const result: HealthCheckResult = {
        timestamp: '2026-01-20T06:00:00.000Z',
        allPassed: true,
        checks: [],
        criticalFailures: [],
        warnings: [],
        totalDurationMs: 1500,
      };

      expect(result.allPassed).toBe(true);
      expect(result.criticalFailures).toHaveLength(0);
    });

    it('should allow HealthCheckResult with failures', () => {
      const result: HealthCheckResult = {
        timestamp: '2026-01-20T06:00:00.000Z',
        allPassed: false,
        checks: [
          {
            service: 'gemini',
            status: 'failed',
            latencyMs: 30000,
            error: 'API unavailable',
          },
        ],
        criticalFailures: ['gemini'],
        warnings: ['cloud-storage'],
        totalDurationMs: 32000,
      };

      expect(result.allPassed).toBe(false);
      expect(result.criticalFailures).toContain('gemini');
      expect(result.warnings).toContain('cloud-storage');
    });

    it('should allow valid YouTubeQuotaCheck', () => {
      const check: YouTubeQuotaCheck = {
        service: 'youtube',
        status: 'degraded',
        latencyMs: 350,
        metadata: {
          quotaUsed: 7500,
          quotaLimit: 10000,
          percentage: 75,
        },
      };

      expect(check.metadata.percentage).toBe(75);
    });

    it('should allow valid HealthHistorySummary', () => {
      const summary: HealthHistorySummary = {
        dateRange: {
          start: '2026-01-13',
          end: '2026-01-20',
        },
        services: {
          gemini: {
            totalChecks: 7,
            failures: 0,
            uptimePercentage: 100,
            avgLatencyMs: 250,
            failurePattern: 'none',
          },
          youtube: {
            totalChecks: 7,
            failures: 1,
            uptimePercentage: 85.7,
            avgLatencyMs: 400,
            lastFailure: '2026-01-18T06:00:00.000Z',
            failurePattern: 'intermittent',
          },
        },
        recurringIssues: [
          {
            service: 'twitter',
            frequency: 3,
            lastOccurrence: '2026-01-19T06:00:00.000Z',
            description: 'Rate limit exceeded',
          },
        ],
        totalChecks: 7,
        overallHealth: 92.5,
      };

      expect(summary.services.gemini?.uptimePercentage).toBe(100);
      expect(summary.recurringIssues).toHaveLength(1);
    });
  });

  describe('status values', () => {
    it('should accept all valid HealthCheckStatus values', () => {
      const statuses: HealthCheckStatus[] = ['healthy', 'degraded', 'failed'];

      for (const status of statuses) {
        const check: IndividualHealthCheck = {
          service: 'gemini',
          status,
          latencyMs: 100,
        };
        expect(check.status).toBe(status);
      }
    });
  });

  describe('service values', () => {
    it('should accept all valid HealthCheckService values', () => {
      const services: HealthCheckService[] = [
        'gemini',
        'youtube',
        'twitter',
        'firestore',
        'cloud-storage',
        'secret-manager',
      ];

      for (const service of services) {
        const check: IndividualHealthCheck = {
          service,
          status: 'healthy',
          latencyMs: 100,
        };
        expect(check.service).toBe(service);
      }
    });
  });
});
