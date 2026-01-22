/**
 * Tests for incident digest integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncidentRecord, IncidentSummary } from '../types.js';

// Mock FirestoreClient
const mockQueryDocuments = vi.fn();
const mockFirestoreClient = {
  queryDocuments: mockQueryDocuments,
};

vi.mock('../../storage/firestore-client.js', () => ({
  FirestoreClient: vi.fn(() => mockFirestoreClient),
}));

vi.mock('../../observability/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import after mocks are set up
import { getIncidentSummaryForDigest } from '../digest.js';

describe('Incident Digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryDocuments.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIncidentSummaryForDigest', () => {
    it('should return empty summary when no incidents', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      expect(summary.date).toBe('2026-01-22');
      expect(summary.totalCount).toBe(0);
      expect(summary.criticalCount).toBe(0);
      expect(summary.warningCount).toBe(0);
      expect(summary.recoverableCount).toBe(0);
      expect(summary.stagesAffected).toHaveLength(0);
      expect(summary.avgResolutionTimeMs).toBeNull();
      expect(summary.openIncidents).toBe(0);
      expect(summary.incidents).toHaveLength(0);
    });

    it('should count incidents by severity', async () => {
      const incidents: IncidentRecord[] = [
        createMockIncident('001', 'tts', 'CRITICAL'),
        createMockIncident('002', 'research', 'WARNING'),
        createMockIncident('003', 'script-gen', 'WARNING'),
        createMockIncident('004', 'render', 'RECOVERABLE'),
      ];
      mockQueryDocuments.mockResolvedValue(incidents);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      expect(summary.totalCount).toBe(4);
      expect(summary.criticalCount).toBe(1);
      expect(summary.warningCount).toBe(2);
      expect(summary.recoverableCount).toBe(1);
    });

    it('should identify affected stages', async () => {
      const incidents: IncidentRecord[] = [
        createMockIncident('001', 'tts', 'CRITICAL'),
        createMockIncident('002', 'tts', 'WARNING'),
        createMockIncident('003', 'research', 'WARNING'),
      ];
      mockQueryDocuments.mockResolvedValue(incidents);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      expect(summary.stagesAffected).toHaveLength(2);
      expect(summary.stagesAffected).toContain('tts');
      expect(summary.stagesAffected).toContain('research');
    });

    it('should calculate average resolution time for resolved incidents', async () => {
      const incidents: IncidentRecord[] = [
        createMockIncident('001', 'tts', 'CRITICAL', true, 30000), // 30s
        createMockIncident('002', 'research', 'WARNING', true, 60000), // 60s
        createMockIncident('003', 'script-gen', 'WARNING', false), // open
      ];
      mockQueryDocuments.mockResolvedValue(incidents);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      // Average of 30000 and 60000 = 45000
      expect(summary.avgResolutionTimeMs).toBe(45000);
    });

    it('should return null avgResolutionTimeMs when no resolved incidents', async () => {
      const incidents: IncidentRecord[] = [
        createMockIncident('001', 'tts', 'CRITICAL', false),
        createMockIncident('002', 'research', 'WARNING', false),
      ];
      mockQueryDocuments.mockResolvedValue(incidents);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      expect(summary.avgResolutionTimeMs).toBeNull();
    });

    it('should count open incidents', async () => {
      const incidents: IncidentRecord[] = [
        createMockIncident('001', 'tts', 'CRITICAL', true), // resolved
        createMockIncident('002', 'research', 'WARNING', false), // open
        createMockIncident('003', 'script-gen', 'WARNING', false), // open
      ];
      mockQueryDocuments.mockResolvedValue(incidents);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      expect(summary.openIncidents).toBe(2);
    });

    it('should create incident digest entries', async () => {
      const incidents: IncidentRecord[] = [
        createMockIncident('001', 'tts', 'CRITICAL', true, 30000),
      ];
      mockQueryDocuments.mockResolvedValue(incidents);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      expect(summary.incidents).toHaveLength(1);
      expect(summary.incidents[0]).toEqual({
        id: '2026-01-22-001',
        stage: 'tts',
        severity: 'CRITICAL',
        error: 'Test error message',
        resolution: 'retry',
        duration: 30000,
      });
    });

    it('should handle open incident digest entries', async () => {
      const incidents: IncidentRecord[] = [
        createMockIncident('001', 'tts', 'CRITICAL', false),
      ];
      mockQueryDocuments.mockResolvedValue(incidents);

      const summary = await getIncidentSummaryForDigest('2026-01-22');

      expect(summary.incidents[0].resolution).toBeUndefined();
      expect(summary.incidents[0].duration).toBeUndefined();
    });
  });
});

/**
 * Helper to create mock incident records
 */
function createMockIncident(
  sequence: string,
  stage: string,
  severity: 'CRITICAL' | 'WARNING' | 'RECOVERABLE',
  resolved: boolean = false,
  duration: number = 0
): IncidentRecord {
  const id = `2026-01-22-${sequence}`;
  const base: IncidentRecord = {
    id,
    date: '2026-01-22',
    pipelineId: '2026-01-22',
    stage,
    error: {
      code: `NEXUS_${stage.toUpperCase()}_ERROR`,
      message: 'Test error message',
    },
    severity,
    startTime: '2026-01-22T06:15:00.000Z',
    rootCause: 'timeout',
    context: {},
    isOpen: !resolved, // Open if not resolved
    createdAt: '2026-01-22T06:15:00.000Z',
    updatedAt: '2026-01-22T06:15:00.000Z',
  };

  if (resolved) {
    return {
      ...base,
      isOpen: false,
      endTime: '2026-01-22T06:16:00.000Z',
      duration,
      resolution: {
        type: 'retry',
        resolvedBy: 'system',
      },
    };
  }

  return base;
}
