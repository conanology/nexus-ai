/**
 * Edge TTS Provider — uses Microsoft Edge's free TTS service
 *
 * Fallback TTS provider for local development when:
 * - GCP billing is suspended (no @google-cloud/text-to-speech)
 * - AI Studio TTS is not yet available for the model
 *
 * Uses the `edge-tts` npm package which accesses Microsoft's free TTS service.
 * No API key required, good quality, multiple voices.
 *
 * @module @nexus-ai/core/providers/tts/edge-tts-provider
 */

import type { TTSProvider, TTSOptions, TTSResult, Voice } from '../../types/providers.js';
import { getWavDuration } from '../../utils/wav-utils.js';
import { NexusError } from '../../errors/index.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

/**
 * Edge TTS voice mapping
 */
const EDGE_VOICES: Record<string, string> = {
  'default-female': 'en-US-JennyNeural',
  'default-male': 'en-US-GuyNeural',
  'narrative': 'en-US-AriaNeural',
  'casual': 'en-US-JennyNeural',
  'formal': 'en-US-JennyNeural',
};

/**
 * Edge TTS Provider
 *
 * Uses Microsoft Edge's free TTS service via the `edge-tts` Python package
 * or the `edge-tts` npm package. Falls back gracefully if not installed.
 */
export class EdgeTTSProvider implements TTSProvider {
  readonly name = 'edge-tts';
  private edgeTtsAvailable: boolean | null = null;

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_TTS_INVALID_INPUT',
        'Text to synthesize cannot be empty',
        'tts',
        { textLength: text?.length ?? 0, provider: this.name }
      );
    }

    // Strip SSML tags — edge-tts expects plain text
    const plainText = options.ssmlInput
      ? text.replace(/<[^>]+>/g, '').trim()
      : text;

    // Select voice
    const voice = this.resolveVoice(options.voice);

    // Check if edge-tts is available (Python CLI)
    if (this.edgeTtsAvailable === null) {
      this.edgeTtsAvailable = await this.checkEdgeTts();
    }

    if (!this.edgeTtsAvailable) {
      throw NexusError.critical(
        'NEXUS_TTS_EDGE_NOT_AVAILABLE',
        'edge-tts is not installed. Install with: pip install edge-tts',
        'tts'
      );
    }

    const tmpFile = join(tmpdir(), `nexus-edge-tts-${randomUUID()}.mp3`);
    const tmpWavFile = join(tmpdir(), `nexus-edge-tts-${randomUUID()}.wav`);

    try {
      // Generate audio using edge-tts CLI
      const rate = options.speakingRate
        ? `${options.speakingRate >= 1 ? '+' : ''}${Math.round((options.speakingRate - 1) * 100)}%`
        : '+0%';

      await execFileAsync('edge-tts', [
        '--voice', voice,
        '--rate', rate,
        '--text', plainText,
        '--write-media', tmpFile,
      ], { timeout: 120000 });

      // Convert MP3 to WAV using ffmpeg (prefer ffmpeg-static if installed, else system ffmpeg)
      let ffmpegPath = 'ffmpeg';
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ffmpegStatic = await import(/* webpackIgnore: true */ 'ffmpeg-static' as string);
        if (ffmpegStatic.default) {
          ffmpegPath = ffmpegStatic.default as string;
        }
      } catch {
        // Use system ffmpeg
      }

      await execFileAsync(ffmpegPath, [
        '-i', tmpFile,
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '1',
        '-y',
        tmpWavFile,
      ], { timeout: 60000 });

      const audioBuffer = await fs.readFile(tmpWavFile);
      const durationSec = getWavDuration(audioBuffer);

      return {
        audioUrl: '',
        audioContent: audioBuffer,
        durationSec: Number(durationSec.toFixed(2)),
        cost: 0, // Free service
        model: 'edge-tts',
        quality: 'fallback',
        codec: 'wav',
        sampleRate: 44100,
      };
    } catch (error) {
      console.error('[TTS] Edge TTS synthesis error:', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'tts');
    } finally {
      // Cleanup temp files
      await fs.unlink(tmpFile).catch(() => {});
      await fs.unlink(tmpWavFile).catch(() => {});
    }
  }

  async getVoices(): Promise<Voice[]> {
    return [
      { id: 'en-US-JennyNeural', name: 'Jenny (US)', language: 'en-US', gender: 'FEMALE', naturalness: 'NATURAL' },
      { id: 'en-US-GuyNeural', name: 'Guy (US)', language: 'en-US', gender: 'MALE', naturalness: 'NATURAL' },
      { id: 'en-US-AriaNeural', name: 'Aria (US)', language: 'en-US', gender: 'FEMALE', naturalness: 'NATURAL' },
      { id: 'en-GB-SoniaNeural', name: 'Sonia (UK)', language: 'en-GB', gender: 'FEMALE', naturalness: 'NATURAL' },
      { id: 'en-GB-RyanNeural', name: 'Ryan (UK)', language: 'en-GB', gender: 'MALE', naturalness: 'NATURAL' },
    ];
  }

  estimateCost(_text: string): number {
    return 0; // Free service
  }

  private resolveVoice(voice?: string): string {
    if (!voice) return EDGE_VOICES['default-female'];

    // If it looks like an edge-tts voice name, use directly
    if (voice.includes('Neural')) return voice;

    // Map from Google TTS voice patterns
    if (voice.includes('Female') || voice.includes('-F')) return EDGE_VOICES['default-female'];
    if (voice.includes('Male') || voice.includes('-M')) return EDGE_VOICES['default-male'];

    return EDGE_VOICES['default-female'];
  }

  private async checkEdgeTts(): Promise<boolean> {
    try {
      await execFileAsync('edge-tts', ['--version'], { timeout: 5000 });
      return true;
    } catch {
      console.warn('[TTS] edge-tts not found. Install with: pip install edge-tts');
      return false;
    }
  }
}
