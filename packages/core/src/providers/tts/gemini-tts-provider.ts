/**
 * Gemini TTS Provider implementation
 * Primary TTS provider for NEXUS-AI pipeline
 *
 * @module @nexus-ai/core/providers/tts/gemini-tts-provider
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { TTSProvider, TTSOptions, TTSResult, Voice } from '../../types/providers.js';
import { withRetry } from '../../utils/with-retry.js';
import { NexusError } from '../../errors/index.js';

// =============================================================================
// Constants
// =============================================================================

/** Default model for TTS synthesis */
const DEFAULT_MODEL = 'gemini-2.5-pro-tts';

/**
 * Pricing per character (Gemini TTS)
 * Based on Google Cloud TTS pricing as of 2026
 */
const COST_PER_CHAR = 0.000016; // ~$0.000016 per character

// =============================================================================
// GeminiTTSProvider
// =============================================================================

/**
 * Gemini TTS Provider
 *
 * Implements the TTSProvider interface using Google's Gemini TTS model.
 * Best quality TTS with 30 speakers, 80+ locales, and natural language control.
 *
 * Features:
 * - Natural language control for style, accent, pace, emotion
 * - SSML support for pronunciation hints
 * - 44.1kHz WAV output
 *
 * @example
 * ```typescript
 * const provider = new GeminiTTSProvider('gemini-2.5-pro-tts');
 * const result = await provider.synthesize('Hello world', { voice: 'en-US-Neural2-F' });
 * console.log(result.audioUrl);
 * ```
 */
export class GeminiTTSProvider implements TTSProvider {
  /** Provider name for withFallback tracking */
  readonly name: string;

  /** Model identifier */
  private readonly model: string;

  /** Google Cloud TTS Client */
  private client: TextToSpeechClient | null = null;

  /**
   * Create a new Gemini TTS provider
   * @param model - Model name (default: 'gemini-2.5-pro-tts')
   */
  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
    this.name = model;
  }

  /**
   * Initialize the Google Cloud TTS client
   */
  private async getClient(): Promise<TextToSpeechClient> {
    if (!this.client) {
      // TextToSpeechClient uses Application Default Credentials (ADC)
      // In Cloud Run, this is automatically provided by the service account
      // No API key needed - ADC handles authentication
      this.client = new TextToSpeechClient();
    }
    return this.client;
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
  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_TTS_INVALID_INPUT',
        'Text to synthesize cannot be empty',
        'tts',
        { textLength: text?.length ?? 0 }
      );
    }

    const client = await this.getClient();

    const retryResult = await withRetry(
      async () => {
        try {
          // Construct request
          const request = {
            input: options.ssmlInput ? { ssml: text } : { text },
            voice: {
              languageCode: options.language ?? 'en-US',
              name: options.voice ?? 'en-US-Neural2-F', // Default to high quality Neural2
            },
            audioConfig: {
              audioEncoding: 'LINEAR16' as const, // WAV format
              sampleRateHertz: 44100,
              speakingRate: options.speakingRate ?? 1.0,
              pitch: options.pitch ?? 0,
            },
          };

          // Call API
          const [response] = await client.synthesizeSpeech(request);

          if (!response.audioContent) {
            throw new Error('No audio content received from TTS API');
          }

          const audioBuffer = Buffer.from(response.audioContent);

          // Calculate estimated cost
          const cost = this.estimateCost(text);

          // Calculate duration from buffer size
          // 16-bit = 2 bytes, 44100 samples/sec -> 88200 bytes/sec
          const durationSec = audioBuffer.length / 88200;

          // Return result with audio content
          const result: TTSResult = {
            audioUrl: '', // Will be filled by Stage after upload
            audioContent: audioBuffer,
            durationSec: Number(durationSec.toFixed(2)),
            cost,
            model: this.model,
            quality: 'primary',
            codec: 'wav',
            sampleRate: 44100,
          };

          return result;
        } catch (error) {
          // Log the actual error for debugging
          console.error('[TTS] Gemini TTS synthesis error:', {
            name: error instanceof Error ? error.name : 'unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined,
          });

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
   * @returns List of available voices
   */
  async getVoices(): Promise<Voice[]> {
    // TODO: Story 1.6 - Implement actual voice listing from API
    // For now, return static list of common voices
    return [
      {
        id: 'en-US-Neural2-F',
        name: 'Neural2 Female (US)',
        language: 'en-US',
        gender: 'FEMALE',
        naturalness: 'NATURAL',
      },
      {
        id: 'en-US-Neural2-M',
        name: 'Neural2 Male (US)',
        language: 'en-US',
        gender: 'MALE',
        naturalness: 'NATURAL',
      },
      {
        id: 'en-GB-Neural2-F',
        name: 'Neural2 Female (UK)',
        language: 'en-GB',
        gender: 'FEMALE',
        naturalness: 'NATURAL',
      },
      {
        id: 'en-GB-Neural2-M',
        name: 'Neural2 Male (UK)',
        language: 'en-GB',
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
    // Cost is based on character count
    return Number((text.length * COST_PER_CHAR).toFixed(6));
  }
}
