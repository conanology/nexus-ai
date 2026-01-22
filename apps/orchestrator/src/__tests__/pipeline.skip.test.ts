/**
 * Unit tests for pipeline skip and recovery functionality (Story 5.8)
 *
 * Tests:
 * - Skip detection after fallback exhaustion
 * - State persistence on skip
 * - Queue integration on skip
 * - Queued topic processing priority
 *
 * @module orchestrator/__tests__/pipeline.skip.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock functions that can be referenced in vi.mock
const { mockQueueFailedTopic, mockCheckTodayQueuedTopic, mockClearQueuedTopic, mockIncrementRetryCount } = vi.hoisted(() => ({
  mockQueueFailedTopic: vi.fn(),
  mockCheckTodayQueuedTopic: vi.fn(),
  mockClearQueuedTopic: vi.fn(),
  mockIncrementRetryCount: vi.fn(),
}));

// Mock modules before imports
vi.mock('../stages.js', () => ({
  stageRegistry: {
    'news-sourcing': vi.fn(),
    'research': vi.fn(),
    'script-gen': vi.fn(),
    'pronunciation': vi.fn(),
    'tts': vi.fn(),
    'visual-gen': vi.fn(),
    'render': vi.fn(),
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
    'render',
    'thumbnail',
    'youtube',
    'twitter',
    'notifications',
  ],
}));

vi.mock('../state.js', () => ({
  PipelineStateManager: vi.fn().mockImplementation(() => ({
    initializePipeline: vi.fn(),
    updateStageStatus: vi.fn(),
    getState: vi.fn(),
    markComplete: vi.fn(),
    markFailed: vi.fn(),
    markSkipped: vi.fn(),
    updateQualityContext: vi.fn(),
    updateRetryAttempts: vi.fn(),
    persistStageOutput: vi.fn(),
    loadStageOutput: vi.fn(),
    updateTotalCost: vi.fn(),
  })),
}));

vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    // withRetry mock: calls the function and propagates errors
    // Simulates retry behavior by calling onRetry callback before throwing
    withRetry: vi.fn(async (fn, options?: { onRetry?: (attempt: number, delay: number, error: unknown) => void }) => {
      try {
        const result = await fn();
        return { result, attempts: 1 };
      } catch (error: unknown) {
        // Simulate retry behavior - call onRetry to track attempts
        if (options?.onRetry) {
          options.onRetry(1, 1000, error);
        }
        // Add originalSeverity context like the real withRetry does
        const nexusError = error as { context?: Record<string, unknown>; severity?: string };
        if (!nexusError.context) {
          nexusError.context = {};
        }
        nexusError.context.originalSeverity = nexusError.severity || 'CRITICAL';
        throw error;
      }
    }),
    updateBudgetSpent: vi.fn(),
    checkCostThresholds: vi.fn().mockResolvedValue({ triggered: false }),
    logIncident: vi.fn().mockResolvedValue('inc-test-123'),
    mapSeverity: vi.fn().mockReturnValue('CRITICAL'),
    inferRootCause: vi.fn().mockReturnValue('provider_failure'),
    queueFailedTopic: mockQueueFailedTopic,
    checkTodayQueuedTopic: mockCheckTodayQueuedTopic,
    clearQueuedTopic: mockClearQueuedTopic,
    incrementRetryCount: mockIncrementRetryCount,
    QUEUE_MAX_RETRIES: 2,
  };
});

vi.mock('@nexus-ai/notifications', () => ({
  sendDiscordAlert: vi.fn().mockResolvedValue({ success: true }),
}));

import { NexusError, ErrorSeverity } from '@nexus-ai/core';

import { executePipeline, resumePipeline } from '../pipeline.js';
import { stageRegistry, stageOrder } from '../stages.js';
import { PipelineStateManager } from '../state.js';

// Helper to create mock stage output
function createMockStageOutput(stageName: string, data: unknown = {}) {
  return {
    success: true,
    data,
    quality: {
      stage: stageName,
      metrics: {},
      degraded: false,
      warnings: [],
    },
    cost: {
      stage: stageName,
      totalCost: 0.01,
      breakdown: [],
    },
    durationMs: 1000,
    provider: {
      name: 'test-provider',
      tier: 'primary' as const,
      attempts: 1,
    },
  };
}

// Helper to create mock queued topic
function createMockQueuedTopic(overrides = {}) {
  return {
    topic: 'Test AI Topic',
    failureReason: 'NEXUS_TTS_TIMEOUT',
    failureStage: 'tts',
    originalDate: '2026-01-19',
    queuedDate: '2026-01-19T20:00:00.000Z',
    retryCount: 0,
    maxRetries: 2,
    status: 'pending' as const,
    ...overrides,
  };
}

describe('Pipeline Skip Functionality', () => {
  let mockStateManager: {
    initializePipeline: ReturnType<typeof vi.fn>;
    updateStageStatus: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    markComplete: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    markSkipped: ReturnType<typeof vi.fn>;
    updateQualityContext: ReturnType<typeof vi.fn>;
    updateRetryAttempts: ReturnType<typeof vi.fn>;
    persistStageOutput: ReturnType<typeof vi.fn>;
    loadStageOutput: ReturnType<typeof vi.fn>;
    updateTotalCost: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock state manager
    mockStateManager = {
      initializePipeline: vi.fn(),
      updateStageStatus: vi.fn(),
      getState: vi.fn().mockRejectedValue(new Error('Not found')),
      markComplete: vi.fn(),
      markFailed: vi.fn(),
      markSkipped: vi.fn(),
      updateQualityContext: vi.fn(),
      updateRetryAttempts: vi.fn(),
      persistStageOutput: vi.fn(),
      loadStageOutput: vi.fn(),
      updateTotalCost: vi.fn(),
    };

    (PipelineStateManager as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockStateManager
    );

    // Setup all stage mocks to succeed by default
    for (const stageName of stageOrder) {
      const mockFn = stageRegistry[stageName] as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValue(createMockStageOutput(stageName));
    }

    // Default: no queued topics
    mockCheckTodayQueuedTopic.mockResolvedValue(null);
    mockQueueFailedTopic.mockResolvedValue('2026-01-21');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Skip Detection Tests
  // ===========================================================================

  describe('shouldSkipDay detection', () => {
    it('should skip when CRITICAL stage fails after retry exhaustion', async () => {
      // Make TTS fail with NEXUS_RETRY_EXHAUSTED
      const ttsError = NexusError.critical(
        'NEXUS_RETRY_EXHAUSTED',
        'TTS failed after 5 retries',
        'tts',
        { originalSeverity: ErrorSeverity.RETRYABLE }
      );

      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(ttsError);

      const result = await executePipeline('2026-01-20');

      expect(result.status).toBe('skipped');
      expect(result.skipInfo).toBeDefined();
      expect(result.skipInfo?.stage).toBe('tts');
    });

    it('should skip when fallbacks are exhausted', async () => {
      const fallbackError = NexusError.critical(
        'NEXUS_FALLBACK_EXHAUSTED',
        'All fallback providers exhausted for script-gen',
        'script-gen'
      );

      (stageRegistry['script-gen'] as ReturnType<typeof vi.fn>).mockRejectedValue(
        fallbackError
      );

      const result = await executePipeline('2026-01-20');

      expect(result.status).toBe('skipped');
      expect(result.skipInfo?.reason).toContain('fallback');
    });

    it('should NOT skip for DEGRADED stage failures', async () => {
      // Pronunciation is DEGRADED criticality - should continue
      const pronError = NexusError.degraded(
        'NEXUS_PRONUNCIATION_FAILED',
        'Pronunciation lookup failed',
        'pronunciation'
      );

      (stageRegistry['pronunciation'] as ReturnType<typeof vi.fn>).mockRejectedValue(
        pronError
      );

      const result = await executePipeline('2026-01-20');

      // Should complete (not skip) because pronunciation is DEGRADED
      expect(result.status).not.toBe('skipped');
    });

    it('should NOT skip for RECOVERABLE stage failures', async () => {
      // Twitter is RECOVERABLE criticality - should continue
      const twitterError = NexusError.recoverable(
        'NEXUS_TWITTER_POST_FAILED',
        'Twitter post failed',
        'twitter'
      );

      (stageRegistry['twitter'] as ReturnType<typeof vi.fn>).mockRejectedValue(
        twitterError
      );

      const result = await executePipeline('2026-01-20');

      expect(result.status).not.toBe('skipped');
      expect(result.skippedStages).toContain('twitter');
    });
  });

  // ===========================================================================
  // State Persistence on Skip Tests
  // ===========================================================================

  describe('state persistence on skip', () => {
    it('should call markSkipped with reason and stage', async () => {
      const ttsError = NexusError.critical(
        'NEXUS_TTS_TIMEOUT',
        'TTS timed out',
        'tts'
      );

      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(ttsError);

      await executePipeline('2026-01-20');

      expect(mockStateManager.markSkipped).toHaveBeenCalledWith(
        '2026-01-20',
        expect.stringContaining('tts'),
        'tts'
      );
    });

    it('should include skip info in result', async () => {
      const renderError = NexusError.critical(
        'NEXUS_RENDER_TIMEOUT',
        'Render timed out after retries',
        'render'
      );

      (stageRegistry['render'] as ReturnType<typeof vi.fn>).mockRejectedValue(
        renderError
      );

      const result = await executePipeline('2026-01-20');

      expect(result.skipInfo).toMatchObject({
        stage: 'render',
        reason: expect.any(String),
      });
    });
  });

  // ===========================================================================
  // Queue Integration on Skip Tests
  // ===========================================================================

  describe('queue integration on skip', () => {
    it('should queue failed topic when skip occurs while processing queued topic', async () => {
      // Setup: there's a queued topic being processed
      const queuedTopic = createMockQueuedTopic();
      mockCheckTodayQueuedTopic.mockResolvedValue(queuedTopic);
      mockIncrementRetryCount.mockResolvedValue({
        ...queuedTopic,
        retryCount: 1,
        status: 'processing',
      });
      mockQueueFailedTopic.mockResolvedValue('2026-01-21');

      // TTS fails
      const ttsError = NexusError.critical(
        'NEXUS_TTS_TIMEOUT',
        'TTS timed out',
        'tts'
      );
      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(ttsError);

      await executePipeline('2026-01-20');

      // Topic should be re-queued via the core module
      expect(mockQueueFailedTopic).toHaveBeenCalled();
    });

    it('should include queue info in skip result when processing queued topic', async () => {
      // Setup: there's a queued topic being processed
      const queuedTopic = createMockQueuedTopic();
      mockCheckTodayQueuedTopic.mockResolvedValue(queuedTopic);
      mockIncrementRetryCount.mockResolvedValue({
        ...queuedTopic,
        retryCount: 1,
        status: 'processing',
      });
      mockQueueFailedTopic.mockResolvedValue('2026-01-21');

      const ttsError = NexusError.critical(
        'NEXUS_TTS_TIMEOUT',
        'TTS timed out',
        'tts'
      );
      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(ttsError);

      const result = await executePipeline('2026-01-20');

      expect(result.skipInfo?.topicQueued).toBe(true);
      expect(result.skipInfo?.queuedForDate).toBe('2026-01-21');
    });

    it('should NOT queue topic when fresh sourcing fails (topic not yet tracked)', async () => {
      // No queued topic - fresh sourcing scenario
      mockCheckTodayQueuedTopic.mockResolvedValue(null);

      // TTS fails
      const ttsError = NexusError.critical(
        'NEXUS_TTS_TIMEOUT',
        'TTS timed out',
        'tts'
      );
      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(ttsError);

      const result = await executePipeline('2026-01-20');

      // Fresh topics are not tracked in current implementation
      // NOTE: This could be enhanced to track the selected topic from news-sourcing
      expect(result.skipInfo?.topicQueued).toBe(false);
    });
  });

  // ===========================================================================
  // Queued Topic Processing Priority Tests
  // ===========================================================================

  describe('queued topic processing priority', () => {
    it('should check for queued topics before news sourcing', async () => {
      mockCheckTodayQueuedTopic.mockResolvedValue(createMockQueuedTopic());
      mockIncrementRetryCount.mockResolvedValue(
        createMockQueuedTopic({ retryCount: 1, status: 'processing' })
      );

      await executePipeline('2026-01-20');

      expect(mockCheckTodayQueuedTopic).toHaveBeenCalled();
    });

    it('should use queued topic when retryCount < maxRetries', async () => {
      const queuedTopic = createMockQueuedTopic({ retryCount: 0 });
      mockCheckTodayQueuedTopic.mockResolvedValue(queuedTopic);
      mockIncrementRetryCount.mockResolvedValue({
        ...queuedTopic,
        retryCount: 1,
        status: 'processing',
      });

      const result = await executePipeline('2026-01-20');

      expect(mockIncrementRetryCount).toHaveBeenCalledWith('2026-01-20');
      // Should complete successfully using queued topic
      expect(result.success).toBe(true);
    });

    it('should clear and proceed with fresh sourcing when retryCount >= maxRetries', async () => {
      const queuedTopic = createMockQueuedTopic({ retryCount: 2 });
      mockCheckTodayQueuedTopic.mockResolvedValue(queuedTopic);

      await executePipeline('2026-01-20');

      expect(mockClearQueuedTopic).toHaveBeenCalledWith('2026-01-20');
    });

    it('should abandon topic when incrementRetryCount returns null', async () => {
      const queuedTopic = createMockQueuedTopic({ retryCount: 1 });
      mockCheckTodayQueuedTopic.mockResolvedValue(queuedTopic);
      mockIncrementRetryCount.mockResolvedValue(null); // Max retries reached

      const result = await executePipeline('2026-01-20');

      // Should proceed with fresh sourcing
      expect(result.success).toBe(true);
    });

    it('should clear queued topic on successful completion', async () => {
      const queuedTopic = createMockQueuedTopic({ retryCount: 0 });
      mockCheckTodayQueuedTopic.mockResolvedValue(queuedTopic);
      mockIncrementRetryCount.mockResolvedValue({
        ...queuedTopic,
        retryCount: 1,
        status: 'processing',
      });

      await executePipeline('2026-01-20');

      expect(mockClearQueuedTopic).toHaveBeenCalledWith('2026-01-20');
    });
  });

  // ===========================================================================
  // Notifications Always Runs Tests
  // ===========================================================================

  describe('notifications stage always runs', () => {
    it('should execute notifications even when pipeline is skipped', async () => {
      const ttsError = NexusError.critical(
        'NEXUS_TTS_TIMEOUT',
        'TTS timed out',
        'tts'
      );
      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(ttsError);

      await executePipeline('2026-01-20');

      expect(stageRegistry['notifications']).toHaveBeenCalled();
    });

    it('should pass skip info to notifications stage', async () => {
      const ttsError = NexusError.critical(
        'NEXUS_TTS_TIMEOUT',
        'TTS timed out',
        'tts'
      );
      (stageRegistry['tts'] as ReturnType<typeof vi.fn>).mockRejectedValue(ttsError);

      await executePipeline('2026-01-20');

      const notificationsCall = (
        stageRegistry['notifications'] as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      const input = notificationsCall[0];

      expect(input.data.pipelineSkipped).toBe(true);
      expect(input.data.skipInfo).toBeDefined();
    });
  });

  // ===========================================================================
  // Resume Pipeline Tests
  // ===========================================================================

  describe('resumePipeline', () => {
    it('should allow resume from failed state', async () => {
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-20',
        status: 'failed',
        startTime: '2026-01-20T10:00:00.000Z',
        stages: {
          'news-sourcing': { status: 'completed' },
          'research': { status: 'completed' },
          'script-gen': { status: 'failed' },
        },
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });
      mockStateManager.loadStageOutput.mockResolvedValue({});

      const result = await resumePipeline('2026-01-20');

      expect(result.pipelineId).toBe('2026-01-20');
    });

    it('should allow resume from skipped state', async () => {
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-20',
        status: 'skipped',
        startTime: '2026-01-20T10:00:00.000Z',
        skipReason: 'TTS failed',
        skipStage: 'tts',
        stages: {
          'news-sourcing': { status: 'completed' },
          'research': { status: 'completed' },
          'script-gen': { status: 'completed' },
          'pronunciation': { status: 'completed' },
          'tts': { status: 'failed' },
        },
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });
      mockStateManager.loadStageOutput.mockResolvedValue({});

      const result = await resumePipeline('2026-01-20');

      expect(result.pipelineId).toBe('2026-01-20');
    });

    it('should reject resume from running state', async () => {
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-20',
        status: 'running',
        startTime: new Date().toISOString(),
        stages: {},
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });

      await expect(resumePipeline('2026-01-20')).rejects.toMatchObject({
        code: 'NEXUS_PIPELINE_ALREADY_RUNNING',
      });
    });

    it('should reject resume from completed state', async () => {
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-20',
        status: 'completed',
        startTime: '2026-01-20T10:00:00.000Z',
        endTime: '2026-01-20T11:00:00.000Z',
        stages: {},
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });

      await expect(resumePipeline('2026-01-20')).rejects.toMatchObject({
        code: 'NEXUS_PIPELINE_COMPLETED',
      });
    });

    it('should resume from specified stage with --from parameter', async () => {
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-20',
        status: 'failed',
        startTime: '2026-01-20T10:00:00.000Z',
        stages: {
          'news-sourcing': { status: 'completed' },
          'research': { status: 'completed' },
          'script-gen': { status: 'completed' },
          'pronunciation': { status: 'completed' },
          'tts': { status: 'failed' },
        },
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });
      mockStateManager.loadStageOutput.mockResolvedValue({});

      const result = await resumePipeline('2026-01-20', 'tts');

      expect(result.pipelineId).toBe('2026-01-20');
    });

    it('should reject invalid stage name for resume', async () => {
      mockStateManager.getState.mockResolvedValue({
        pipelineId: '2026-01-20',
        status: 'failed',
        startTime: '2026-01-20T10:00:00.000Z',
        stages: {},
        qualityContext: {
          degradedStages: [],
          fallbacksUsed: [],
          flags: [],
        },
      });

      await expect(resumePipeline('2026-01-20', 'invalid-stage')).rejects.toMatchObject({
        code: 'NEXUS_INVALID_STAGE',
      });
    });
  });
});
