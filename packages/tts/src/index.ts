/**
 * TTS synthesis stage for NEXUS-AI pipeline
 * @module @nexus-ai/tts
 *
 * Provides TTS synthesis with three-tier provider fallback chain:
 * - Primary: Gemini 2.5 Pro TTS (best quality)
 * - Fallback 1: Chirp 3 HD
 * - Fallback 2: WaveNet (last resort)
 *
 * Features:
 * - 44.1kHz WAV output (CD quality)
 * - SSML phoneme tag support
 * - Audio quality validation (silence, clipping, duration)
 * - Cost tracking and fallback monitoring
 * - Cloud Storage integration
 *
 * @example
 * ```typescript
 * import { executeTTS } from '@nexus-ai/tts';
 *
 * const output = await executeTTS({
 *   pipelineId: '2026-01-08',
 *   previousStage: 'pronunciation',
 *   data: {
 *     ssmlScript: '<speak>Hello world</speak>',
 *   },
 *   config: { timeout: 300000, retries: 3 }
 * });
 *
 * console.log(`Audio: ${output.data.audioUrl}`);
 * ```
 */

// Main stage function
export { executeTTS } from './tts.js';

// Types
export type { TTSInput, TTSOutput, AudioQualityInfo, ChunkInfo, AudioSegment } from './types.js';

// Audio quality utilities
export {
  detectSilence,
  detectClipping,
  calculateAverageLoudness,
  validateDuration,
  validateAudioQuality,
  stitchAudio,
} from './audio-quality.js';

// Chunking utilities
export { chunkScript, getChunkSize } from './chunker.js';
