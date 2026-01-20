/**
 * Integration tests for pipeline execution
 * Tests full pipeline flow with mocked stages and real state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executePipeline,
  resumePipeline,
} from '../pipeline.js';
import { stageRegistry, stageOrder } from '../stages.js';
import { PipelineStateManager } from '../state.js';
import { NexusError } from '@nexus-ai/core';

// Mock the stages module
vi.mock('../stages.js', () => ({
  stageRegistry: {
    'news-sourcing': vi.fn(),
    'research': vi.fn(),
    'script-gen': vi.fn(),
    'pronunciation': vi.fn(),
    'tts': vi.fn(),
    'visual-gen': vi.fn(),
    'thumbnail': vi.fn(),
    'youtube': vi.fn(),
    'twitter': vi.fn(),
    'notifications': vi.fn(),
  },
  stageOrder: [
    'news-sourcing',
    'research',
    'script-gen',
    'pronunciation',
    'tts',
    'visual-gen',
    'thumbnail',
    'youtube',
    'twitter',
    'notifications',
  ],
}));

// Mock the state manager
vi.mock('../state.js', () => ({
  PipelineStateManager: vi.fn().mockImplementation(() => ({
    initializePipeline: vi.fn(),
    updateStageStatus: vi.fn(),
    getState: vi.fn(),
    markComplete: vi.fn(),
    markFailed: vi.fn(),
    updateQualityContext: vi.fn(),
    updateRetryAttempts: vi.fn(),
    persistStageOutput: vi.fn(),
    loadStageOutput: vi.fn(),
    updateTotalCost: vi.fn(),
  })),
}));

// Mock logger
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

// Helper to create mock stage output with realistic data
function createMockStageOutput(
  stageName: string,
  data: unknown = {},
  options: { tier?: 'primary' | 'fallback'; provider?: string } = {}
) {
  return {
    success: true,
    data,
    quality: {
      stage: stageName,
      timestamp: new Date().toISOString(),
      measurements: {},
    },
    cost: {
      stage: stageName,
      totalCost: 0.01 + Math.random() * 0.05,
      entries: [],
    },
    durationMs: 100 + Math.floor(Math.random() * 500),
    provider: {
      name: options.provider || 'gemini-3-pro',
      tier: options.tier || 'primary',
      attempts: options.tier === 'fallback' ? 2 : 1,
    },
    warnings: [],
  };
}

describe('Pipeline Integration Tests', () => {
  let mockStateManager: {
    initializePipeline: ReturnType<typeof vi.fn>;
    updateStageStatus: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    markComplete: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    updateQualityContext: ReturnType<typeof vi.fn>;
    updateRetryAttempts: ReturnType<typeof vi.fn>;
    persistStageOutput: ReturnType<typeof vi.fn>;
    loadStageOutput: ReturnType<typeof vi.fn>;
    updateTotalCost: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateManager = {
      initializePipeline: vi.fn(),
      updateStageStatus: vi.fn(),
      getState: vi.fn().mockRejectedValue(
        new Error('Pipeline state not found') // No existing pipeline
      ),
      markComplete: vi.fn(),
      markFailed: vi.fn(),
      updateQualityContext: vi.fn(),
    updateRetryAttempts: vi.fn(),
    persistStageOutput: vi.fn(),
    loadStageOutput: vi.fn(),
    updateTotalCost: vi.fn(),
    };

    (PipelineStateManager as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockStateManager
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full Pipeline Execution', () => {
    it('executes full pipeline with realistic stage data', async () => {
      // Setup realistic stage outputs
      (stageRegistry['news-sourcing'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('news-sourcing', {
          topic: {
            title: 'New AI Breakthrough',
            source: 'hackernews',
            score: 0.95,
            url: 'https://example.com/article',
          },
        })
      );

      (stageRegistry['research'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('research', {
          brief: 'A comprehensive research brief about AI breakthroughs...',
          sources: ['source1.com', 'source2.com'],
          wordCount: 2100,
        })
      );

      (stageRegistry['script-gen'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('script-gen', {
          script: 'Welcome to today\'s video about AI breakthroughs...',
          wordCount: 1500,
          visualCues: 12,
        })
      );

      (stageRegistry['pronunciation'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('pronunciation', {
          ssmlScript: '<speak>Welcome to today\'s video...</speak>',
          unknownTerms: 2,
        })
      );

      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('tts', {
          audioUrl: 'gs://nexus-ai-artifacts/2026-01-19/tts/audio.wav',
          durationSeconds: 480,
        })
      );

      (stageRegistry['visual-gen'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('visual-gen', {
          timelineUrl: 'gs://nexus-ai-artifacts/2026-01-19/visual-gen/timeline.json',
          sceneCount: 15,
        })
      );

      (stageRegistry['thumbnail'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('thumbnail', {
          thumbnails: [
            'gs://nexus-ai-artifacts/2026-01-19/thumbnails/1.png',
            'gs://nexus-ai-artifacts/2026-01-19/thumbnails/2.png',
            'gs://nexus-ai-artifacts/2026-01-19/thumbnails/3.png',
          ],
          variantCount: 3,
        })
      );

      (stageRegistry['youtube'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('youtube', {
          videoId: 'abc123xyz',
          status: 'scheduled',
          scheduledTime: '2026-01-19T14:00:00Z',
        })
      );

      (stageRegistry['twitter'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('twitter', {
          tweetUrl: 'https://twitter.com/user/status/12345',
          posted: true,
        })
      );

      (stageRegistry['notifications'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('notifications', {
          emailSent: true,
          discordSent: true,
        })
      );

      const result = await executePipeline('2026-01-19');

      // Verify pipeline success
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      // 9 main stages + notifications = 10
      expect(result.completedStages).toHaveLength(10);

      // Verify all stages were called in order
      for (let i = 0; i < stageOrder.length; i++) {
        const stageMock = stageRegistry[stageOrder[i]] as ReturnType<typeof vi.fn>;
        expect(stageMock).toHaveBeenCalled();

        // Verify stage received correct input structure
        const call = stageMock.mock.calls[0][0];
        expect(call.pipelineId).toBe('2026-01-19');
        expect(call.config).toBeDefined();
        expect(call.qualityContext).toBeDefined();

        if (i > 0) {
          expect(call.previousStage).toBe(stageOrder[i - 1]);
        }
      }

      // Verify state was updated
      expect(mockStateManager.initializePipeline).toHaveBeenCalledWith('2026-01-19');
      expect(mockStateManager.markComplete).toHaveBeenCalledWith('2026-01-19');

      // Verify total cost is aggregated
      expect(result.totalCost).toBeGreaterThan(0);
    });

    it('handles pipeline with fallback providers', async () => {
      // Setup all stages to succeed
      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue(createMockStageOutput(stageName));
      }

      // TTS uses fallback
      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput(
          'tts',
          { audioUrl: 'gs://...', durationSeconds: 480 },
          { tier: 'fallback', provider: 'chirp3-hd' }
        )
      );

      // Visual-gen uses fallback
      (stageRegistry['visual-gen'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput(
          'visual-gen',
          { timelineUrl: 'gs://...', sceneCount: 15 },
          { tier: 'fallback', provider: 'template' }
        )
      );

      const result = await executePipeline('2026-01-19');

      // Pipeline should still succeed
      expect(result.success).toBe(true);

      // Quality context should track fallbacks
      expect(result.qualityContext.fallbacksUsed).toContain('tts:chirp3-hd');
      expect(result.qualityContext.fallbacksUsed).toContain('visual-gen:template');
    });

    it('handles mid-pipeline failure and records partial progress', async () => {
      // First 4 stages succeed
      (stageRegistry['news-sourcing'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('news-sourcing', { topic: {} })
      );
      (stageRegistry['research'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('research', { brief: '...' })
      );
      (stageRegistry['script-gen'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('script-gen', { script: '...' })
      );
      (stageRegistry['pronunciation'] as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockStageOutput('pronunciation', { ssmlScript: '...' })
      );

      // TTS fails critically
      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(
        NexusError.critical(
          'NEXUS_TTS_ALL_PROVIDERS_FAILED',
          'All TTS providers failed',
          'tts'
        )
      );

      const result = await executePipeline('2026-01-19');

      // Pipeline should fail
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');

      // Should record completed stages
      expect(result.completedStages).toEqual([
        'news-sourcing',
        'research',
        'script-gen',
        'pronunciation',
      ]);

      // Error should be recorded
      expect(result.error?.code).toBe('NEXUS_TTS_ALL_PROVIDERS_FAILED');
      expect(result.error?.stage).toBe('tts');

      // Later stages should not be called
      expect(stageRegistry['visual-gen']).not.toHaveBeenCalled();
      expect(stageRegistry['youtube']).not.toHaveBeenCalled();
    });

    it('continues pipeline after recoverable stage failure', async () => {
      // All stages succeed except twitter
      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue(createMockStageOutput(stageName));
      }

      // Twitter fails with recoverable error
      (stageRegistry['twitter'] as ReturnType<typeof vi.fn>).mockRejectedValue(
        NexusError.recoverable(
          'NEXUS_TWITTER_API_ERROR',
          'Twitter API rate limited',
          'twitter'
        )
      );

      const result = await executePipeline('2026-01-19');

      // Pipeline should succeed overall
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');

      // Twitter should be in skipped stages
      expect(result.skippedStages).toContain('twitter');

      // All other stages should be completed (8 main stages + notifications = 9)
      expect(result.completedStages).toHaveLength(9);
    });
  });

  describe('Pipeline Resume', () => {
    it('resumes from last successful stage', async () => {
      // Simulate state with stages 1-5 completed
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-19',
        status: 'running',
        currentStage: 'tts',
        startTime: new Date().toISOString(),
        stages: {
          'news-sourcing': { status: 'completed' },
          'research': { status: 'completed' },
          'script-gen': { status: 'completed' },
          'pronunciation': { status: 'completed' },
          'tts': { status: 'completed' },
        },
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });

      // Setup remaining stages
      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue(createMockStageOutput(stageName));
      }

      const result = await resumePipeline('2026-01-19');

      // Should succeed
      expect(result.success).toBe(true);

      // Earlier stages should NOT be called
      expect(stageRegistry['news-sourcing']).not.toHaveBeenCalled();
      expect(stageRegistry['research']).not.toHaveBeenCalled();
      expect(stageRegistry['script-gen']).not.toHaveBeenCalled();
      expect(stageRegistry['pronunciation']).not.toHaveBeenCalled();
      expect(stageRegistry['tts']).not.toHaveBeenCalled();

      // Later stages SHOULD be called
      expect(stageRegistry['visual-gen']).toHaveBeenCalled();
      expect(stageRegistry['thumbnail']).toHaveBeenCalled();
      expect(stageRegistry['youtube']).toHaveBeenCalled();
      expect(stageRegistry['twitter']).toHaveBeenCalled();

      // Completed stages should include both pre-existing and newly completed
      expect(result.completedStages).toContain('news-sourcing');
      expect(result.completedStages).toContain('visual-gen');
    });

    it('resumes from explicit stage parameter', async () => {
      // Simulate state with stages 1-7 completed
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-19',
        status: 'running',
        currentStage: 'thumbnail',
        startTime: new Date().toISOString(),
        stages: {
          'news-sourcing': { status: 'completed' },
          'research': { status: 'completed' },
          'script-gen': { status: 'completed' },
          'pronunciation': { status: 'completed' },
          'tts': { status: 'completed' },
          'visual-gen': { status: 'completed' },
          'thumbnail': { status: 'completed' },
        },
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });

      // Setup all stages
      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue(createMockStageOutput(stageName));
      }

      // Resume from tts (re-run tts and later)
      const result = await resumePipeline('2026-01-19', 'tts');

      // Stages before tts should NOT be called
      expect(stageRegistry['news-sourcing']).not.toHaveBeenCalled();
      expect(stageRegistry['research']).not.toHaveBeenCalled();
      expect(stageRegistry['script-gen']).not.toHaveBeenCalled();
      expect(stageRegistry['pronunciation']).not.toHaveBeenCalled();

      // TTS and later should be called
      expect(stageRegistry['tts']).toHaveBeenCalled();
      expect(stageRegistry['visual-gen']).toHaveBeenCalled();
      expect(stageRegistry['thumbnail']).toHaveBeenCalled();
      expect(stageRegistry['youtube']).toHaveBeenCalled();
      expect(stageRegistry['twitter']).toHaveBeenCalled();

      expect(result.success).toBe(true);
    });

    it('handles failure during resume', async () => {
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-19',
        status: 'running',
        currentStage: 'tts',
        startTime: new Date().toISOString(),
        stages: {
          'news-sourcing': { status: 'completed' },
          'research': { status: 'completed' },
        },
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });

      // Setup stages to succeed
      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue(createMockStageOutput(stageName));
      }

      // Make youtube fail
      (stageRegistry['youtube'] as ReturnType<typeof vi.fn>).mockRejectedValue(
        NexusError.critical(
          'NEXUS_YOUTUBE_AUTH_FAILED',
          'YouTube authentication failed',
          'youtube'
        )
      );

      const result = await resumePipeline('2026-01-19');

      // Should fail
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NEXUS_YOUTUBE_AUTH_FAILED');

      // Should record completed stages up to failure
      expect(result.completedStages).toContain('script-gen');
      expect(result.completedStages).toContain('thumbnail');
    });
  });

  describe('Cost Tracking', () => {
    it('aggregates costs from all stages', async () => {
      // Setup stages with specific costs
      const stageCosts: Record<string, number> = {
        'news-sourcing': 0.01,
        'research': 0.15,
        'script-gen': 0.12,
        'pronunciation': 0.02,
        'tts': 0.08,
        'visual-gen': 0.10,
        'thumbnail': 0.05,
        'youtube': 0.00,
        'twitter': 0.00,
      };

      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue({
          success: true,
          data: {},
          quality: {
            stage: stageName,
            timestamp: new Date().toISOString(),
            measurements: {},
          },
          cost: {
            stage: stageName,
            totalCost: stageCosts[stageName],
            entries: [],
          },
          durationMs: 100,
          provider: { name: 'test', tier: 'primary', attempts: 1 },
        });
      }

      const result = await executePipeline('2026-01-19');

      // Total cost should be sum of all stage costs
      const expectedTotal = Object.values(stageCosts).reduce((a, b) => a + b, 0);
      expect(result.totalCost).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('Quality Context Accumulation', () => {
    it('accumulates quality flags across stages', async () => {
      // Setup stages with warnings
      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue({
          success: true,
          data: {},
          quality: {
            stage: stageName,
            timestamp: new Date().toISOString(),
            measurements: {},
          },
          cost: { stage: stageName, totalCost: 0.01, entries: [] },
          durationMs: 100,
          provider: { name: 'test', tier: 'primary', attempts: 1 },
          warnings: stageName === 'pronunciation' ? ['pronunciation-unknowns>3'] : [],
        });
      }

      const result = await executePipeline('2026-01-19');

      // Quality context should contain the warning
      expect(result.qualityContext.flags).toContain('pronunciation-unknowns>3');
    });

    it('preserves quality context during resume', async () => {
      // State has existing quality context
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-19',
        status: 'running',
        currentStage: 'tts',
        startTime: new Date().toISOString(),
        stages: {
          'news-sourcing': { status: 'completed' },
          'research': { status: 'completed' },
        },
        qualityContext: {
          degradedStages: ['pronunciation'],
          fallbacksUsed: ['news-sourcing:template'],
          flags: ['existing-flag'],
        },
      });

      // Setup remaining stages
      for (const stageName of stageOrder) {
        const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
        mockFn.mockResolvedValue({
          success: true,
          data: {},
          quality: {
            stage: stageName,
            timestamp: new Date().toISOString(),
            measurements: {},
          },
          cost: { stage: stageName, totalCost: 0.01, entries: [] },
          durationMs: 100,
          provider: { name: 'test', tier: 'primary', attempts: 1 },
        });
      }

      const result = await resumePipeline('2026-01-19');

      // Should preserve existing quality context
      expect(result.qualityContext.degradedStages).toContain('pronunciation');
      expect(result.qualityContext.fallbacksUsed).toContain('news-sourcing:template');
      expect(result.qualityContext.flags).toContain('existing-flag');
    });
  });
});
