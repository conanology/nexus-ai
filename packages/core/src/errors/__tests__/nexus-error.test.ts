import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  NexusError,
  isNexusError,
  isRetryable,
  getSeverity,
  shouldFallback,
  canContinue,
} from '../nexus-error.js';
import { ErrorSeverity } from '../../types/errors.js';
import {
  NEXUS_TTS_TIMEOUT,
  NEXUS_LLM_RATE_LIMIT,
  NEXUS_QUALITY_GATE_FAIL,
  NEXUS_STORAGE_READ_FAILED,
  NEXUS_PIPELINE_ABORTED,
  NEXUS_UNKNOWN_ERROR,
} from '../codes.js';

describe('NexusError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-08T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Factory Methods', () => {
    describe('NexusError.retryable()', () => {
      it('creates error with RETRYABLE severity', () => {
        const error = NexusError.retryable(
          NEXUS_TTS_TIMEOUT,
          'TTS synthesis timed out',
          'tts'
        );

        expect(error.severity).toBe(ErrorSeverity.RETRYABLE);
      });

      it('sets retryable to true', () => {
        const error = NexusError.retryable(
          NEXUS_TTS_TIMEOUT,
          'TTS synthesis timed out',
          'tts'
        );

        expect(error.retryable).toBe(true);
      });

      it('includes all provided properties', () => {
        const context = { timeout: 30000 };
        const error = NexusError.retryable(
          NEXUS_TTS_TIMEOUT,
          'TTS synthesis timed out',
          'tts',
          context
        );

        expect(error.code).toBe(NEXUS_TTS_TIMEOUT);
        expect(error.message).toBe('TTS synthesis timed out');
        expect(error.stage).toBe('tts');
        expect(error.context).toEqual(context);
      });

      it('generates timestamp in ISO 8601 format', () => {
        const error = NexusError.retryable(
          NEXUS_TTS_TIMEOUT,
          'Timeout',
          'tts'
        );

        expect(error.timestamp).toBe('2026-01-08T12:00:00.000Z');
      });
    });

    describe('NexusError.fallback()', () => {
      it('creates error with FALLBACK severity', () => {
        const error = NexusError.fallback(
          NEXUS_LLM_RATE_LIMIT,
          'Rate limit exceeded',
          'script-gen'
        );

        expect(error.severity).toBe(ErrorSeverity.FALLBACK);
      });

      it('sets retryable to false', () => {
        const error = NexusError.fallback(
          NEXUS_LLM_RATE_LIMIT,
          'Rate limit exceeded',
          'script-gen'
        );

        expect(error.retryable).toBe(false);
      });
    });

    describe('NexusError.degraded()', () => {
      it('creates error with DEGRADED severity', () => {
        const error = NexusError.degraded(
          NEXUS_QUALITY_GATE_FAIL,
          'Word count below threshold',
          'script-gen',
          { wordCount: 1100, threshold: 1200 }
        );

        expect(error.severity).toBe(ErrorSeverity.DEGRADED);
      });

      it('sets retryable to false', () => {
        const error = NexusError.degraded(
          NEXUS_QUALITY_GATE_FAIL,
          'Quality check failed',
          'script-gen'
        );

        expect(error.retryable).toBe(false);
      });
    });

    describe('NexusError.recoverable()', () => {
      it('creates error with RECOVERABLE severity', () => {
        const error = NexusError.recoverable(
          NEXUS_STORAGE_READ_FAILED,
          'Failed to read cache',
          'research'
        );

        expect(error.severity).toBe(ErrorSeverity.RECOVERABLE);
      });

      it('sets retryable to false', () => {
        const error = NexusError.recoverable(
          NEXUS_STORAGE_READ_FAILED,
          'Failed to read cache',
          'research'
        );

        expect(error.retryable).toBe(false);
      });
    });

    describe('NexusError.critical()', () => {
      it('creates error with CRITICAL severity', () => {
        const error = NexusError.critical(
          NEXUS_PIPELINE_ABORTED,
          'Pipeline aborted by user',
          'orchestrator'
        );

        expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      });

      it('sets retryable to false', () => {
        const error = NexusError.critical(
          NEXUS_PIPELINE_ABORTED,
          'Pipeline aborted',
          'orchestrator'
        );

        expect(error.retryable).toBe(false);
      });
    });
  });

  describe('NexusError.fromError()', () => {
    it('returns same NexusError if already a NexusError', () => {
      const original = NexusError.retryable(
        NEXUS_TTS_TIMEOUT,
        'Timeout',
        'tts'
      );
      const wrapped = NexusError.fromError(original, 'tts');

      expect(wrapped).toBe(original);
    });

    it('adds stage to NexusError if missing', () => {
      const original = NexusError.retryable(
        NEXUS_TTS_TIMEOUT,
        'Timeout'
        // No stage
      );
      const wrapped = NexusError.fromError(original, 'tts');

      expect(wrapped.stage).toBe('tts');
      expect(wrapped.code).toBe(original.code);
      expect(wrapped.message).toBe(original.message);
      expect(wrapped.severity).toBe(original.severity);
    });

    it('preserves original timestamp when adding stage', () => {
      const original = NexusError.retryable(
        NEXUS_TTS_TIMEOUT,
        'Timeout'
        // No stage
      );
      const originalTimestamp = original.timestamp;

      // Advance time
      vi.advanceTimersByTime(5000);

      const wrapped = NexusError.fromError(original, 'tts');

      // Should preserve original timestamp, not create new one
      expect(wrapped.timestamp).toBe(originalTimestamp);
    });

    it('preserves stage if NexusError already has one', () => {
      const original = NexusError.retryable(
        NEXUS_TTS_TIMEOUT,
        'Timeout',
        'original-stage'
      );
      const wrapped = NexusError.fromError(original, 'new-stage');

      expect(wrapped.stage).toBe('original-stage');
      expect(wrapped).toBe(original);
    });

    it('wraps standard Error with CRITICAL severity', () => {
      const original = new Error('Something went wrong');
      const wrapped = NexusError.fromError(original, 'tts');

      expect(wrapped.code).toBe(NEXUS_UNKNOWN_ERROR);
      expect(wrapped.message).toBe('Something went wrong');
      expect(wrapped.severity).toBe(ErrorSeverity.CRITICAL);
      expect(wrapped.stage).toBe('tts');
      expect(wrapped.retryable).toBe(false);
    });

    it('preserves original Error name and stack in context', () => {
      const original = new TypeError('Invalid type');
      const wrapped = NexusError.fromError(original, 'validation');

      expect(wrapped.context?.originalName).toBe('TypeError');
      expect(wrapped.context?.originalStack).toBeDefined();
    });

    it('sets cause property for error chaining (ES2022)', () => {
      const original = new TypeError('Invalid type');
      const wrapped = NexusError.fromError(original, 'validation');

      expect(wrapped.cause).toBe(original);
    });

    it('wraps string error', () => {
      const wrapped = NexusError.fromError('String error message', 'tts');

      expect(wrapped.code).toBe(NEXUS_UNKNOWN_ERROR);
      expect(wrapped.message).toBe('String error message');
      expect(wrapped.severity).toBe(ErrorSeverity.CRITICAL);
      expect(wrapped.stage).toBe('tts');
    });

    it('wraps unknown object', () => {
      const wrapped = NexusError.fromError({ foo: 'bar' }, 'tts');

      expect(wrapped.code).toBe(NEXUS_UNKNOWN_ERROR);
      expect(wrapped.message).toBe('[object Object]');
      expect(wrapped.severity).toBe(ErrorSeverity.CRITICAL);
      expect(wrapped.context?.originalValue).toEqual({ foo: 'bar' });
    });

    it('wraps null', () => {
      const wrapped = NexusError.fromError(null, 'tts');

      expect(wrapped.code).toBe(NEXUS_UNKNOWN_ERROR);
      expect(wrapped.message).toBe('null');
      expect(wrapped.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('wraps undefined', () => {
      const wrapped = NexusError.fromError(undefined, 'tts');

      expect(wrapped.code).toBe(NEXUS_UNKNOWN_ERROR);
      expect(wrapped.message).toBe('undefined');
      expect(wrapped.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('wraps number', () => {
      const wrapped = NexusError.fromError(42, 'tts');

      expect(wrapped.code).toBe(NEXUS_UNKNOWN_ERROR);
      expect(wrapped.message).toBe('42');
      expect(wrapped.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('Error Properties', () => {
    it('is an instance of Error', () => {
      const error = NexusError.critical('TEST', 'Test error');

      expect(error).toBeInstanceOf(Error);
    });

    it('is an instance of NexusError', () => {
      const error = NexusError.critical('TEST', 'Test error');

      expect(error).toBeInstanceOf(NexusError);
    });

    it('has name property set to NexusError', () => {
      const error = NexusError.critical('TEST', 'Test error');

      expect(error.name).toBe('NexusError');
    });

    it('has a stack trace', () => {
      const error = NexusError.critical('TEST', 'Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NexusError');
    });

    it('allows optional stage', () => {
      const error = NexusError.critical('TEST', 'Test error');

      expect(error.stage).toBeUndefined();
    });

    it('allows optional context', () => {
      const error = NexusError.critical('TEST', 'Test error', 'stage');

      expect(error.context).toBeUndefined();
    });
  });

  describe('toJSON()', () => {
    it('serializes all properties to JSON', () => {
      const context = { timeout: 30000 };
      const error = NexusError.retryable(
        NEXUS_TTS_TIMEOUT,
        'TTS synthesis timed out',
        'tts',
        context
      );

      const json = error.toJSON();

      expect(json.name).toBe('NexusError');
      expect(json.code).toBe(NEXUS_TTS_TIMEOUT);
      expect(json.message).toBe('TTS synthesis timed out');
      expect(json.severity).toBe(ErrorSeverity.RETRYABLE);
      expect(json.stage).toBe('tts');
      expect(json.retryable).toBe(true);
      expect(json.context).toEqual(context);
      expect(json.timestamp).toBe('2026-01-08T12:00:00.000Z');
      expect(json.stack).toBeDefined();
    });

    it('can be stringified with JSON.stringify', () => {
      const error = NexusError.critical(
        NEXUS_PIPELINE_ABORTED,
        'Pipeline aborted'
      );

      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);

      expect(parsed.code).toBe(NEXUS_PIPELINE_ABORTED);
      expect(parsed.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });
});

describe('Type Guards', () => {
  describe('isNexusError()', () => {
    it('returns true for NexusError', () => {
      const error = NexusError.critical('TEST', 'Test error');

      expect(isNexusError(error)).toBe(true);
    });

    it('returns false for standard Error', () => {
      const error = new Error('Standard error');

      expect(isNexusError(error)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isNexusError('error string')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isNexusError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isNexusError(undefined)).toBe(false);
    });

    it('returns false for object that looks like NexusError', () => {
      const fakeError = {
        code: 'TEST',
        severity: ErrorSeverity.CRITICAL,
        retryable: false,
      };

      expect(isNexusError(fakeError)).toBe(false);
    });
  });

  describe('isRetryable()', () => {
    it('returns true for RETRYABLE severity', () => {
      const error = NexusError.retryable('TEST', 'Timeout');

      expect(isRetryable(error)).toBe(true);
    });

    it('returns false for FALLBACK severity', () => {
      const error = NexusError.fallback('TEST', 'Provider failed');

      expect(isRetryable(error)).toBe(false);
    });

    it('returns false for DEGRADED severity', () => {
      const error = NexusError.degraded('TEST', 'Quality issue');

      expect(isRetryable(error)).toBe(false);
    });

    it('returns false for RECOVERABLE severity', () => {
      const error = NexusError.recoverable('TEST', 'Stage skipped');

      expect(isRetryable(error)).toBe(false);
    });

    it('returns false for CRITICAL severity', () => {
      const error = NexusError.critical('TEST', 'Fatal error');

      expect(isRetryable(error)).toBe(false);
    });

    it('returns false for standard Error', () => {
      const error = new Error('Standard error');

      expect(isRetryable(error)).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isRetryable(null)).toBe(false);
      expect(isRetryable(undefined)).toBe(false);
      expect(isRetryable('string')).toBe(false);
    });
  });

  describe('getSeverity()', () => {
    it('returns RETRYABLE for retryable error', () => {
      const error = NexusError.retryable('TEST', 'Timeout');

      expect(getSeverity(error)).toBe(ErrorSeverity.RETRYABLE);
    });

    it('returns FALLBACK for fallback error', () => {
      const error = NexusError.fallback('TEST', 'Provider failed');

      expect(getSeverity(error)).toBe(ErrorSeverity.FALLBACK);
    });

    it('returns DEGRADED for degraded error', () => {
      const error = NexusError.degraded('TEST', 'Quality issue');

      expect(getSeverity(error)).toBe(ErrorSeverity.DEGRADED);
    });

    it('returns RECOVERABLE for recoverable error', () => {
      const error = NexusError.recoverable('TEST', 'Stage skipped');

      expect(getSeverity(error)).toBe(ErrorSeverity.RECOVERABLE);
    });

    it('returns CRITICAL for critical error', () => {
      const error = NexusError.critical('TEST', 'Fatal error');

      expect(getSeverity(error)).toBe(ErrorSeverity.CRITICAL);
    });

    it('returns CRITICAL for standard Error', () => {
      const error = new Error('Standard error');

      expect(getSeverity(error)).toBe(ErrorSeverity.CRITICAL);
    });

    it('returns CRITICAL for non-error values', () => {
      expect(getSeverity(null)).toBe(ErrorSeverity.CRITICAL);
      expect(getSeverity(undefined)).toBe(ErrorSeverity.CRITICAL);
      expect(getSeverity('string')).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('shouldFallback()', () => {
    it('returns true for FALLBACK severity', () => {
      const error = NexusError.fallback('TEST', 'Provider failed');

      expect(shouldFallback(error)).toBe(true);
    });

    it('returns false for other severities', () => {
      expect(shouldFallback(NexusError.retryable('TEST', 'Timeout'))).toBe(false);
      expect(shouldFallback(NexusError.degraded('TEST', 'Quality'))).toBe(false);
      expect(shouldFallback(NexusError.recoverable('TEST', 'Skip'))).toBe(false);
      expect(shouldFallback(NexusError.critical('TEST', 'Fatal'))).toBe(false);
    });

    it('returns false for non-NexusError', () => {
      expect(shouldFallback(new Error('Test'))).toBe(false);
      expect(shouldFallback(null)).toBe(false);
    });
  });

  describe('canContinue()', () => {
    it('returns true for RETRYABLE severity', () => {
      const error = NexusError.retryable('TEST', 'Timeout');

      expect(canContinue(error)).toBe(true);
    });

    it('returns true for FALLBACK severity', () => {
      const error = NexusError.fallback('TEST', 'Provider failed');

      expect(canContinue(error)).toBe(true);
    });

    it('returns true for DEGRADED severity', () => {
      const error = NexusError.degraded('TEST', 'Quality issue');

      expect(canContinue(error)).toBe(true);
    });

    it('returns true for RECOVERABLE severity', () => {
      const error = NexusError.recoverable('TEST', 'Stage skipped');

      expect(canContinue(error)).toBe(true);
    });

    it('returns false for CRITICAL severity', () => {
      const error = NexusError.critical('TEST', 'Fatal error');

      expect(canContinue(error)).toBe(false);
    });

    it('returns false for standard Error', () => {
      const error = new Error('Standard error');

      expect(canContinue(error)).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(canContinue(null)).toBe(false);
      expect(canContinue(undefined)).toBe(false);
      expect(canContinue('string')).toBe(false);
    });
  });
});
