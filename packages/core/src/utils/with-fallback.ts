/**
 * Fallback utility for provider chain execution
 * @module @nexus-ai/core/utils/with-fallback
 */

import { NexusError } from '../errors/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Provider must have a name property for tracking
 */
export interface NamedProvider {
  name: string;
}

/**
 * Options for configuring fallback behavior
 */
export interface FallbackOptions {
  /** Stage name for error context */
  stage?: string;
  /** Optional callback when fallback is triggered */
  onFallback?: (
    fromProvider: string,
    toProvider: string,
    error: NexusError
  ) => void;
}

/**
 * Record of a single provider attempt
 */
export interface FallbackAttempt {
  /** Provider name that was attempted */
  provider: string;
  /** Whether this attempt succeeded */
  success: boolean;
  /** Error if attempt failed */
  error?: NexusError;
  /** Duration of this attempt in ms */
  durationMs: number;
}

/**
 * Result from a successful fallback operation
 */
export interface FallbackResult<T> {
  /** The successful result */
  result: T;
  /** Name of the provider that succeeded */
  provider: string;
  /** 'primary' if first provider, 'fallback' otherwise */
  tier: 'primary' | 'fallback';
  /** All attempts made (successful + failed) */
  attempts: FallbackAttempt[];
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Try multiple providers in order until one succeeds
 *
 * Falls back to the next provider on ANY error. This ensures maximum
 * resilience - if the primary provider fails for any reason, we try
 * fallbacks before giving up.
 *
 * @param providers - Array of providers to try in order (first = primary)
 * @param executor - Function to execute with each provider
 * @param options - Fallback configuration options
 * @returns Promise resolving to FallbackResult with result and provider info
 * @throws NexusError with CRITICAL severity when all providers fail
 *
 * @example
 * ```typescript
 * const { result, provider, tier } = await withFallback(
 *   [
 *     { name: 'gemini-2.5-pro-tts', synthesize: geminiTTS.synthesize },
 *     { name: 'chirp3-hd', synthesize: chirp.synthesize },
 *     { name: 'wavenet', synthesize: wavenet.synthesize }
 *   ],
 *   (p) => p.synthesize(text),
 *   { stage: 'tts' }
 * );
 * console.log(`TTS succeeded with ${provider} (${tier})`);
 * ```
 *
 * @example
 * ```typescript
 * // With onFallback callback for logging
 * const result = await withFallback(
 *   providers,
 *   (p) => p.execute(data),
 *   {
 *     stage: 'llm',
 *     onFallback: (from, to, error) => {
 *       logger.warn('Provider fallback', {
 *         fromProvider: from,
 *         toProvider: to,
 *         error: error.code
 *       });
 *     }
 *   }
 * );
 * ```
 */
export async function withFallback<T, P extends NamedProvider>(
  providers: P[],
  executor: (provider: P) => Promise<T>,
  options: FallbackOptions = {}
): Promise<FallbackResult<T>> {
  const { stage, onFallback } = options;

  // Validate providers array
  if (providers.length === 0) {
    throw NexusError.critical(
      'NEXUS_FALLBACK_NO_PROVIDERS',
      'No providers configured for fallback',
      stage
    );
  }

  const attempts: FallbackAttempt[] = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const startTime = Date.now();

    try {
      const result = await executor(provider);

      // Record successful attempt
      attempts.push({
        provider: provider.name,
        success: true,
        durationMs: Date.now() - startTime,
      });

      return {
        result,
        provider: provider.name,
        tier: i === 0 ? 'primary' : 'fallback',
        attempts,
      };
    } catch (error) {
      const nexusError = NexusError.fromError(error, stage);
      const durationMs = Date.now() - startTime;

      // Log the actual error for debugging
      console.error(`[withFallback] Provider ${provider.name} failed:`, {
        code: nexusError.code,
        message: nexusError.message,
        originalError: error instanceof Error ? error.message : String(error),
        durationMs,
      });

      // Record failed attempt
      attempts.push({
        provider: provider.name,
        success: false,
        error: nexusError,
        durationMs,
      });

      // Notify callback if not last provider
      if (i < providers.length - 1) {
        const nextProvider = providers[i + 1];
        onFallback?.(provider.name, nextProvider.name, nexusError);
      }

      // Continue to next provider
      // We try ALL providers regardless of error type for maximum resilience
    }
  }

  // All providers failed - throw CRITICAL error with full attempt history
  throw NexusError.critical(
    'NEXUS_FALLBACK_EXHAUSTED',
    `All ${providers.length} providers failed`,
    stage,
    {
      attempts: attempts.map((a) => ({
        provider: a.provider,
        success: a.success,
        errorCode: a.error?.code,
        durationMs: a.durationMs,
      })),
    }
  );
}
