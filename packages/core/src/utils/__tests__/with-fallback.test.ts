import { describe, it, expect, vi } from 'vitest';
import { withFallback } from '../with-fallback.js';
import type { NamedProvider } from '../with-fallback.js';
import { NexusError } from '../../errors/index.js';
import { ErrorSeverity } from '../../types/errors.js';

interface TestProvider extends NamedProvider {
  execute: (data: string) => Promise<string>;
}

function createProvider(name: string): TestProvider {
  return {
    name,
    execute: vi.fn().mockResolvedValue(`${name}-result`),
  };
}

describe('withFallback', () => {
  // Note: withFallback doesn't use timers, so no fake timers needed

  describe('primary provider success', () => {
    it('should use primary provider first', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback1'),
        createProvider('fallback2'),
      ];

      const executor = vi.fn().mockResolvedValue('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.provider).toBe('primary');
      expect(result.tier).toBe('primary');
      expect(executor).toHaveBeenCalledTimes(1);
      expect(executor).toHaveBeenCalledWith(providers[0]);
    });

    it('should return primary tier when first provider succeeds', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      const executor = vi.fn().mockResolvedValue('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.tier).toBe('primary');
    });

    it('should include successful attempt in attempts array', async () => {
      const providers: TestProvider[] = [createProvider('primary')];

      const executor = vi.fn().mockResolvedValue('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]).toMatchObject({
        provider: 'primary',
        success: true,
        durationMs: expect.any(Number),
      });
      expect(result.attempts[0].error).toBeUndefined();
    });
  });

  describe('fallback scenarios', () => {
    it('should fallback on any error', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback1'),
        createProvider('fallback2'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.provider).toBe('fallback1');
      expect(result.tier).toBe('fallback');
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should return fallback tier for non-first providers', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback1'),
        createProvider('fallback2'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.provider).toBe('fallback2');
      expect(result.tier).toBe('fallback');
    });

    it('should try all providers before failing', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
        createProvider('p3'),
      ];

      const executor = vi.fn().mockRejectedValue(new Error('Failed'));

      const resultPromise = withFallback(providers, executor);
      

      await expect(resultPromise).rejects.toThrow();
      expect(executor).toHaveBeenCalledTimes(3);
    });

    it('should fallback on NexusError with any severity', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      // Test with CRITICAL error - should still fallback
      const executor = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.critical('NEXUS_PIPELINE_ABORTED', 'Critical error')
        )
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.provider).toBe('fallback');
      expect(result.tier).toBe('fallback');
    });
  });

  describe('attempt tracking', () => {
    it('should track all attempts including failures', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
        createProvider('p3'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('P1 failed'))
        .mockRejectedValueOnce(new Error('P2 failed'))
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[1].success).toBe(false);
      expect(result.attempts[2].success).toBe(true);
    });

    it('should include error in failed attempts', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Timeout')
        )
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.attempts[0].error).toBeInstanceOf(NexusError);
      expect(result.attempts[0].error?.code).toBe('NEXUS_TTS_TIMEOUT');
    });

    it('should track duration for each attempt', async () => {
      const providers: TestProvider[] = [createProvider('primary')];

      const executor = vi.fn().mockImplementation(async () => {
        return 'success';
      });

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.attempts[0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('all providers fail', () => {
    it('should throw CRITICAL error when all providers fail', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
        createProvider('p3'),
      ];

      const executor = vi.fn().mockRejectedValue(new Error('Failed'));

      const resultPromise = withFallback(providers, executor, { stage: 'tts' });
      

      await expect(resultPromise).rejects.toMatchObject({
        code: 'NEXUS_FALLBACK_EXHAUSTED',
        severity: ErrorSeverity.CRITICAL,
        stage: 'tts',
      });
    });

    it('should include all attempts in error context', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      const resultPromise = withFallback(providers, executor);
      

      try {
        await resultPromise;
      } catch (error) {
        const nexusError = error as NexusError;
        expect(nexusError.context?.attempts).toEqual([
          {
            provider: 'p1',
            success: false,
            errorCode: expect.any(String),
            durationMs: expect.any(Number),
          },
          {
            provider: 'p2',
            success: false,
            errorCode: expect.any(String),
            durationMs: expect.any(Number),
          },
        ]);
      }
    });

    it('should include provider count in error message', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
        createProvider('p3'),
      ];

      const executor = vi.fn().mockRejectedValue(new Error('Failed'));

      const resultPromise = withFallback(providers, executor);
      

      await expect(resultPromise).rejects.toMatchObject({
        message: 'All 3 providers failed',
      });
    });
  });

  describe('onFallback callback', () => {
    it('should call onFallback when switching providers', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback1'),
        createProvider('fallback2'),
      ];

      const onFallback = vi.fn();
      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor, { onFallback });
      
      await resultPromise;

      expect(onFallback).toHaveBeenCalledTimes(1);
      expect(onFallback).toHaveBeenCalledWith(
        'primary',
        'fallback1',
        expect.any(NexusError)
      );
    });

    it('should call onFallback for each fallback transition', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
        createProvider('p3'),
      ];

      const onFallback = vi.fn();
      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor, { onFallback });
      
      await resultPromise;

      expect(onFallback).toHaveBeenCalledTimes(2);
      expect(onFallback).toHaveBeenNthCalledWith(
        1,
        'p1',
        'p2',
        expect.any(NexusError)
      );
      expect(onFallback).toHaveBeenNthCalledWith(
        2,
        'p2',
        'p3',
        expect.any(NexusError)
      );
    });

    it('should NOT call onFallback for last provider failure', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
      ];

      const onFallback = vi.fn();
      const executor = vi.fn().mockRejectedValue(new Error('Failed'));

      const resultPromise = withFallback(providers, executor, { onFallback });
      

      try {
        await resultPromise;
      } catch {
        // Expected to throw
      }

      // Only called once (p1 -> p2), not for p2 failure
      expect(onFallback).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onFallback on primary success', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      const onFallback = vi.fn();
      const executor = vi.fn().mockResolvedValue('success');

      const resultPromise = withFallback(providers, executor, { onFallback });
      
      await resultPromise;

      expect(onFallback).not.toHaveBeenCalled();
    });
  });

  describe('no providers', () => {
    it('should throw CRITICAL error with no providers', async () => {
      const providers: TestProvider[] = [];
      const executor = vi.fn();

      await expect(
        withFallback(providers, executor, { stage: 'tts' })
      ).rejects.toMatchObject({
        code: 'NEXUS_FALLBACK_NO_PROVIDERS',
        severity: ErrorSeverity.CRITICAL,
        stage: 'tts',
      });

      expect(executor).not.toHaveBeenCalled();
    });
  });

  describe('stage context', () => {
    it('should include stage in wrapped errors', async () => {
      const providers: TestProvider[] = [createProvider('primary')];

      const executor = vi.fn().mockRejectedValue(new Error('Plain error'));

      await expect(
        withFallback(providers, executor, { stage: 'tts' })
      ).rejects.toMatchObject({
        stage: 'tts',
      });
    });

    it('should include stage in attempt errors', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor, { stage: 'tts' });
      
      const result = await resultPromise;

      expect(result.attempts[0].error?.stage).toBe('tts');
    });
  });

  describe('result structure', () => {
    it('should return correct FallbackResult structure', async () => {
      const providers: TestProvider[] = [createProvider('primary')];

      const executor = vi.fn().mockResolvedValue({ data: 'test' });

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('tier');
      expect(result).toHaveProperty('attempts');
      expect(result.result).toEqual({ data: 'test' });
    });

    it('should pass correct provider to executor', async () => {
      const p1 = createProvider('primary');
      const p2 = createProvider('fallback');
      const providers: TestProvider[] = [p1, p2];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');

      const resultPromise = withFallback(providers, executor);
      
      await resultPromise;

      expect(executor).toHaveBeenNthCalledWith(1, p1);
      expect(executor).toHaveBeenNthCalledWith(2, p2);
    });
  });

  describe('single provider', () => {
    it('should work with single provider success', async () => {
      const providers: TestProvider[] = [createProvider('only')];

      const executor = vi.fn().mockResolvedValue('success');

      const resultPromise = withFallback(providers, executor);
      
      const result = await resultPromise;

      expect(result.provider).toBe('only');
      expect(result.tier).toBe('primary');
    });

    it('should throw when single provider fails', async () => {
      const providers: TestProvider[] = [createProvider('only')];

      const executor = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(withFallback(providers, executor)).rejects.toMatchObject({
        code: 'NEXUS_FALLBACK_EXHAUSTED',
        message: 'All 1 providers failed',
      });
    });
  });
});
