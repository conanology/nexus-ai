/**
 * Unit tests for CostTracker
 *
 * Tests cost tracking functionality including:
 * - Constructor initialization
 * - Recording API calls
 * - Aggregating cost summaries
 * - Persisting to Firestore
 * - Static methods for retrieving costs
 * - 4 decimal precision
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CostTracker } from '../cost-tracker.js';
import { NexusError } from '../../errors/index.js';

// Mock functions must be defined before vi.mock()
const mockGetPipelineCosts = vi.fn();
const mockSetPipelineCosts = vi.fn();

// Mock FirestoreClient class
vi.mock('../../storage/firestore-client.js', () => ({
  FirestoreClient: vi.fn(function(this: any) {
    this.getPipelineCosts = mockGetPipelineCosts;
    this.setPipelineCosts = mockSetPipelineCosts;
    return this;
  })
}));

describe('CostTracker', () => {
  let tracker: CostTracker;
  const pipelineId = '2026-01-08';
  const stageName = 'script-gen';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPipelineCosts.mockReset();
    mockSetPipelineCosts.mockReset();
    tracker = new CostTracker(pipelineId, stageName);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with pipelineId and stageName', () => {
      expect(tracker).toBeDefined();
      expect(tracker).toBeInstanceOf(CostTracker);
    });

    it('should initialize with empty cost entries', () => {
      const summary = tracker.getSummary();
      expect(summary.totalCost).toBe(0);
      expect(summary.breakdown).toEqual([]);
    });

    it('should throw NexusError for invalid pipelineId format', () => {
      expect(() => new CostTracker('invalid-id', 'test-stage')).toThrow(NexusError);
      expect(() => new CostTracker('2026-13-45', 'test-stage')).toThrow(NexusError);
      expect(() => new CostTracker('abc', 'test-stage')).toThrow(NexusError);
      expect(() => new CostTracker('2026/01/08', 'test-stage')).toThrow(NexusError);
    });

    it('should accept valid pipelineId in YYYY-MM-DD format', () => {
      expect(() => new CostTracker('2026-01-08', 'test-stage')).not.toThrow();
      expect(() => new CostTracker('2025-12-31', 'test-stage')).not.toThrow();
    });
  });

  describe('recordApiCall', () => {
    it('should record a single API call', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);
      const summary = tracker.getSummary();

      expect(summary.totalCost).toBe(0.0023);
      expect(summary.breakdown).toHaveLength(1);
      expect(summary.breakdown[0]).toMatchObject({
        service: 'gemini-3-pro',
        cost: 0.0023,
        tokens: { input: 100, output: 50 },
        callCount: 1,
      });
    });

    it('should record multiple API calls to same service', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);
      tracker.recordApiCall('gemini-3-pro', { input: 200, output: 100 }, 0.0045);

      const summary = tracker.getSummary();

      expect(summary.totalCost).toBe(0.0068);
      expect(summary.breakdown).toHaveLength(1);
      expect(summary.breakdown[0]).toMatchObject({
        service: 'gemini-3-pro',
        cost: 0.0068,
        tokens: { input: 300, output: 150 },
        callCount: 2,
      });
    });

    it('should record multiple API calls to different services', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);
      tracker.recordApiCall('chirp3-hd', {}, 0.0045);

      const summary = tracker.getSummary();

      expect(summary.totalCost).toBe(0.0068);
      expect(summary.breakdown).toHaveLength(2);
    });

    it('should round costs to 4 decimal places', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.00234567);

      const summary = tracker.getSummary();

      expect(summary.totalCost).toBe(0.0023);
    });

    it('should handle calls without tokens', () => {
      tracker.recordApiCall('chirp3-hd', {}, 0.0045);

      const summary = tracker.getSummary();

      expect(summary.breakdown[0]).toMatchObject({
        service: 'chirp3-hd',
        cost: 0.0045,
        tokens: {},
        callCount: 1,
      });
    });
  });

  describe('getSummary', () => {
    it('should return summary with stage name', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);

      const summary = tracker.getSummary();

      expect(summary.stage).toBe('script-gen');
    });

    it('should return aggregated cost breakdown by service', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);
      tracker.recordApiCall('gemini-3-pro', { input: 200, output: 100 }, 0.0045);
      tracker.recordApiCall('chirp3-hd', {}, 0.0012);

      const summary = tracker.getSummary();

      expect(summary.breakdown).toHaveLength(2);

      const geminiBreakdown = summary.breakdown.find((b) => b.service === 'gemini-3-pro');
      expect(geminiBreakdown).toMatchObject({
        service: 'gemini-3-pro',
        cost: 0.0068,
        tokens: { input: 300, output: 150 },
        callCount: 2,
      });

      const chirpBreakdown = summary.breakdown.find((b) => b.service === 'chirp3-hd');
      expect(chirpBreakdown).toMatchObject({
        service: 'chirp3-hd',
        cost: 0.0012,
        tokens: {},
        callCount: 1,
      });
    });

    it('should include timestamp in ISO 8601 UTC format', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);

      const summary = tracker.getSummary();

      expect(summary.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('persist', () => {
    it('should persist costs to Firestore with correct structure', async () => {
      mockGetPipelineCosts.mockResolvedValue(null);
      mockSetPipelineCosts.mockResolvedValue(undefined);

      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);

      await tracker.persist();

      expect(mockSetPipelineCosts).toHaveBeenCalledWith(
        '2026-01-08',
        expect.objectContaining({
          gemini: 0.0023,
          tts: 0,
          render: 0,
          total: 0.0023,
          stages: expect.objectContaining({
            'script-gen': expect.objectContaining({
              total: 0.0023,
              breakdown: expect.any(Array),
            }),
          }),
        })
      );
    });

    it('should merge with existing costs when document exists', async () => {
      mockGetPipelineCosts.mockResolvedValue({
        gemini: 0.001,
        tts: 0.002,
        render: 0,
        total: 0.003,
        stages: {
          'research': {
            total: 0.001,
            breakdown: [{
              service: 'gemini-2-pro',
              cost: 0.001,
              tokens: {},
              callCount: 1
            }],
          },
        },
      });
      mockSetPipelineCosts.mockResolvedValue(undefined);

      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);

      await tracker.persist();

      // New behavior: recalculates ALL costs from ALL stages (more accurate)
      expect(mockSetPipelineCosts).toHaveBeenCalledWith(
        '2026-01-08',
        expect.objectContaining({
          gemini: 0.0033, // 0.001 from research + 0.0023 from script-gen
          tts: 0,         // Recalculated from scratch (no TTS in stages)
          render: 0,      // Recalculated from scratch
          total: 0.0033,  // Sum of all services
          stages: expect.objectContaining({
            'research': expect.any(Object),
            'script-gen': expect.any(Object),
          }),
        })
      );
    });

    it('should throw NexusError on Firestore errors', async () => {
      mockGetPipelineCosts.mockRejectedValue(
        new Error('Firestore connection error')
      );

      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);

      await expect(tracker.persist()).rejects.toThrow(NexusError);
    });
  });

  describe('static getVideoCost', () => {
    it('should return total video cost from Firestore', async () => {
      mockGetPipelineCosts.mockResolvedValue({
        gemini: 0.0023,
        tts: 0.0045,
        render: 0.0012,
        total: 0.008,
      });

      const cost = await CostTracker.getVideoCost('2026-01-08');

      expect(cost).toBe(0.008);
    });

    it('should return 0 if no costs found', async () => {
      mockGetPipelineCosts.mockResolvedValue(null);

      const cost = await CostTracker.getVideoCost('2026-01-08');

      expect(cost).toBe(0);
    });

    it('should throw NexusError on Firestore errors', async () => {
      mockGetPipelineCosts.mockRejectedValue(
        new Error('Firestore connection error')
      );

      await expect(CostTracker.getVideoCost('2026-01-08')).rejects.toThrow(NexusError);
    });
  });

  describe('static getDailyCosts', () => {
    it('should return daily cost summary from Firestore', async () => {
      mockGetPipelineCosts.mockResolvedValue({
        gemini: 0.0023,
        tts: 0.0045,
        render: 0.0012,
        total: 0.008,
        stages: {
          research: { total: 0.001, breakdown: [] },
          'script-gen': { total: 0.0023, breakdown: [] },
        },
      });

      const summary = await CostTracker.getDailyCosts('2026-01-08');

      expect(summary).toMatchObject({
        date: '2026-01-08',
        totalCost: 0.008,
        breakdown: {
          gemini: 0.0023,
          tts: 0.0045,
          render: 0.0012,
        },
        stages: expect.objectContaining({
          research: expect.any(Object),
          'script-gen': expect.any(Object),
        }),
      });
    });

    it('should return empty summary if no costs found', async () => {
      mockGetPipelineCosts.mockResolvedValue(null);

      const summary = await CostTracker.getDailyCosts('2026-01-08');

      expect(summary).toMatchObject({
        date: '2026-01-08',
        totalCost: 0,
        breakdown: {
          gemini: 0,
          tts: 0,
          render: 0,
        },
        stages: {},
      });
    });

    it('should throw NexusError on Firestore errors', async () => {
      mockGetPipelineCosts.mockRejectedValue(
        new Error('Firestore connection error')
      );

      await expect(CostTracker.getDailyCosts('2026-01-08')).rejects.toThrow(NexusError);
    });
  });

  describe('4 decimal precision requirement', () => {
    it('should maintain 4 decimal precision for very small costs', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 10, output: 5 }, 0.0001);

      const summary = tracker.getSummary();

      expect(summary.totalCost).toBe(0.0001);
    });

    it('should round costs with more than 4 decimals', () => {
      tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.00015678);

      const summary = tracker.getSummary();

      expect(summary.totalCost).toBe(0.0002);
    });

    it('should handle accumulated rounding correctly', () => {
      // Test that exact costs are stored and only rounded during aggregation
      // This prevents accumulation errors from rounding too early
      tracker.recordApiCall('gemini-3-pro', { input: 10, output: 5 }, 0.00005);
      tracker.recordApiCall('gemini-3-pro', { input: 10, output: 5 }, 0.00005);

      const summary = tracker.getSummary();

      // With correct approach: store exact values, round during aggregation
      // 0.00005 + 0.00005 = 0.0001 (exact sum), then round = 0.0001
      // Old buggy approach would: round(0.00005) + round(0.00005) = 0.0001 + 0.0001 = 0.0002
      expect(summary.totalCost).toBe(0.0001);
    });
  });
});
