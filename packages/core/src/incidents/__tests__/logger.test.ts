/**
 * Tests for incident logger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Incident, IncidentRecord, IncidentSeverity, PostMortemTemplate } from '../types.js';

// Mock FirestoreClient
const mockSetDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockFirestoreClient = {
  setDocument: mockSetDocument,
  queryDocuments: mockQueryDocuments,
};

// Mock the modules
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
import {
  logIncident,
  generateIncidentId,
  generatePostMortemTemplate,
  mapSeverity,
  inferRootCause,
  isCriticalStage,
} from '../logger.js';
import { ErrorSeverity } from '../../types/errors.js';

describe('Incident Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDocument.mockResolvedValue(undefined);
    mockQueryDocuments.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateIncidentId', () => {
    it('should generate first ID for a date with no existing incidents', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const id = await generateIncidentId('2026-01-22');

      expect(id).toBe('2026-01-22-001');
    });

    it('should generate sequential IDs', async () => {
      mockQueryDocuments.mockResolvedValue([
        { id: '2026-01-22-001' },
        { id: '2026-01-22-002' },
      ]);

      const id = await generateIncidentId('2026-01-22');

      expect(id).toBe('2026-01-22-003');
    });

    it('should pad sequence numbers to 3 digits', async () => {
      const incidents = Array.from({ length: 15 }, (_, i) => ({
        id: `2026-01-22-${String(i + 1).padStart(3, '0')}`,
      }));
      mockQueryDocuments.mockResolvedValue(incidents);

      const id = await generateIncidentId('2026-01-22');

      expect(id).toBe('2026-01-22-016');
    });
  });

  describe('mapSeverity', () => {
    it('should map CRITICAL to CRITICAL', () => {
      expect(mapSeverity(ErrorSeverity.CRITICAL)).toBe('CRITICAL');
    });

    it('should map DEGRADED to WARNING', () => {
      expect(mapSeverity(ErrorSeverity.DEGRADED)).toBe('WARNING');
    });

    it('should map FALLBACK to WARNING', () => {
      expect(mapSeverity(ErrorSeverity.FALLBACK)).toBe('WARNING');
    });

    it('should map RECOVERABLE to RECOVERABLE', () => {
      expect(mapSeverity(ErrorSeverity.RECOVERABLE)).toBe('RECOVERABLE');
    });

    it('should map RETRYABLE to RECOVERABLE', () => {
      expect(mapSeverity(ErrorSeverity.RETRYABLE)).toBe('RECOVERABLE');
    });
  });

  describe('inferRootCause', () => {
    it('should infer timeout from error code', () => {
      expect(inferRootCause('NEXUS_TTS_TIMEOUT')).toBe('timeout');
      expect(inferRootCause('NEXUS_LLM_TIMEOUT')).toBe('timeout');
    });

    it('should infer rate_limit from error code', () => {
      expect(inferRootCause('NEXUS_LLM_RATE_LIMIT')).toBe('rate_limit');
      expect(inferRootCause('NEXUS_TWITTER_RATE_LIMIT')).toBe('rate_limit');
    });

    it('should infer quota_exceeded from error code', () => {
      expect(inferRootCause('NEXUS_YOUTUBE_QUOTA_EXCEEDED')).toBe('quota_exceeded');
    });

    it('should infer auth_failure from error code', () => {
      expect(inferRootCause('NEXUS_YOUTUBE_AUTH_FAILED')).toBe('auth_failure');
      expect(inferRootCause('NEXUS_TWITTER_AUTH_FAILED')).toBe('auth_failure');
    });

    it('should infer network_error from error code', () => {
      expect(inferRootCause('NEXUS_NETWORK_ERROR')).toBe('network_error');
    });

    it('should infer config_error from error code', () => {
      expect(inferRootCause('NEXUS_CONFIG_ERROR')).toBe('config_error');
    });

    it('should return unknown for unrecognized codes', () => {
      expect(inferRootCause('NEXUS_UNKNOWN_ERROR')).toBe('unknown');
      expect(inferRootCause('SOME_OTHER_CODE')).toBe('unknown');
    });
  });

  describe('isCriticalStage', () => {
    it('should return true for render stage', () => {
      expect(isCriticalStage('render')).toBe(true);
    });

    it('should return true for tts stage', () => {
      expect(isCriticalStage('tts')).toBe(true);
    });

    it('should return true for script-gen stage', () => {
      expect(isCriticalStage('script-gen')).toBe(true);
    });

    it('should return false for research stage', () => {
      expect(isCriticalStage('research')).toBe(false);
    });

    it('should return false for unknown stages', () => {
      expect(isCriticalStage('unknown-stage')).toBe(false);
    });
  });

  describe('generatePostMortemTemplate', () => {
    const mockIncident: Incident = {
      date: '2026-01-22',
      pipelineId: '2026-01-22',
      stage: 'tts',
      error: {
        code: 'NEXUS_TTS_TIMEOUT',
        message: 'TTS synthesis timed out after 30 seconds',
      },
      severity: 'CRITICAL',
      startTime: '2026-01-22T06:15:00.000Z',
      rootCause: 'timeout',
      context: {
        provider: 'gemini-2.5-pro-tts',
        attempt: 3,
      },
    };

    it('should generate post-mortem with correct timeline', () => {
      const postMortem = generatePostMortemTemplate(mockIncident);

      expect(postMortem.timeline.detected).toBe('2026-01-22T06:15:00.000Z');
      expect(postMortem.timeline.impact).toContain('tts');
      expect(postMortem.timeline.impact).toContain('NEXUS_TTS_TIMEOUT');
    });

    it('should generate summary with stage and message', () => {
      const postMortem = generatePostMortemTemplate(mockIncident);

      expect(postMortem.summary).toContain('CRITICAL');
      expect(postMortem.summary).toContain('tts');
      expect(postMortem.summary).toContain('TTS synthesis timed out');
    });

    it('should set correct impact assessment', () => {
      const postMortem = generatePostMortemTemplate(mockIncident);

      expect(postMortem.impact.pipelineAffected).toBe(true);
      expect(postMortem.impact.stageAffected).toBe('tts');
      expect(postMortem.impact.potentialVideoImpact).toBe(true); // tts is critical
    });

    it('should include placeholder for human-filled fields', () => {
      const postMortem = generatePostMortemTemplate(mockIncident);

      expect(postMortem.rootCauseAnalysis).toContain('TODO');
      expect(postMortem.lessonsLearned).toContain('TODO');
      expect(postMortem.actionItems).toHaveLength(0);
    });

    it('should set generatedAt timestamp', () => {
      const before = new Date().toISOString();
      const postMortem = generatePostMortemTemplate(mockIncident);
      const after = new Date().toISOString();

      expect(postMortem.generatedAt >= before).toBe(true);
      expect(postMortem.generatedAt <= after).toBe(true);
    });
  });

  describe('logIncident', () => {
    const mockIncident: Incident = {
      date: '2026-01-22',
      pipelineId: '2026-01-22',
      stage: 'tts',
      error: {
        code: 'NEXUS_TTS_TIMEOUT',
        message: 'TTS synthesis timed out after 30 seconds',
      },
      severity: 'WARNING',
      startTime: '2026-01-22T06:15:00.000Z',
      rootCause: 'timeout',
      context: {
        provider: 'gemini-2.5-pro-tts',
        attempt: 3,
      },
    };

    it('should return generated incident ID', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const id = await logIncident(mockIncident);

      expect(id).toBe('2026-01-22-001');
    });

    it('should persist incident to Firestore', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      await logIncident(mockIncident);

      expect(mockSetDocument).toHaveBeenCalledWith(
        'incidents',
        '2026-01-22-001',
        expect.objectContaining({
          id: '2026-01-22-001',
          date: '2026-01-22',
          stage: 'tts',
          severity: 'WARNING',
        })
      );
    });

    it('should include createdAt and updatedAt timestamps', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      await logIncident(mockIncident);

      const savedRecord = mockSetDocument.mock.calls[0][2] as IncidentRecord;
      expect(savedRecord.createdAt).toBeDefined();
      expect(savedRecord.updatedAt).toBeDefined();
      expect(savedRecord.createdAt).toBe(savedRecord.updatedAt);
    });

    it('should set isOpen to true for new incidents', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      await logIncident(mockIncident);

      const savedRecord = mockSetDocument.mock.calls[0][2] as IncidentRecord;
      expect(savedRecord.isOpen).toBe(true);
    });

    it('should NOT generate post-mortem for WARNING severity', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      await logIncident(mockIncident);

      const savedRecord = mockSetDocument.mock.calls[0][2] as IncidentRecord;
      expect(savedRecord.postMortem).toBeUndefined();
    });

    it('should generate post-mortem for CRITICAL severity', async () => {
      mockQueryDocuments.mockResolvedValue([]);
      const criticalIncident: Incident = {
        ...mockIncident,
        severity: 'CRITICAL',
      };

      await logIncident(criticalIncident);

      const savedRecord = mockSetDocument.mock.calls[0][2] as IncidentRecord;
      expect(savedRecord.postMortem).toBeDefined();
      expect(savedRecord.postMortem?.summary).toContain('CRITICAL');
    });

    it('should log CRITICAL incidents (orchestrator handles Discord alerts)', async () => {
      mockQueryDocuments.mockResolvedValue([]);
      const criticalIncident: Incident = {
        ...mockIncident,
        severity: 'CRITICAL',
      };

      const id = await logIncident(criticalIncident);

      // Verify incident was logged with CRITICAL severity
      const savedRecord = mockSetDocument.mock.calls[0][2] as IncidentRecord;
      expect(savedRecord.severity).toBe('CRITICAL');
      // Note: Discord alerts are now sent by orchestrator, not logger
      // This avoids circular dependency between core and notifications
    });

    it('should handle Firestore errors gracefully', async () => {
      mockQueryDocuments.mockRejectedValue(new Error('Firestore error'));

      await expect(logIncident(mockIncident)).rejects.toThrow();
    });
  });
});
