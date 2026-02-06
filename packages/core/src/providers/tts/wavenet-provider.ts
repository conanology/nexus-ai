import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { TTSProvider, TTSOptions, TTSResult, Voice } from '../../types/providers.js';
import { withRetry } from '../../utils/with-retry.js';
import { NexusError } from '../../errors/index.js';
import { getWavDuration } from '../../utils/wav-utils.js';

// =============================================================================
// Constants
// =============================================================================

/** Default model for WaveNet TTS */
const DEFAULT_MODEL = 'wavenet';

/**
 * Pricing per character (WaveNet)
 * Cheapest option, most reliable availability
 */
const COST_PER_CHAR = 0.000004; // ~$0.000004 per character

// =============================================================================
// WaveNetProvider
// =============================================================================

/**
 * WaveNet TTS Provider
 *
 * Implements the TTSProvider interface using Google's WaveNet voices.
 * Last resort fallback - standard quality but most reliable availability.
 *
 * @example
 * ```typescript
 * const provider = new WaveNetProvider();
 * const result = await provider.synthesize('Hello world', { voice: 'en-US-Wavenet-F' });
 * console.log(result.audioUrl);
 * ```
 */
export class WaveNetProvider implements TTSProvider {
  /** Provider name for tracking (required for withFallback) */
  readonly name: string;

  /** Model identifier */
  private readonly model: string;

  /** Google Cloud TTS Client */
  private client: TextToSpeechClient | null = null;

  /**
   * Create a new WaveNet TTS provider
   * @param model - Model name (default: 'wavenet')
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
        { textLength: text?.length ?? 0, provider: this.name }
      );
    }

    const client = await this.getClient();

    const retryResult = await withRetry(
      async () => {
        try {
          const request = {
            input: options.ssmlInput ? { ssml: text } : { text },
            voice: {
              languageCode: options.language ?? 'en-US',
              name: options.voice ?? 'en-US-Wavenet-D', // Default to standard WaveNet
            },
            audioConfig: {
              audioEncoding: 'LINEAR16' as const,
              sampleRateHertz: 44100,
              speakingRate: options.speakingRate ?? 1.0,
              pitch: options.pitch ?? 0,
            },
          };

          const [response] = await client.synthesizeSpeech(request);

          if (!response.audioContent) {
            throw new Error('No audio content received from TTS API');
          }

          const audioBuffer = Buffer.from(response.audioContent);
          const cost = this.estimateCost(text);
          const durationSec = getWavDuration(audioBuffer);

          const result: TTSResult = {
            audioUrl: '', // Will be filled by Stage
            audioContent: audioBuffer,
            durationSec: Number(durationSec.toFixed(2)),
            cost,
            model: this.model,
            quality: 'fallback',
            codec: 'wav',
            sampleRate: 44100,
          };

          return result;
        } catch (error) {
          // Log the actual error for debugging
          console.error('[TTS] WaveNet synthesis error:', {
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
   * @returns List of available WaveNet voices
   */
  async getVoices(): Promise<Voice[]> {
    // TODO: Story 1.6 - Implement actual voice listing from API
    return [
      {
        id: 'en-US-Wavenet-F',
        name: 'WaveNet Female (US)',
        language: 'en-US',
        gender: 'FEMALE',
        naturalness: 'STANDARD',
      },
      {
        id: 'en-US-Wavenet-M',
        name: 'WaveNet Male (US)',
        language: 'en-US',
        gender: 'MALE',
        naturalness: 'STANDARD',
      },
      {
        id: 'en-GB-Wavenet-F',
        name: 'WaveNet Female (UK)',
        language: 'en-GB',
        gender: 'FEMALE',
        naturalness: 'STANDARD',
      },
      {
        id: 'en-GB-Wavenet-M',
        name: 'WaveNet Male (UK)',
        language: 'en-GB',
        gender: 'MALE',
        naturalness: 'STANDARD',
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
