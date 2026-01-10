/**
 * Chirp TTS Provider implementation
 * First fallback TTS provider for NEXUS-AI pipeline
 *
 * @module @nexus-ai/core/providers/tts/chirp-provider
 */

import type { TTSProvider, TTSOptions, TTSResult, Voice } from '../../types/providers.js';
import { withRetry } from '../../utils/with-retry.js';
import { NexusError } from '../../errors/index.js';
import { getSecret } from '../../secrets/index.js';

// =============================================================================
// Constants
// =============================================================================

/** Default model for Chirp TTS */
const DEFAULT_MODEL = 'chirp3-hd';

/**
 * Pricing per character (Chirp HD)
 * Slightly cheaper than Gemini TTS
 */
const COST_PER_CHAR = 0.000012; // ~$0.000012 per character

// =============================================================================
// ChirpProvider
// =============================================================================

/**
 * Chirp TTS Provider
 *
 * Implements the TTSProvider interface using Google's Chirp 3 HD voices.
 * Used as first fallback when Gemini TTS hits quota limits.
 *
 * @example
 * ```typescript
 * const provider = new ChirpProvider('chirp3-hd');
 * const result = await provider.synthesize('Hello world', { voice: 'en-US-Chirp3-HD-F' });
 * console.log(result.audioUrl);
 * ```
 */
export class ChirpProvider implements TTSProvider {
  /** Provider name for withFallback tracking */
  readonly name: string;

  /** Model identifier */
  private readonly model: string;

  /**
   * Create a new Chirp TTS provider
   * @param model - Model name (default: 'chirp3-hd')
   */
  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
    this.name = model;
  }

  /**
   * Synthesize text to audio
   *
   * Uses withRetry internally for resilience against transient failures.
   *
   * @param text - Text to synthesize (may contain SSML)
   * @param options - Synthesis options
   * @returns TTSResult with audio file reference and metadata
   */
  async synthesize(text: string, _options: TTSOptions): Promise<TTSResult> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_TTS_INVALID_INPUT',
        'Text to synthesize cannot be empty',
        'tts',
        { textLength: text?.length ?? 0, provider: this.name }
      );
    }

    const apiKey = await getSecret('nexus-gemini-api-key');

    const retryResult = await withRetry(
      async () => {
        try {
          // TODO: Story 1.6 - Replace with actual Chirp API call
          throw NexusError.critical(
            'NEXUS_TTS_NOT_CONFIGURED',
            `Chirp TTS SDK not configured. Set NEXUS_GEMINI_API_KEY and implement SDK integration in Story 1.6.`,
            'tts',
            { model: this.model, apiKeyPresent: !!apiKey }
          );
        } catch (error) {
          if (error instanceof NexusError) {
            throw error;
          }
          throw NexusError.fromError(error, 'tts');
        }
      },
      {
        maxRetries: 3,
        stage: 'tts',
        baseDelay: 1000,
        maxDelay: 30000,
      }
    );

    return retryResult.result;
  }

  /**
   * Get available voices for this provider
   *
   * @returns List of available Chirp voices
   */
  async getVoices(): Promise<Voice[]> {
    // TODO: Story 1.6 - Implement actual voice listing from API
    return [
      {
        id: 'en-US-Chirp3-HD-F',
        name: 'Chirp3 HD Female (US)',
        language: 'en-US',
        gender: 'FEMALE',
        naturalness: 'NATURAL',
      },
      {
        id: 'en-US-Chirp3-HD-M',
        name: 'Chirp3 HD Male (US)',
        language: 'en-US',
        gender: 'MALE',
        naturalness: 'NATURAL',
      },
    ];
  }

  /**
   * Estimate cost before synthesis
   *
   * @param text - Text to synthesize
   * @returns Estimated cost in USD
   */
  estimateCost(text: string): number {
    return Number((text.length * COST_PER_CHAR).toFixed(6));
  }
}
