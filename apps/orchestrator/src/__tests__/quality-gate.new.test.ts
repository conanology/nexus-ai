/**
 * Integration tests for pre-publish quality gate in orchestrator
 * Tests the new qualityGateCheck function with full stage outputs
 * @module apps/orchestrator/__tests__/quality-gate.new.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { QualityContext } from '@nexus-ai/core';

// Mock @nexus-ai/core - use factory functions
vi.mock('@nexus-ai/core', () => {
  return {
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    qualityGateCheck: vi.fn(),
    persistQualityDecision: vi.fn(),
    createQualityReviewItem: vi.fn(),
    handleReviewApproval: vi.fn(),
    handleReviewRejection: vi.fn(),
    hasPendingCriticalReviews: vi.fn(),
    getPendingCriticalReviews: vi.fn(),
  };
});

// Mock notifications
vi.mock('@nexus-ai/notifications', () => ({
  sendDiscordAlert: vi.fn().mockResolvedValue({ success: true }),
}));

// Import after mocking
import { qualityGateCheck } from '../quality-gate.js';
import {
  qualityGateCheck as coreQualityGateCheck,
  persistQualityDecision,
  createQualityReviewItem,
  hasPendingCriticalReviews,
  getPendingCriticalReviews,
} from '@nexus-ai/core';

describe('Quality Gate Orchestrator Integration', () => {
  // Use partial mock stage outputs - actual type checking is done in core package tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockStageOutputs: Record<string, any> = {
    'script-gen': {
      success: true,
      data: { script: 'Test script content' },
      quality: { measurements: { wordCount: 1500 } },
      cost: { totalCost: 0.01, breakdown: [] },
      durationMs: 5000,
      provider: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
    },
    tts: {
      success: true,
      data: { audioUrl: 'gs://bucket/audio.wav' },
      quality: { measurements: {} },
      cost: { totalCost: 0.05, breakdown: [] },
      durationMs: 10000,
      provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 1 },
    },
    'visual-gen': {
      success: true,
      data: { scenes: [] },
      quality: { measurements: { fallbackCount: 0, totalScenes: 10 } },
      cost: { totalCost: 0.02, breakdown: [] },
      durationMs: 8000,
      provider: { name: 'gemini-image', tier: 'primary', attempts: 1 },
    },
  };

  const mockQualityContext: QualityContext = {
    degradedStages: [],
    fallbacksUsed: [],
    flags: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasPendingCriticalReviews).mockResolvedValue(false);
    vi.mocked(getPendingCriticalReviews).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create mock decisions without type checking (mocks don't need full types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDecisionFactory = (overrides: any = {}) => ({
    decision: 'AUTO_PUBLISH',
    reasons: ['All checks passed'],
    issues: [],
    metrics: { totalStages: 3 },
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  describe('qualityGateCheck integration', () => {
    it('should call core qualityGateCheck with pipeline context', async () => {
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(mockDecisionFactory());

      await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(vi.mocked(coreQualityGateCheck)).toHaveBeenCalledWith({
        pipelineId: '2026-01-22',
        stages: mockStageOutputs,
        qualityContext: mockQualityContext,
      });
    });

    it('should persist decision to Firestore', async () => {
      const decision = mockDecisionFactory();
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(decision);

      await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(vi.mocked(persistQualityDecision)).toHaveBeenCalledWith('2026-01-22', decision);
    });

    it('should return AUTO_PUBLISH when core returns AUTO_PUBLISH', async () => {
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(mockDecisionFactory());

      const result = await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(result.decision).toBe('AUTO_PUBLISH');
      expect(result.issues).toEqual([]);
    });

    it('should return AUTO_PUBLISH_WITH_WARNING for minor issues', async () => {
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(mockDecisionFactory({
        decision: 'AUTO_PUBLISH_WITH_WARNING',
        reasons: ['Minor issues detected'],
        issues: [
          { code: 'tts-retry-high', severity: 'minor', stage: 'tts', message: 'TTS required 4 attempts' },
        ],
      }));

      const result = await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
      expect(result.issues.length).toBe(1);
    });

    it('should return HUMAN_REVIEW and create review item for major issues', async () => {
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(mockDecisionFactory({
        decision: 'HUMAN_REVIEW',
        reasons: ['Major issues detected'],
        issues: [
          { code: 'tts-provider-fallback', severity: 'major', stage: 'tts', message: 'TTS fallback used' },
        ],
      }));
      vi.mocked(createQualityReviewItem).mockResolvedValueOnce('review-123');

      const result = await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.pauseBeforeStage).toBe('youtube');
      expect(result.reviewItemIds).toContain('review-123');
    });

    it('should prioritize pending reviews over stage issues', async () => {
      vi.mocked(hasPendingCriticalReviews).mockResolvedValueOnce(true);
      vi.mocked(getPendingCriticalReviews).mockResolvedValueOnce([
        {
          id: 'pending-review-1',
          type: 'pronunciation',
          stage: 'pronunciation',
          pipelineId: '2026-01-22',
          status: 'pending',
          item: {},
          context: {},
          createdAt: new Date().toISOString(),
          resolution: null,
          resolvedAt: null,
          resolvedBy: null,
        },
      ]);

      const result = await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.reason).toContain('pending review items');
      expect(result.reviewItemIds).toContain('pending-review-1');
      // Core qualityGateCheck should NOT be called when pending reviews exist
      expect(vi.mocked(coreQualityGateCheck)).not.toHaveBeenCalled();
    });

    it('should include coreDecision in result', async () => {
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(mockDecisionFactory({
        metrics: { totalStages: 3, scriptWordCount: 1500 },
        stageQualitySummary: {
          'script-gen': { status: 'pass', provider: 'gemini-3-pro', tier: 'primary' },
        },
      }));

      const result = await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(result.coreDecision).toBeDefined();
      expect(result.coreDecision?.metrics.totalStages).toBe(3);
      expect(result.coreDecision?.stageQualitySummary?.['script-gen']?.status).toBe('pass');
    });

    it('should handle persistence errors gracefully', async () => {
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(mockDecisionFactory());
      vi.mocked(persistQualityDecision).mockRejectedValueOnce(new Error('Firestore error'));

      // Should not throw
      const result = await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(result.decision).toBe('AUTO_PUBLISH');
    });

    it('should handle review check errors gracefully', async () => {
      vi.mocked(hasPendingCriticalReviews).mockRejectedValueOnce(new Error('Firestore error'));
      vi.mocked(coreQualityGateCheck).mockResolvedValueOnce(mockDecisionFactory());

      // Should not throw, should continue with other checks
      const result = await qualityGateCheck('2026-01-22', mockStageOutputs, mockQualityContext);

      expect(result.decision).toBe('AUTO_PUBLISH');
    });
  });
});
