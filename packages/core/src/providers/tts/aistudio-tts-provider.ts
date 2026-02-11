/**
 * AI Studio TTS Provider — uses the Generative Language API (API key auth)
 *
 * Routes Gemini TTS through the @google/generative-ai SDK or REST API,
 * which only requires an API key from AI Studio (no service account or GCP billing).
 *
 * This provider is used for local development mode when GCP billing is suspended.
 *
 * @module @nexus-ai/core/providers/tts/aistudio-tts-provider
 */

import type { TTSProvider, TTSOptions, TTSResult, Voice } from '../../types/providers.js';
import { getWavDuration } from '../../utils/wav-utils.js';
import { NexusError } from '../../errors/index.js';

const DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';
const COST_PER_CHAR = 0.000016;

/**
 * Available Gemini TTS voices for the Generative Language API.
 * See: https://ai.google.dev/gemini-api/docs/text-to-speech
 */
const GEMINI_TTS_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir',
  'Aoede', 'Leda', 'Orus', 'Perseus',
];

/**
 * AI Studio TTS Provider
 *
 * Uses the Generative Language API (models.generateContent) with responseModalities: ['AUDIO']
 * to synthesize speech. Only requires a GEMINI_API_KEY / NEXUS_GEMINI_API_KEY, no service account.
 */
export class AIStudioTTSProvider implements TTSProvider {
  readonly name: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
    this.name = `aistudio-${model}`;

    const key = process.env.GEMINI_API_KEY || process.env.NEXUS_GEMINI_API_KEY || '';
    if (!key) {
      throw NexusError.critical(
        'NEXUS_TTS_NO_API_KEY',
        'GEMINI_API_KEY or NEXUS_GEMINI_API_KEY is required for AI Studio TTS',
        'tts'
      );
    }
    this.apiKey = key;
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_TTS_INVALID_INPUT',
        'Text to synthesize cannot be empty',
        'tts',
        { textLength: text?.length ?? 0, provider: this.name }
      );
    }

    // Strip SSML tags if present — the Generative Language API uses plain text
    const plainText = options.ssmlInput
      ? text.replace(/<[^>]+>/g, '').trim()
      : text;

    // Select voice — map from Cloud TTS voice IDs to Gemini voice names
    const voiceName = this.resolveVoice(options.voice);

    try {
      // Call the Generative Language REST API directly
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

      const requestBody = {
        contents: [
          {
            parts: [{ text: plainText }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown');
        throw new Error(`AI Studio TTS API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: { mimeType: string; data: string };
            }>;
          };
        }>;
      };

      // Extract audio from response
      const audioPart = data.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.mimeType?.startsWith('audio/')
      );

      if (!audioPart?.inlineData) {
        throw new Error('No audio content in AI Studio TTS response');
      }

      const audioBase64 = audioPart.inlineData.data;
      const rawBuffer = Buffer.from(audioBase64, 'base64');

      // The API returns raw PCM audio — we need to wrap it in a WAV header
      // Response is PCM 16-bit, 24000 Hz mono (standard for Gemini TTS)
      const sampleRate = 24000;
      const audioBuffer = this.wrapPcmAsWav(rawBuffer, sampleRate, 1, 16);

      const durationSec = getWavDuration(audioBuffer);
      const cost = this.estimateCost(text);

      return {
        audioUrl: '',
        audioContent: audioBuffer,
        durationSec: Number(durationSec.toFixed(2)),
        cost,
        model: this.model,
        quality: 'primary',
        codec: 'wav',
        sampleRate,
      };
    } catch (error) {
      console.error('[TTS] AI Studio TTS synthesis error:', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'tts');
    }
  }

  async getVoices(): Promise<Voice[]> {
    return GEMINI_TTS_VOICES.map((name) => ({
      id: name,
      name: `Gemini ${name}`,
      language: 'en-US',
      gender: 'NEUTRAL' as const,
      naturalness: 'NATURAL' as const,
    }));
  }

  estimateCost(text: string): number {
    return Number((text.length * COST_PER_CHAR).toFixed(6));
  }

  /**
   * Map Cloud TTS voice IDs to Gemini TTS voice names.
   * Falls back to 'Kore' (clear, neutral voice) if no mapping found.
   */
  private resolveVoice(voice?: string): string {
    if (!voice) return 'Kore';

    // If it's already a Gemini voice name, use it directly
    if (GEMINI_TTS_VOICES.includes(voice)) {
      return voice;
    }

    // Map common Cloud TTS patterns to Gemini voices
    if (voice.includes('Female') || voice.includes('-F')) return 'Kore';
    if (voice.includes('Male') || voice.includes('-M')) return 'Puck';

    return 'Kore';
  }

  /**
   * Wrap raw PCM audio data in a WAV container.
   */
  private wrapPcmAsWav(
    pcmData: Buffer,
    sampleRate: number,
    numChannels: number,
    bitsPerSample: number
  ): Buffer {
    const dataSize = pcmData.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;
    const buffer = Buffer.alloc(fileSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize - 8, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // chunk size
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
    buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmData.copy(buffer, 44);

    return buffer;
  }
}
