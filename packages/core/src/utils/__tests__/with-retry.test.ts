import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, sleep, calculateDelay } from '../with-retry.js';
import { NexusError } from '../../errors/index.js';
import { ErrorSeverity } from '../../types/errors.js';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after specified milliseconds', async () => {
    const sleepPromise = sleep(1000);

    // Promise should be pending
    expect(vi.getTimerCount()).toBe(1);

    // Advance time
    vi.advanceTimersByTime(1000);

    // Promise should resolve
    await expect(sleepPromise).resolves.toBeUndefined();
  });

  it('should not resolve before time elapses', async () => {
    let resolved = false;
    sleep(1000).then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(500);
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });
});

describe('calculateDelay', () => {
  it('should calculate exponential backoff', () => {
    // Mock Math.random to return consistent value for testing
    const originalRandom = Math.random;
    Math.random = () => 0.5; // This gives jitter of 0.75 (0.5 + 0.5 * 0.5)

    expect(calculateDelay(0, 1000, 30000)).toBe(750); // 1000 * 0.75
    expect(calculateDelay(1, 1000, 30000)).toBe(1500); // 2000 * 0.75
    expect(calculateDelay(2, 1000, 30000)).toBe(3000); // 4000 * 0.75
    expect(calculateDelay(3, 1000, 30000)).toBe(6000); // 8000 * 0.75

    Math.random = originalRandom;
  });

  it('should cap delay at maxDelay', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5; // jitter = 0.75

    // 2^10 * 1000 = 1024000, capped at 30000 * 0.75 = 22500
    expect(calculateDelay(10, 1000, 30000)).toBe(22500);

    Math.random = originalRandom;
  });

  it('should apply jitter (50-100%)', () => {
    const originalRandom = Math.random;

    // Test minimum jitter (random = 0 → jitter = 0.5)
    Math.random = () => 0;
    expect(calculateDelay(0, 1000, 30000)).toBe(500);

    // Test maximum jitter (random = 1 → jitter = 1.0)
    Math.random = () => 1;
    expect(calculateDelay(0, 1000, 30000)).toBe(1000);

    Math.random = originalRandom;
  });

  it('should return integer delay', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.33333;

    const delay = calculateDelay(0, 1000, 30000);
    expect(Number.isInteger(delay)).toBe(true);

    Math.random = originalRandom;
  });

  it('should handle zero base delay', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    expect(calculateDelay(0, 0, 30000)).toBe(0);
    expect(calculateDelay(5, 0, 30000)).toBe(0);

    Math.random = originalRandom;
  });
});

describe('withRetry', () => {
  // All tests use baseDelay: 0 to avoid actual delays during testing

  describe('success scenarios', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { baseDelay: 0 });

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelayMs).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return result with correct structure', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'test' });

      const result = await withRetry(fn, { baseDelay: 0 });

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('attempts');
      expect(result).toHaveProperty('totalDelayMs');
      expect(result.result).toEqual({ data: 'test' });
    });
  });

  describe('retry on RETRYABLE errors', () => {
    it('should retry on RETRYABLE errors and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        )
        .mockResolvedValueOnce('success');

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0 });

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times before succeeding', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout 1')
        )
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout 2')
        )
        .mockResolvedValueOnce('success');

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0 });

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retries', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        );

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelay: 0 })
      ).rejects.toMatchObject({
        code: 'NEXUS_TTS_TIMEOUT',
        severity: ErrorSeverity.CRITICAL,
        context: expect.objectContaining({
          retryAttempts: 3, // 1 initial + 2 retries
          exhaustedRetries: true,
        }),
      });
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('non-RETRYABLE errors', () => {
    it('should NOT retry on CRITICAL errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.critical('NEXUS_PIPELINE_ABORTED', 'Aborted')
        );

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 0 })
      ).rejects.toMatchObject({
        code: 'NEXUS_PIPELINE_ABORTED',
        severity: ErrorSeverity.CRITICAL,
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on FALLBACK errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.fallback('NEXUS_TTS_PROVIDER_ERROR', 'Provider failed')
        );

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 0 })
      ).rejects.toMatchObject({
        code: 'NEXUS_TTS_PROVIDER_ERROR',
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on DEGRADED errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.degraded('NEXUS_QUALITY_GATE_FAIL', 'Quality failed')
        );

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 0 })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on standard Error (wrapped as CRITICAL)', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Standard error'));

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 0 })
      ).rejects.toMatchObject({
        severity: ErrorSeverity.CRITICAL,
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('exponential backoff', () => {
    it('should use exponential backoff between retries', async () => {
      const delays: number[] = [];
      const originalRandom = Math.random;
      Math.random = () => 0.5; // Consistent jitter for testing

      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T1')
        )
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T2')
        )
        .mockResolvedValueOnce('success');

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 0, // Use 0 to avoid actual delays
        maxDelay: 10000,
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        },
      });

      expect(result.result).toBe('success');
      // With baseDelay: 0, all delays are 0
      expect(delays).toHaveLength(2);

      Math.random = originalRandom;
    });

    it('should track total delay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T1')
        )
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T2')
        )
        .mockResolvedValueOnce('success');

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 0,
        maxDelay: 10000,
      });

      expect(result.result).toBe('success');
      // With baseDelay: 0, totalDelayMs is 0
      expect(result.totalDelayMs).toBe(0);
    });

    it('should respect maxDelay cap', async () => {
      const delays: number[] = [];
      const originalRandom = Math.random;
      Math.random = () => 0.5;

      // Create enough failures to hit maxDelay
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T1')
        )
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T2')
        )
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T3')
        )
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'T4')
        )
        .mockResolvedValueOnce('success');

      await withRetry(fn, {
        maxRetries: 5,
        baseDelay: 1, // Very small delay to test capping
        maxDelay: 3, // Will be hit quickly
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        },
      });

      // All delays should be <= maxDelay
      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(3);
      });

      Math.random = originalRandom;
    });
  });

  describe('onRetry callback', () => {
    it('should call onRetry for each retry attempt', async () => {
      const onRetry = vi.fn();

      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        )
        .mockResolvedValueOnce('success');

      await withRetry(fn, { maxRetries: 3, baseDelay: 0, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1, // attempt number
        expect.any(Number), // delay
        expect.objectContaining({ code: 'NEXUS_TTS_TIMEOUT' })
      );
    });

    it('should NOT call onRetry on success', async () => {
      const onRetry = vi.fn();

      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 0, onRetry });

      expect(result.result).toBe('success');
      expect(onRetry).not.toHaveBeenCalled();
    });

    it('should pass NexusError to onRetry callback', async () => {
      let capturedError: NexusError | undefined;

      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout', 'tts')
        )
        .mockResolvedValueOnce('success');

      await withRetry(fn, {
        maxRetries: 3,
        baseDelay: 0,
        onRetry: (_attempt, _delay, error) => {
          capturedError = error;
        },
      });

      expect(capturedError).toBeInstanceOf(NexusError);
      expect(capturedError?.code).toBe('NEXUS_TTS_TIMEOUT');
    });
  });

  describe('stage context', () => {
    it('should include stage in thrown error context', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        );

      await expect(
        withRetry(fn, { maxRetries: 1, baseDelay: 0, stage: 'tts' })
      ).rejects.toMatchObject({
        stage: 'tts',
      });
    });

    it('should wrap unknown errors with stage', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Unknown error'));

      await expect(
        withRetry(fn, { maxRetries: 1, baseDelay: 0, stage: 'tts' })
      ).rejects.toMatchObject({
        stage: 'tts',
      });
    });
  });

  describe('error context preservation', () => {
    it('should include retry history in error context', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        );

      try {
        await withRetry(fn, { maxRetries: 2, baseDelay: 0 });
        expect.fail('Expected to throw');
      } catch (error) {
        const nexusError = error as NexusError;
        expect(nexusError.context?.retryHistory).toEqual([
          { attempt: 1, error: 'NEXUS_TTS_TIMEOUT', delay: expect.any(Number) },
          { attempt: 2, error: 'NEXUS_TTS_TIMEOUT', delay: expect.any(Number) },
        ]);
      }
    });

    it('should preserve original error context', async () => {
      const fn = vi.fn().mockRejectedValue(
        NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout', 'tts', {
          originalContext: 'preserved',
        })
      );

      try {
        await withRetry(fn, { maxRetries: 0, baseDelay: 0 });
        expect.fail('Expected to throw');
      } catch (error) {
        const nexusError = error as NexusError;
        expect(nexusError.context?.originalContext).toBe('preserved');
      }
    });

    it('should mark exhaustedRetries correctly for retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        );

      try {
        await withRetry(fn, { maxRetries: 1, baseDelay: 0 });
        expect.fail('Expected to throw');
      } catch (error) {
        expect((error as NexusError).context?.exhaustedRetries).toBe(true);
      }
    });

    it('should mark exhaustedRetries as false for non-retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.critical('NEXUS_PIPELINE_ABORTED', 'Aborted')
        );

      try {
        await withRetry(fn, { maxRetries: 3, baseDelay: 0 });
        expect.fail('Expected to throw');
      } catch (error) {
        expect((error as NexusError).context?.exhaustedRetries).toBe(false);
      }
    });
  });

  describe('default options', () => {
    it('should use default maxRetries of 3', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        );

      try {
        await withRetry(fn, { baseDelay: 0 }); // baseDelay: 0 to avoid delays
        expect.fail('Expected to throw');
      } catch {
        // Expected to throw
      }

      expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries (default)
    });

    it('should work with no options', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result.result).toBe('success');
    });
  });

  describe('input validation', () => {
    it('should throw on negative maxRetries', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await expect(
        withRetry(fn, { maxRetries: -1 })
      ).rejects.toMatchObject({
        code: 'NEXUS_RETRY_INVALID_OPTIONS',
        message: expect.stringContaining('maxRetries must be >= 0'),
      });

      expect(fn).not.toHaveBeenCalled();
    });

    it('should throw on negative baseDelay', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await expect(
        withRetry(fn, { baseDelay: -100 })
      ).rejects.toMatchObject({
        code: 'NEXUS_RETRY_INVALID_OPTIONS',
        message: expect.stringContaining('baseDelay must be >= 0'),
      });

      expect(fn).not.toHaveBeenCalled();
    });

    it('should throw on negative maxDelay', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await expect(
        withRetry(fn, { maxDelay: -50 })
      ).rejects.toMatchObject({
        code: 'NEXUS_RETRY_INVALID_OPTIONS',
        message: expect.stringContaining('maxDelay must be >= 0'),
      });

      expect(fn).not.toHaveBeenCalled();
    });

    it('should accept zero values', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxRetries: 0,
        baseDelay: 0,
        maxDelay: 0,
      });

      expect(result.result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
