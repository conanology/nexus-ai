/**
 * Tests for incident queries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncidentRecord } from '../types.js';

// Mock FirestoreClient
const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockFirestoreClient = {
  getDocument: mockGetDocument,
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
import {
  getIncidentById,
  getIncidentsByDate,
  getIncidentsByStage,
  getOpenIncidents,
  clearQueryCache,
} from '../queries.js';

describe('Incident Queries', () => {
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
    clearQueryCache(); // Clear cache between tests
    mockGetDocument.mockResolvedValue(null);
    mockQueryDocuments.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIncidentById', () => {
    it('should return incident when found', async () => {
      mockGetDocument.mockResolvedValue(mockIncidentRecord);

      const result = await getIncidentById('2026-01-22-001');

      expect(result).toEqual(mockIncidentRecord);
      expect(mockGetDocument).toHaveBeenCalledWith('incidents', '2026-01-22-001');
    });

    it('should return null when not found', async () => {
      mockGetDocument.mockResolvedValue(null);

      const result = await getIncidentById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle Firestore errors', async () => {
      mockGetDocument.mockRejectedValue(new Error('Firestore error'));

      await expect(getIncidentById('2026-01-22-001')).rejects.toThrow();
    });
  });

  describe('getIncidentsByDate', () => {
    it('should return incidents for a date', async () => {
      const incidents = [mockIncidentRecord, { ...mockIncidentRecord, id: '2026-01-22-002' }];
      mockQueryDocuments.mockResolvedValue(incidents);

      const result = await getIncidentsByDate('2026-01-22');

      expect(result).toHaveLength(2);
      expect(mockQueryDocuments).toHaveBeenCalledWith('incidents', [
        { field: 'date', operator: '==', value: '2026-01-22' },
      ]);
    });

    it('should return empty array when no incidents', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const result = await getIncidentsByDate('2026-01-22');

      expect(result).toHaveLength(0);
    });

    it('should use cache on repeated calls within TTL', async () => {
      const incidents = [mockIncidentRecord];
      mockQueryDocuments.mockResolvedValue(incidents);

      // First call
      await getIncidentsByDate('2026-01-22');
      // Second call should use cache
      await getIncidentsByDate('2026-01-22');

      // Should only call Firestore once
      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when explicitly requested', async () => {
      const incidents = [mockIncidentRecord];
      mockQueryDocuments.mockResolvedValue(incidents);

      await getIncidentsByDate('2026-01-22');
      await getIncidentsByDate('2026-01-22', { bypassCache: true });

      expect(mockQueryDocuments).toHaveBeenCalledTimes(2);
    });
  });

  describe('getIncidentsByStage', () => {
    it('should return incidents for a stage', async () => {
      const incidents = [mockIncidentRecord];
      mockQueryDocuments.mockResolvedValue(incidents);

      const result = await getIncidentsByStage('tts');

      expect(result).toHaveLength(1);
      expect(result[0].stage).toBe('tts');
      expect(mockQueryDocuments).toHaveBeenCalledWith('incidents', [
        { field: 'stage', operator: '==', value: 'tts' },
      ]);
    });

    it('should return empty array when no incidents for stage', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const result = await getIncidentsByStage('unknown-stage');

      expect(result).toHaveLength(0);
    });

    it('should use cache on repeated calls', async () => {
      mockQueryDocuments.mockResolvedValue([mockIncidentRecord]);

      await getIncidentsByStage('tts');
      await getIncidentsByStage('tts');

      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);
    });

    it('should have separate cache keys for different stages', async () => {
      mockQueryDocuments.mockResolvedValue([mockIncidentRecord]);

      await getIncidentsByStage('tts');
      await getIncidentsByStage('research');

      expect(mockQueryDocuments).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOpenIncidents', () => {
    it('should return incidents with isOpen: true', async () => {
      const openIncident = { ...mockIncidentRecord, isOpen: true };
      const closedIncident = {
        ...mockIncidentRecord,
        id: '2026-01-22-002',
        isOpen: false,
        endTime: '2026-01-22T07:00:00.000Z',
      };

      // Mock returns only open incidents (Firestore filters by isOpen)
      mockQueryDocuments.mockResolvedValue([openIncident]);

      const result = await getOpenIncidents();

      expect(result).toHaveLength(1);
      expect(result[0].isOpen).toBe(true);
    });

    it('should return empty array when no open incidents', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const result = await getOpenIncidents();

      expect(result).toHaveLength(0);
    });

    it('should use cache on repeated calls', async () => {
      mockQueryDocuments.mockResolvedValue([mockIncidentRecord]);

      await getOpenIncidents();
      await getOpenIncidents();

      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearQueryCache', () => {
    it('should clear all cached queries', async () => {
      mockQueryDocuments.mockResolvedValue([mockIncidentRecord]);

      await getIncidentsByDate('2026-01-22');
      await getIncidentsByStage('tts');

      clearQueryCache();

      await getIncidentsByDate('2026-01-22');
      await getIncidentsByStage('tts');

      // Should have called 4 times total (2 before clear, 2 after)
      expect(mockQueryDocuments).toHaveBeenCalledTimes(4);
    });
  });
});
