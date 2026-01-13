/**
 * Tests for stage logging helper functions.
 *
 * Tests cover:
 * - logStageStart
 * - logStageComplete
 * - logStageError
 * - logApiCall
 * - logRetryAttempt
 * - logFallbackUsed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from 'pino';
import type { StageInput, StageOutput, StageConfig } from '../../types/pipeline.js';
import type { QualityMetrics } from '../../types/quality.js';
import type { CostBreakdown } from '../../types/providers.js';
import {
  logStageStart,
  logStageComplete,
  logStageError,
  logApiCall,
  logRetryAttempt,
  logFallbackUsed,
} from '../stage-logging.js';

// Mock logger factory
function createMockLogger(): Logger & { calls: Array<{ level: string; args: unknown[] }> } {
  const calls: Array<{ level: string; args: unknown[] }> = [];

  const mockFn = (level: string) => (...args: unknown[]) => {
    calls.push({ level, args });
  };

  return {
    trace: vi.fn(mockFn('trace')),
    debug: vi.fn(mockFn('debug')),
    info: vi.fn(mockFn('info')),
    warn: vi.fn(mockFn('warn')),
    error: vi.fn(mockFn('error')),
    fatal: vi.fn(mockFn('fatal')),
    child: vi.fn(() => createMockLogger()),
    bindings: vi.fn(() => ({})),
    level: 'info',
    calls,
  } as unknown as Logger & { calls: Array<{ level: string; args: unknown[] }> };
}

// Test fixtures
function createTestStageInput<T>(data: T, overrides?: Partial<StageInput<T>>): StageInput<T> {
  const config: StageConfig = {
    timeout: 30000,
    retries: 3,
  };

  return {
    pipelineId: '2026-01-08',
    previousStage: null,
    data,
    config,
    ...overrides,
  };
}

function createTestStageOutput<T>(data: T, overrides?: Partial<StageOutput<T>>): StageOutput<T> {
  const quality: QualityMetrics = {
    stage: 'tts',
    timestamp: new Date().toISOString(),
    measurements: {},
  };

  const cost: CostBreakdown = {
    service: 'gemini-tts',
    tokens: { input: 100, output: 0 },
    cost: 0.0025,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true,
    data,
    quality,
    cost,
    durationMs: 1500,
    provider: {
      name: 'gemini-2.5-pro-tts',
      tier: 'primary',
      attempts: 1,
    },
    ...overrides,
  };
}

describe('observability/stage-logging', () => {
  let mockLogger: Logger & { calls: Array<{ level: string; args: unknown[] }> };

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe('logStageStart', () => {
    it('should log stage start with pipeline context', () => {
      const input = createTestStageInput({ text: 'hello world' });

      logStageStart(mockLogger, 'tts', input);

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      const [context, message] = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.pipelineId).toBe('2026-01-08');
      expect(context.stage).toBe('tts');
      expect(context.event).toBe('stage_start');
      expect(context.previousStage).toBeNull();
      expect(message).toBe('Stage tts started');
    });

    it('should include previous stage when provided', () => {
      const input = createTestStageInput({ text: 'hello world' }, { previousStage: 'script-gen' });

      logStageStart(mockLogger, 'tts', input);

      const [context] = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.previousStage).toBe('script-gen');
    });

    it('should include prior degradation when quality context has degraded stages', () => {
      const input = createTestStageInput({ text: 'hello world' }, {
        qualityContext: {
          degradedStages: ['script-gen'],
          fallbacksUsed: [],
          flags: [],
        },
      });

      logStageStart(mockLogger, 'tts', input);

      const [context] = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.priorDegradation).toEqual(['script-gen']);
    });
  });

  describe('logStageComplete', () => {
    it('should log stage completion with metrics', () => {
      const output = createTestStageOutput({ audioUrl: 'gs://...' });

      logStageComplete(mockLogger, 'tts', output);

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      const [context, message] = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.stage).toBe('tts');
      expect(context.event).toBe('stage_complete');
      expect(context.success).toBe(true);
      expect(context.durationMs).toBe(1500);
      expect(context.provider).toBe('gemini-2.5-pro-tts');
      expect(context.tier).toBe('primary');
      expect(context.attempts).toBe(1);
      expect(context.cost).toBe(0.0025);
      expect(message).toBe('Stage tts completed');
    });

    it('should include warnings when present', () => {
      const output = createTestStageOutput({ audioUrl: 'gs://...' }, {
        warnings: ['Word count low', 'Silence detected'],
      });

      logStageComplete(mockLogger, 'tts', output);

      const [context] = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.warnings).toEqual(['Word count low', 'Silence detected']);
    });

    it('should include artifact count when artifacts present', () => {
      const output = createTestStageOutput({ audioUrl: 'gs://...' }, {
        artifacts: [
          { type: 'audio', url: 'gs://bucket/audio.wav', size: 1000, contentType: 'audio/wav', generatedAt: new Date().toISOString(), stage: 'tts' },
        ],
      });

      logStageComplete(mockLogger, 'tts', output);

      const [context] = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.artifactCount).toBe(1);
    });

    it('should log fallback tier when fallback was used', () => {
      const output = createTestStageOutput({ audioUrl: 'gs://...' }, {
        provider: {
          name: 'chirp3-hd',
          tier: 'fallback',
          attempts: 2,
        },
      });

      logStageComplete(mockLogger, 'tts', output);

      const [context] = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.tier).toBe('fallback');
      expect(context.attempts).toBe(2);
    });
  });

  describe('logStageError', () => {
    it('should log error with full context', () => {
      const error = new Error('TTS synthesis failed');
      error.stack = 'Error: TTS synthesis failed\n    at synthesis.ts:42';

      logStageError(mockLogger, 'tts', error);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [context, message] = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.stage).toBe('tts');
      expect(context.event).toBe('stage_error');
      expect(context.error.name).toBe('Error');
      expect(context.error.message).toBe('TTS synthesis failed');
      expect(context.error.stack).toContain('synthesis.ts:42');
      expect(message).toBe('Stage tts failed: TTS synthesis failed');
    });

    it('should include additional context when provided', () => {
      const error = new Error('API timeout');

      logStageError(mockLogger, 'tts', error, { provider: 'gemini-tts', attempt: 3 });

      const [context] = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.provider).toBe('gemini-tts');
      expect(context.attempt).toBe(3);
    });
  });

  describe('logApiCall', () => {
    it('should log API call at debug level', () => {
      logApiCall(mockLogger, 'gemini-tts', 'synthesize', 1234);

      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      const [context, message] = (mockLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.event).toBe('api_call');
      expect(context.service).toBe('gemini-tts');
      expect(context.operation).toBe('synthesize');
      expect(context.durationMs).toBe(1234);
      expect(message).toBe('API call to gemini-tts.synthesize');
    });

    it('should include tokens and cost when provided', () => {
      logApiCall(mockLogger, 'gemini-3-pro', 'generate', 500, { tokens: 1500, cost: 0.0015 });

      const [context] = (mockLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.tokens).toBe(1500);
      expect(context.cost).toBe(0.0015);
    });
  });

  describe('logRetryAttempt', () => {
    it('should log retry attempt at debug level', () => {
      const error = new Error('Connection timeout');

      logRetryAttempt(mockLogger, 'tts', 2, 3, 1000, error);

      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      const [context, message] = (mockLogger.debug as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.event).toBe('api_retry');
      expect(context.stage).toBe('tts');
      expect(context.attempt).toBe(2);
      expect(context.maxAttempts).toBe(3);
      expect(context.delayMs).toBe(1000);
      expect(context.error.name).toBe('Error');
      expect(context.error.message).toBe('Connection timeout');
      expect(message).toBe('Retry attempt 2/3 for tts');
    });
  });

  describe('logFallbackUsed', () => {
    it('should log fallback usage at warn level', () => {
      logFallbackUsed(mockLogger, 'tts', 'gemini-tts', 'chirp3-hd', 'Primary provider rate limited');

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      const [context, message] = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(context.event).toBe('fallback_used');
      expect(context.stage).toBe('tts');
      expect(context.primaryProvider).toBe('gemini-tts');
      expect(context.fallbackProvider).toBe('chirp3-hd');
      expect(context.reason).toBe('Primary provider rate limited');
      expect(message).toBe('Using fallback provider chirp3-hd for tts');
    });
  });
});
