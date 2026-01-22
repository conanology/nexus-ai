/**
 * Tests for pre-publish quality gate review queue integration
 * @module apps/orchestrator/__tests__/quality-gate.review.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineState } from '../state.js';

// Mock @nexus-ai/core - declare mocks before vi.mock call
vi.mock('@nexus-ai/core', () => {
  const mockHasPendingCriticalReviews = vi.fn();
  const mockGetPendingCriticalReviews = vi.fn();
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    hasPendingCriticalReviews: mockHasPendingCriticalReviews,
    getPendingCriticalReviews: mockGetPendingCriticalReviews,
    createLogger: vi.fn(() => mockLogger),
  };
});

// Import after mocking
import { qualityGateCheck } from '../quality-gate.js';
import { hasPendingCriticalReviews, getPendingCriticalReviews } from '@nexus-ai/core';

describe('Quality Gate Review Queue Integration', () => {
  const basePipelineState: PipelineState = {
    pipelineId: '2026-01-22',
    status: 'running',
    currentStage: 'youtube',
    startTime: '2026-01-22T08:00:00.000Z',
    stages: {},
    qualityContext: {
      degradedStages: [],
      fallbacksUsed: [],
      flags: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Pending review items check', () => {
    it('should return HUMAN_REVIEW when pending critical reviews exist', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(true);
      vi.mocked(getPendingCriticalReviews).mockResolvedValueOnce([
        {
          id: 'review-1',
          type: 'pronunciation',
          pipelineId: '2026-01-22',
          stage: 'pronunciation',
          status: 'pending',
          item: {},
          context: {},
          createdAt: '2026-01-22T09:00:00.000Z',
          resolution: null,
          resolvedAt: null,
          resolvedBy: null,
        },
      ]);

      const result = await qualityGateCheck(basePipelineState);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.reason).toContain('1 pending review items');
    });

    it('should include review item IDs in result', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(true);
      vi.mocked(getPendingCriticalReviews).mockResolvedValueOnce([
        { id: 'review-1', type: 'pronunciation', stage: 'pronunciation', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
        { id: 'review-2', type: 'quality', stage: 'script-gen', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
      ]);

      const result = await qualityGateCheck(basePipelineState);

      expect(result.reviewItemIds).toEqual(['review-1', 'review-2']);
    });

    it('should set pauseBeforeStage to youtube', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(true);
      vi.mocked(getPendingCriticalReviews).mockResolvedValueOnce([
        { id: 'review-1', type: 'quality', stage: 'script-gen', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
      ]);

      const result = await qualityGateCheck(basePipelineState);

      expect(result.pauseBeforeStage).toBe('youtube');
    });

    it('should list issues for each pending review type', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(true);
      vi.mocked(getPendingCriticalReviews).mockResolvedValueOnce([
        { id: 'review-1', type: 'pronunciation', stage: 'pronunciation', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
        { id: 'review-2', type: 'quality', stage: 'thumbnail', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
      ]);

      const result = await qualityGateCheck(basePipelineState);

      expect(result.issues).toContain('Pending pronunciation review from pronunciation stage');
      expect(result.issues).toContain('Pending quality review from thumbnail stage');
    });

    it('should continue with other checks when no pending reviews', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(false);

      const cleanState: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      };

      const result = await qualityGateCheck(cleanState);

      expect(result.decision).toBe('AUTO_PUBLISH');
      expect(result.reviewItemIds).toBeUndefined();
      expect(result.pauseBeforeStage).toBeUndefined();
    });

    it('should handle review check errors gracefully', async () => {
      vi.mocked(hasPendingCriticalReviews).mockRejectedValueOnce(new Error('Connection failed'));

      const cleanState: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      };

      // Should not throw, should continue with other checks
      const result = await qualityGateCheck(cleanState);

      expect(result.decision).toBe('AUTO_PUBLISH');
    });

    it('should handle multiple pending reviews', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(true);
      vi.mocked(getPendingCriticalReviews).mockResolvedValueOnce([
        { id: 'review-1', type: 'pronunciation', stage: 'pronunciation', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
        { id: 'review-2', type: 'quality', stage: 'script-gen', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
        { id: 'review-3', type: 'quality', stage: 'thumbnail', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
      ]);

      const result = await qualityGateCheck(basePipelineState);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.reason).toContain('3 pending review items');
      expect(result.reviewItemIds).toHaveLength(3);
    });
  });

  describe('Combined quality issues', () => {
    it('should prioritize pending reviews over other quality issues', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(true);
      vi.mocked(getPendingCriticalReviews).mockResolvedValueOnce([
        { id: 'review-1', type: 'pronunciation', stage: 'pronunciation', status: 'pending', pipelineId: '2026-01-22', item: {}, context: {}, createdAt: '2026-01-22T09:00:00.000Z', resolution: null, resolvedAt: null, resolvedBy: null },
      ]);

      // Even with other issues, pending reviews should trigger HUMAN_REVIEW
      const stateWithIssues: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: ['script-gen'],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: ['word-count-low'],
        },
      };

      const result = await qualityGateCheck(stateWithIssues);

      expect(result.decision).toBe('HUMAN_REVIEW');
      // The reason should be about pending reviews, not fallbacks
      expect(result.reason).toContain('pending review items');
      expect(result.pauseBeforeStage).toBe('youtube');
    });

    it('should return HUMAN_REVIEW for TTS fallback when no pending reviews', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(false);

      const stateWithTTSFallback: PipelineState = {
        ...basePipelineState,
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: ['tts:chirp3-hd'],
          flags: [],
        },
      };

      const result = await qualityGateCheck(stateWithTTSFallback);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues).toContain('TTS fallback used');
    });
  });
});
