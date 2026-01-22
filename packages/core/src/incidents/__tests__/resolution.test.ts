/**
 * Tests for incident resolution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncidentRecord, ResolutionDetails } from '../types.js';

// Mock FirestoreClient
const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockFirestoreClient = {
  getDocument: mockGetDocument,
  updateDocument: mockUpdateDocument,
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
import { resolveIncident } from '../resolution.js';

describe('Incident Resolution', () => {
  const mockIncidentRecord: IncidentRecord = {
    id: '2026-01-22-001',
    date: '2026-01-22',
    pipelineId: '2026-01-22',
    stage: 'tts',
    error: {
      code: 'NEXUS_TTS_TIMEOUT',
      message: 'TTS synthesis timed out',
    },
    severity: 'CRITICAL',
    startTime: '2026-01-22T06:15:00.000Z',
    rootCause: 'timeout',
    context: {},
    isOpen: true,
    createdAt: '2026-01-22T06:15:00.000Z',
    updatedAt: '2026-01-22T06:15:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockResolvedValue(mockIncidentRecord);
    mockUpdateDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveIncident', () => {
    it('should update incident with resolution details', async () => {
      const resolution: ResolutionDetails = {
        type: 'retry',
        notes: 'Succeeded after retry',
        resolvedBy: 'system',
      };

      await resolveIncident('2026-01-22-001', resolution);

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'incidents',
        '2026-01-22-001',
        expect.objectContaining({
          resolution,
        })
      );
    });

    it('should set isOpen to false when resolved', async () => {
      const resolution: ResolutionDetails = {
        type: 'retry',
      };

      await resolveIncident('2026-01-22-001', resolution);

      const updateCall = mockUpdateDocument.mock.calls[0][2];
      expect(updateCall.isOpen).toBe(false);
    });

    it('should set endTime to current timestamp', async () => {
      const resolution: ResolutionDetails = {
        type: 'fallback',
      };

      const before = new Date().toISOString();
      await resolveIncident('2026-01-22-001', resolution);
      const after = new Date().toISOString();

      const updateCall = mockUpdateDocument.mock.calls[0][2];
      expect(updateCall.endTime >= before).toBe(true);
      expect(updateCall.endTime <= after).toBe(true);
    });

    it('should calculate duration from startTime to endTime', async () => {
      // Mock incident with known startTime
      const incidentWithStartTime: IncidentRecord = {
        ...mockIncidentRecord,
        startTime: new Date(Date.now() - 60000).toISOString(), // 60 seconds ago
      };
      mockGetDocument.mockResolvedValue(incidentWithStartTime);

      const resolution: ResolutionDetails = {
        type: 'manual',
        resolvedBy: 'operator',
      };

      await resolveIncident('2026-01-22-001', resolution);

      const updateCall = mockUpdateDocument.mock.calls[0][2];
      // Duration should be approximately 60000ms (with some tolerance for execution time)
      expect(updateCall.duration).toBeGreaterThanOrEqual(60000);
      expect(updateCall.duration).toBeLessThan(65000);
    });

    it('should update updatedAt timestamp', async () => {
      const resolution: ResolutionDetails = {
        type: 'skip',
      };

      const before = new Date().toISOString();
      await resolveIncident('2026-01-22-001', resolution);
      const after = new Date().toISOString();

      const updateCall = mockUpdateDocument.mock.calls[0][2];
      expect(updateCall.updatedAt >= before).toBe(true);
      expect(updateCall.updatedAt <= after).toBe(true);
    });

    it('should throw when incident not found', async () => {
      mockGetDocument.mockResolvedValue(null);

      const resolution: ResolutionDetails = {
        type: 'retry',
      };

      await expect(resolveIncident('non-existent', resolution)).rejects.toThrow();
    });

    it('should handle minimal resolution details', async () => {
      const resolution: ResolutionDetails = {
        type: 'auto_recovered',
      };

      await resolveIncident('2026-01-22-001', resolution);

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'incidents',
        '2026-01-22-001',
        expect.objectContaining({
          resolution: { type: 'auto_recovered' },
        })
      );
    });

    it('should handle Firestore update errors', async () => {
      mockUpdateDocument.mockRejectedValue(new Error('Update failed'));

      const resolution: ResolutionDetails = {
        type: 'retry',
      };

      await expect(resolveIncident('2026-01-22-001', resolution)).rejects.toThrow();
    });
  });
});
