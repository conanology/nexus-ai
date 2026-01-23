/**
 * Unit tests for pre-publish quality gate
 * @module @nexus-ai/core/quality/__tests__/pre-publish-gate.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectTTSFallback,
  detectTTSRetryIssues,
  detectVisualFallbackRatio,
  detectWordCountIssues,
  detectPronunciationIssues,
  detectThumbnailIssues,
  detectCombinedIssues,
  detectAllIssues,
  calculateMetrics,
  qualityGateCheck,
  persistQualityDecision,
  getQualityDecision,
  handleReviewRejection,
} from '../pre-publish-gate.js';
import type { PipelineQualityContext } from '../pre-publish-types.js';
import type { StageOutput, QualityContext } from '../../types/pipeline.js';

// Mock dependencies - use hoisted pattern to avoid initialization issues
const {
  mockSetDocument,
  mockGetDocument,
  mockResolveReviewItem,
  mockGetReviewItem,
  mockDeployBuffer,
  mockListAvailableBuffers,
} = vi.hoisted(() => ({
  mockSetDocument: vi.fn(),
  mockGetDocument: vi.fn(),
  mockResolveReviewItem: vi.fn(),
  mockGetReviewItem: vi.fn(),
  mockDeployBuffer: vi.fn(),
  mockListAvailableBuffers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../observability/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../buffer/client.js', () => ({
  getSharedFirestoreClient: vi.fn(() => ({
    setDocument: mockSetDocument,
    getDocument: mockGetDocument,
  })),
}));

vi.mock('../../review/manager.js', () => ({
  addToReviewQueue: vi.fn().mockResolvedValue('review-123'),
  resolveReviewItem: mockResolveReviewItem,
  getReviewItem: mockGetReviewItem,
}));

vi.mock('../../buffer/manager.js', () => ({
  deployBuffer: mockDeployBuffer,
  listAvailableBuffers: mockListAvailableBuffers,
}));

describe('Pre-publish Quality Gate', () => {
  // Helper to create a minimal stage output
  function createStageOutput(overrides: Partial<StageOutput<unknown>> = {}): StageOutput<unknown> {
    return {
      success: true,
      data: {},
      quality: { measurements: {} },
      cost: { totalCost: 0, breakdown: [] },
      durationMs: 1000,
      provider: { name: 'test-provider', tier: 'primary', attempts: 1 },
      ...overrides,
    } as StageOutput<unknown>;
  }

  // Helper to create pipeline context
  function createPipelineContext(
    stages: Record<string, Partial<StageOutput<unknown>>> = {},
    qualityContext: Partial<QualityContext> = {}
  ): PipelineQualityContext {
    const processedStages: Record<string, StageOutput<unknown>> = {};
    for (const [name, stage] of Object.entries(stages)) {
      processedStages[name] = createStageOutput(stage);
    }

    return {
      pipelineId: '2026-01-22',
      stages: processedStages,
      qualityContext: {
        degradedStages: [],
        fallbacksUsed: [],
        flags: [],
        ...qualityContext,
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectTTSFallback', () => {
    it('should return null when no TTS stage exists', () => {
      const context = createPipelineContext({});
      expect(detectTTSFallback(context)).toBeNull();
    });

    it('should return null when TTS uses primary provider', () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 1 } },
      });
      expect(detectTTSFallback(context)).toBeNull();
    });

    it('should return major issue when TTS uses fallback provider', () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'chirp3-hd', tier: 'fallback', attempts: 2 } },
      });

      const issue = detectTTSFallback(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('major');
      expect(issue?.code).toBe('tts-provider-fallback');
      expect(issue?.stage).toBe('tts');
    });
  });

  describe('detectTTSRetryIssues', () => {
    it('should return null when TTS succeeds on first attempt', () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 1 } },
      });
      expect(detectTTSRetryIssues(context)).toBeNull();
    });

    it('should return minor issue when TTS requires >2 attempts', () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 4 } },
      });

      const issue = detectTTSRetryIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('minor');
      expect(issue?.code).toBe('tts-retry-high');
    });
  });

  describe('detectVisualFallbackRatio', () => {
    it('should return null when no visual-gen stage exists', () => {
      const context = createPipelineContext({});
      expect(detectVisualFallbackRatio(context)).toBeNull();
    });

    it('should return null when no fallback visuals used', () => {
      const context = createPipelineContext({
        'visual-gen': {
          quality: { measurements: { fallbackCount: 0, totalScenes: 10 } },
        },
      });
      expect(detectVisualFallbackRatio(context)).toBeNull();
    });

    it('should return minor issue when fallback rate is 1-30%', () => {
      const context = createPipelineContext({
        'visual-gen': {
          quality: { measurements: { fallbackCount: 2, totalScenes: 10 } },
        },
      });

      const issue = detectVisualFallbackRatio(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('minor');
      expect(issue?.code).toBe('visual-fallback-low');
    });

    it('should return major issue when fallback rate exceeds 30%', () => {
      const context = createPipelineContext({
        'visual-gen': {
          quality: { measurements: { fallbackCount: 5, totalScenes: 10 } },
        },
      });

      const issue = detectVisualFallbackRatio(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('major');
      expect(issue?.code).toBe('visual-fallback-30');
    });
  });

  describe('detectWordCountIssues', () => {
    it('should return null when word count is within range', () => {
      const context = createPipelineContext({
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
        },
      });
      expect(detectWordCountIssues(context)).toBeNull();
    });

    it('should return major issue when word count is below minimum', () => {
      const context = createPipelineContext({
        'script-gen': {
          quality: { measurements: { wordCount: 1100 } },
        },
      });

      const issue = detectWordCountIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('major');
      expect(issue?.code).toBe('word-count-out-of-bounds');
    });

    it('should return major issue when word count exceeds maximum', () => {
      const context = createPipelineContext({
        'script-gen': {
          quality: { measurements: { wordCount: 1900 } },
        },
      });

      const issue = detectWordCountIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('major');
      expect(issue?.code).toBe('word-count-out-of-bounds');
    });

    it('should return minor issue when word count is near boundary', () => {
      const context = createPipelineContext({
        'script-gen': {
          quality: { measurements: { wordCount: 1220 } }, // Near 1200 minimum
        },
      });

      const issue = detectWordCountIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('minor');
      expect(issue?.code).toBe('word-count-edge');
    });
  });

  describe('detectPronunciationIssues', () => {
    it('should return null when no pronunciation unknowns', () => {
      const context = createPipelineContext({
        pronunciation: {
          quality: { measurements: { unknownCount: 0 } },
        },
      });
      expect(detectPronunciationIssues(context)).toBeNull();
    });

    it('should return minor issue when 1-3 unknowns', () => {
      const context = createPipelineContext({
        pronunciation: {
          quality: { measurements: { unknownCount: 2 } },
        },
      });

      const issue = detectPronunciationIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('minor');
      expect(issue?.code).toBe('pronunciation-unknown-1-3');
    });

    it('should return major issue when >3 unresolved unknowns', () => {
      const context = createPipelineContext({
        pronunciation: {
          quality: { measurements: { unresolvedCount: 5 } },
        },
      });

      const issue = detectPronunciationIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('major');
      expect(issue?.code).toBe('pronunciation-unknown-3+');
    });
  });

  describe('detectThumbnailIssues', () => {
    it('should return null when thumbnail uses primary provider', () => {
      const context = createPipelineContext({
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });
      expect(detectThumbnailIssues(context)).toBeNull();
    });

    it('should return minor issue when thumbnail uses fallback', () => {
      const context = createPipelineContext({
        thumbnail: { provider: { name: 'template', tier: 'fallback', attempts: 1 } },
      });

      const issue = detectThumbnailIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('minor');
      expect(issue?.code).toBe('thumbnail-fallback');
    });
  });

  describe('detectCombinedIssues', () => {
    it('should return null when only thumbnail fallback', () => {
      const context = createPipelineContext({
        thumbnail: { provider: { name: 'template', tier: 'fallback', attempts: 1 } },
        'visual-gen': {
          quality: { measurements: { fallbackCount: 0, totalScenes: 10 } },
        },
      });
      expect(detectCombinedIssues(context)).toBeNull();
    });

    it('should return major issue when both thumbnail and visual fallback', () => {
      const context = createPipelineContext({
        thumbnail: { provider: { name: 'template', tier: 'fallback', attempts: 1 } },
        'visual-gen': {
          quality: { measurements: { fallbackCount: 2, totalScenes: 10 } },
        },
      });

      const issue = detectCombinedIssues(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('major');
      expect(issue?.code).toBe('combined-fallback');
    });
  });

  describe('detectAllIssues', () => {
    it('should return empty array when no issues', () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 1 } },
        'visual-gen': {
          quality: { measurements: { fallbackCount: 0, totalScenes: 10 } },
        },
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
        },
        pronunciation: {
          quality: { measurements: { unknownCount: 0 } },
        },
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });

      const issues = detectAllIssues(context);

      expect(issues).toEqual([]);
    });

    it('should detect multiple issues', () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'chirp3-hd', tier: 'fallback', attempts: 2 } },
        'script-gen': {
          quality: { measurements: { wordCount: 1100 } },
        },
      });

      const issues = detectAllIssues(context);

      expect(issues.length).toBeGreaterThanOrEqual(2);
      expect(issues.some((i) => i.code === 'tts-provider-fallback')).toBe(true);
      expect(issues.some((i) => i.code === 'word-count-out-of-bounds')).toBe(true);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics from pipeline stages', () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 1 } },
        'visual-gen': {
          quality: { measurements: { fallbackCount: 1, totalScenes: 10 } },
        },
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
        },
        pronunciation: {
          quality: { measurements: { unknownCount: 2 } },
        },
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });

      const metrics = calculateMetrics(context);

      expect(metrics.totalStages).toBe(5);
      expect(metrics.scriptWordCount).toBe(1500);
      expect(metrics.visualFallbackPercent).toBe(10);
      expect(metrics.pronunciationUnknowns).toBe(2);
      expect(metrics.ttsProvider).toBe('gemini-2.5-pro-tts');
      expect(metrics.thumbnailFallback).toBe(false);
    });
  });

  describe('qualityGateCheck', () => {
    it('should return AUTO_PUBLISH when no issues', async () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 1 } },
        'visual-gen': {
          quality: { measurements: { fallbackCount: 0, totalScenes: 10 } },
        },
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
        },
        pronunciation: {
          quality: { measurements: { unknownCount: 0 } },
        },
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });

      const result = await qualityGateCheck(context);

      expect(result.decision).toBe('AUTO_PUBLISH');
      expect(result.issues).toEqual([]);
    });

    it('should return AUTO_PUBLISH_WITH_WARNING for 1-2 minor issues', async () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 4 } }, // Minor: high retries
        'visual-gen': {
          quality: { measurements: { fallbackCount: 0, totalScenes: 10 } },
        },
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
        },
        pronunciation: {
          quality: { measurements: { unknownCount: 0 } },
        },
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });

      const result = await qualityGateCheck(context);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
      expect(result.issues.some((i) => i.severity === 'minor')).toBe(true);
    });

    it('should return HUMAN_REVIEW for any major issue', async () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'chirp3-hd', tier: 'fallback', attempts: 2 } }, // Major: TTS fallback
        'visual-gen': {
          quality: { measurements: { fallbackCount: 0, totalScenes: 10 } },
        },
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
        },
        pronunciation: {
          quality: { measurements: { unknownCount: 0 } },
        },
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });

      const result = await qualityGateCheck(context);

      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.issues.some((i) => i.severity === 'major')).toBe(true);
    });

    it('should return HUMAN_REVIEW for >2 minor issues', async () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 4 } }, // Minor: high retries
        'visual-gen': {
          quality: { measurements: { fallbackCount: 1, totalScenes: 10 } }, // Minor: low visual fallback
        },
        'script-gen': {
          quality: { measurements: { wordCount: 1220 } }, // Minor: near boundary
        },
        pronunciation: {
          quality: { measurements: { unknownCount: 0 } },
        },
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });

      const result = await qualityGateCheck(context);

      expect(result.decision).toBe('HUMAN_REVIEW');
    });

    it('should include stage quality summary in result', async () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'chirp3-hd', tier: 'fallback', attempts: 2 } },
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
          provider: { name: 'gemini-3-pro', tier: 'primary', attempts: 1 },
        },
      });

      const result = await qualityGateCheck(context);

      expect(result.stageQualitySummary).toBeDefined();
      expect(result.stageQualitySummary?.['tts']?.status).toBe('fail');
      expect(result.stageQualitySummary?.['script-gen']?.status).toBe('pass');
    });

    it('should return AUTO_PUBLISH_WITH_WARNING for exactly 2 minor issues', async () => {
      const context = createPipelineContext({
        tts: { provider: { name: 'gemini-2.5-pro-tts', tier: 'primary', attempts: 4 } }, // Minor: high retries
        'visual-gen': {
          quality: { measurements: { fallbackCount: 1, totalScenes: 10 } }, // Minor: low visual fallback (10%)
        },
        'script-gen': {
          quality: { measurements: { wordCount: 1500 } },
        },
        pronunciation: {
          quality: { measurements: { unknownCount: 0 } },
        },
        thumbnail: { provider: { name: 'gemini-image', tier: 'primary', attempts: 1 } },
      });

      const result = await qualityGateCheck(context);

      expect(result.decision).toBe('AUTO_PUBLISH_WITH_WARNING');
      expect(result.issues.filter((i) => i.severity === 'minor').length).toBe(2);
    });
  });

  describe('detectVisualFallbackRatio boundary tests', () => {
    it('should return major issue when fallback rate is exactly 30% (boundary)', () => {
      const context = createPipelineContext({
        'visual-gen': {
          quality: { measurements: { fallbackCount: 3, totalScenes: 10 } }, // Exactly 30%
        },
      });

      const issue = detectVisualFallbackRatio(context);

      // At exactly 30%, should be minor (not exceeding threshold)
      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('minor');
      expect(issue?.code).toBe('visual-fallback-low');
    });

    it('should return major issue when fallback rate is 31% (just over boundary)', () => {
      const context = createPipelineContext({
        'visual-gen': {
          quality: { measurements: { fallbackCount: 31, totalScenes: 100 } }, // 31%
        },
      });

      const issue = detectVisualFallbackRatio(context);

      expect(issue).not.toBeNull();
      expect(issue?.severity).toBe('major');
      expect(issue?.code).toBe('visual-fallback-30');
    });
  });

  describe('persistQualityDecision', () => {
    beforeEach(() => {
      mockSetDocument.mockClear();
    });

    it('should persist decision to Firestore at correct path', async () => {
      mockSetDocument.mockResolvedValueOnce(undefined);

      const decision = {
        decision: 'AUTO_PUBLISH' as const,
        reasons: ['All checks passed'],
        issues: [],
        metrics: {
          totalStages: 5,
          degradedStages: 0,
          fallbacksUsed: 0,
          totalWarnings: 0,
          scriptWordCount: 1500,
          visualFallbackPercent: 0,
          pronunciationUnknowns: 0,
          ttsProvider: 'gemini-2.5-pro-tts',
          thumbnailFallback: false,
        },
        timestamp: '2026-01-22T12:00:00.000Z',
      };

      await persistQualityDecision('2026-01-22', decision);

      expect(mockSetDocument).toHaveBeenCalledWith(
        'pipelines/2026-01-22',
        'quality-decision',
        expect.objectContaining({
          decision: 'AUTO_PUBLISH',
          version: 1,
        })
      );
    });

    it('should handle persistence errors gracefully', async () => {
      mockSetDocument.mockRejectedValueOnce(new Error('Firestore error'));

      const decision = {
        decision: 'AUTO_PUBLISH' as const,
        reasons: ['All checks passed'],
        issues: [],
        metrics: {
          totalStages: 5,
          degradedStages: 0,
          fallbacksUsed: 0,
          totalWarnings: 0,
          scriptWordCount: 1500,
          visualFallbackPercent: 0,
          pronunciationUnknowns: 0,
          ttsProvider: 'gemini-2.5-pro-tts',
          thumbnailFallback: false,
        },
        timestamp: '2026-01-22T12:00:00.000Z',
      };

      // Should not throw
      await expect(persistQualityDecision('2026-01-22', decision)).resolves.not.toThrow();
    });
  });

  describe('getQualityDecision', () => {
    beforeEach(() => {
      mockGetDocument.mockClear();
    });

    it('should retrieve decision from Firestore', async () => {
      const storedDecision = {
        decision: 'HUMAN_REVIEW',
        reasons: ['Major issues'],
        issues: [{ code: 'tts-provider-fallback', severity: 'major', stage: 'tts', message: 'TTS fallback used' }],
        metrics: { totalStages: 5 },
        timestamp: '2026-01-22T12:00:00.000Z',
        version: 1,
      };
      mockGetDocument.mockResolvedValueOnce(storedDecision);

      const result = await getQualityDecision('2026-01-22');

      expect(mockGetDocument).toHaveBeenCalledWith('pipelines/2026-01-22', 'quality-decision');
      expect(result?.decision).toBe('HUMAN_REVIEW');
    });

    it('should return null when decision not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      const result = await getQualityDecision('2026-01-22');

      expect(result).toBeNull();
    });

    it('should handle retrieval errors gracefully', async () => {
      mockGetDocument.mockRejectedValueOnce(new Error('Firestore error'));

      const result = await getQualityDecision('2026-01-22');

      expect(result).toBeNull();
    });
  });

  describe('handleReviewRejection', () => {
    beforeEach(() => {
      mockGetReviewItem.mockClear();
      mockResolveReviewItem.mockClear();
      mockListAvailableBuffers.mockClear();
      mockDeployBuffer.mockClear();
    });

    it('should deploy buffer and resolve review on successful rejection', async () => {
      mockGetReviewItem.mockResolvedValueOnce({
        id: 'review-123',
        type: 'quality',
        pipelineId: '2026-01-22',
        stage: 'pre-publish',
        status: 'pending',
        item: {},
        context: {},
        createdAt: '2026-01-22T12:00:00.000Z',
        resolution: null,
        resolvedAt: null,
        resolvedBy: null,
      });
      mockListAvailableBuffers.mockResolvedValueOnce([
        { id: 'buffer-001', title: 'Buffer Video 1' },
      ]);
      mockDeployBuffer.mockResolvedValueOnce({
        success: true,
        videoId: 'youtube-video-123',
      });
      mockResolveReviewItem.mockResolvedValueOnce(undefined);

      const result = await handleReviewRejection('review-123', 'operator@test.com');

      expect(result.success).toBe(true);
      expect(result.bufferId).toBe('buffer-001');
      expect(result.videoId).toBe('youtube-video-123');
      expect(mockDeployBuffer).toHaveBeenCalledWith('buffer-001', '2026-01-22');
      expect(mockResolveReviewItem).toHaveBeenCalledWith(
        'review-123',
        expect.stringContaining('deployed buffer buffer-001'),
        'operator@test.com'
      );
    });

    it('should return error when no buffers available', async () => {
      mockGetReviewItem.mockResolvedValueOnce({
        id: 'review-123',
        type: 'quality',
        pipelineId: '2026-01-22',
        stage: 'pre-publish',
        status: 'pending',
        item: {},
        context: {},
        createdAt: '2026-01-22T12:00:00.000Z',
        resolution: null,
        resolvedAt: null,
        resolvedBy: null,
      });
      mockListAvailableBuffers.mockResolvedValueOnce([]);

      const result = await handleReviewRejection('review-123', 'operator@test.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No buffer videos available');
    });

    it('should return error when review item not found', async () => {
      mockGetReviewItem.mockResolvedValueOnce(null);

      const result = await handleReviewRejection('review-123', 'operator@test.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Review item not found');
    });

    it('should return error when review already resolved', async () => {
      mockGetReviewItem.mockResolvedValueOnce({
        id: 'review-123',
        type: 'quality',
        pipelineId: '2026-01-22',
        stage: 'pre-publish',
        status: 'resolved',
        item: {},
        context: {},
        createdAt: '2026-01-22T12:00:00.000Z',
        resolution: 'Approved',
        resolvedAt: '2026-01-22T13:00:00.000Z',
        resolvedBy: 'other@test.com',
      });

      const result = await handleReviewRejection('review-123', 'operator@test.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already resolved');
    });
  });
});
