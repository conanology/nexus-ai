import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../with-retry.js';
import { withFallback } from '../with-fallback.js';
import type { NamedProvider } from '../with-fallback.js';
import { NexusError } from '../../errors/index.js';

interface TestProvider extends NamedProvider {
  execute: () => Promise<string>;
}

function createProvider(name: string): TestProvider {
  return {
    name,
    execute: vi.fn(),
  };
}

describe('withRetry + withFallback composition', () => {
  describe('withRetry wrapping withFallback', () => {
    it('should succeed when primary fails but fallback succeeds', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(
          NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Primary timeout')
        )
        .mockResolvedValueOnce('success');

      // Primary fails, fallback succeeds - no retry needed
      const result = await withRetry(
        () => withFallback(providers, executor),
        { maxRetries: 3, baseDelay: 0 }
      );

      expect(result.result.provider).toBe('fallback');
      expect(result.result.tier).toBe('fallback');
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should throw CRITICAL when all fallback providers fail', async () => {
      const providers: TestProvider[] = [
        createProvider('p1'),
        createProvider('p2'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValue(new Error('Always fails'));

      // When ALL providers fail, withFallback throws NEXUS_FALLBACK_EXHAUSTED
      // which is CRITICAL and not retryable, so withRetry doesn't retry
      await expect(
        withRetry(
          () => withFallback(providers, executor, { stage: 'tts' }),
          { maxRetries: 2, stage: 'tts' }
        )
      ).rejects.toMatchObject({
        code: 'NEXUS_FALLBACK_EXHAUSTED',
      });

      // Only called 2 times (once per provider), not retried because CRITICAL
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should succeed with fallback provider', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      const executor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Primary down'))
        .mockResolvedValueOnce('fallback-success');

      const result = await withRetry(
        () => withFallback(providers, executor, { stage: 'tts' }),
        { maxRetries: 3, stage: 'tts' }
      );

      expect(result.result.provider).toBe('fallback');
      expect(result.result.tier).toBe('fallback');
      expect(result.result.attempts).toHaveLength(2);
      expect(result.attempts).toBe(1); // No retries needed
    });
  });

  describe('withFallback wrapping withRetry (alternative pattern)', () => {
    it('should retry each provider individually before falling back', async () => {
      const providers: TestProvider[] = [
        createProvider('primary'),
        createProvider('fallback'),
      ];

      let primaryCalls = 0;
      let fallbackCalls = 0;

      const executor = vi.fn().mockImplementation(
        async (p: TestProvider): Promise<string> => {
          if (p.name === 'primary') {
            primaryCalls++;
            // Primary always fails with retryable error
            throw NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Primary timeout');
          }
          fallbackCalls++;
          // Fallback succeeds immediately
          return 'fallback-success';
        }
      );

      const result = await withFallback(
        providers,
        async (p) => {
          const retryResult = await withRetry(() => executor(p), {
            maxRetries: 2,
            baseDelay: 0, // Avoid timing issues
            stage: 'tts',
          });
          return retryResult.result;
        },
        { stage: 'tts' }
      );

      expect(result.provider).toBe('fallback');
      expect(result.tier).toBe('fallback');
      // Primary: 3 calls (1 + 2 retries), all failed
      expect(primaryCalls).toBe(3);
      // Fallback: 1 call, succeeded
      expect(fallbackCalls).toBe(1);
    });
  });

  describe('error propagation', () => {
    it('should preserve error context through composition', async () => {
      const providers: TestProvider[] = [createProvider('only')];

      const executor = vi.fn().mockRejectedValue(
        NexusError.retryable('NEXUS_TTS_TIMEOUT', 'Original timeout', 'tts', {
          requestId: 'abc123',
        })
      );

      // Single provider fails, throws NEXUS_FALLBACK_EXHAUSTED (CRITICAL)
      // withRetry doesn't retry CRITICAL errors
      try {
        await withRetry(
          () => withFallback(providers, executor, { stage: 'tts' }),
          { maxRetries: 1, stage: 'tts' }
        );
        expect.fail('Expected to throw');
      } catch (error) {
        const nexusError = error as NexusError;
        expect(nexusError.code).toBe('NEXUS_FALLBACK_EXHAUSTED');
        // Should have fallback attempt info
        expect(nexusError.context?.attempts).toBeDefined();
      }
    });
  });
});
