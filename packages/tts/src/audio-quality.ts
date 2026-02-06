/**
 * Audio quality validation utilities
 * @module @nexus-ai/tts/audio-quality
 */

import { AudioQualityInfo, AudioSegment } from './types.js';
import { createLogger } from '@nexus-ai/core/observability';
import { parseWavHeader } from '@nexus-ai/core/utils';

const logger = createLogger('nexus.tts.audio-quality');

// =============================================================================
// Constants
// =============================================================================

/** Maximum allowed silence percentage (AC5: <5%) */
const MAX_SILENCE_PCT = 5;

/** Silence threshold in dB */
const SILENCE_THRESHOLD_DB = -40;

/** Maximum amplitude (full scale) for clipping detection */
const MAX_AMPLITUDE = 32767; // for 16-bit PCM

/** Expected words per minute for speech */
const WORDS_PER_MINUTE = 140;

/** PCM data extracted from a WAV buffer along with its channel count */
interface ExtractedPCM {
  pcmData: Buffer;
  numChannels: number;
}

/** Duration tolerance (±20%) */
const DURATION_TOLERANCE = 0.2;

// =============================================================================
// Quality Check Functions
// =============================================================================

/**
 * Detect silence in audio buffer
 *
 * Analyzes PCM samples and calculates percentage of audio below silence threshold.
 * Silence is defined as samples below -40dB.
 *
 * @param audioBuffer - Raw audio buffer (16-bit PCM)
 * @param sampleRate - Sample rate in Hz
 * @returns Silence information with percentage
 *
 * @example
 * ```typescript
 * const result = detectSilence(buffer, 44100);
 * if (result.silencePercentage > 5) {
 *   console.warn('Too much silence detected');
 * }
 * ```
 */
export function detectSilence(
  audioBuffer: Buffer,
  sampleRate: number
): { silencePercentage: number; silentSamples: number; totalSamples: number } {
  // Convert buffer to 16-bit PCM samples
  const totalSamples = audioBuffer.length / 2; // 16-bit = 2 bytes per sample
  let silentSamples = 0;

  for (let i = 0; i < audioBuffer.length; i += 2) {
    const sample = audioBuffer.readInt16LE(i);
    const amplitude = Math.abs(sample);

    // Convert amplitude to dB
    const db = 20 * Math.log10(amplitude / MAX_AMPLITUDE);

    if (db < SILENCE_THRESHOLD_DB) {
      silentSamples++;
    }
  }

  const silencePercentage = (silentSamples / totalSamples) * 100;

  logger.debug({
    totalSamples,
    silentSamples,
    silencePercentage: silencePercentage.toFixed(2),
    sampleRate,
  }, 'Silence detection complete');

  return {
    silencePercentage,
    silentSamples,
    totalSamples,
  };
}

/**
 * Detect clipping (audio distortion)
 *
 * Checks for samples at maximum amplitude (0dBFS) which indicates clipping.
 *
 * @param audioBuffer - Raw audio buffer (16-bit PCM)
 * @returns Whether clipping was detected and clipped sample count
 *
 * @example
 * ```typescript
 * const result = detectClipping(buffer);
 * if (result.hasClipping) {
 *   console.error('Audio clipping detected');
 * }
 * ```
 */
export function detectClipping(audioBuffer: Buffer): {
  hasClipping: boolean;
  clippedSamples: number;
  totalSamples: number;
} {
  const totalSamples = audioBuffer.length / 2;
  let clippedSamples = 0;

  for (let i = 0; i < audioBuffer.length; i += 2) {
    const sample = audioBuffer.readInt16LE(i);
    const amplitude = Math.abs(sample);

    // Check if sample is at or near maximum amplitude
    if (amplitude >= MAX_AMPLITUDE - 10) {
      // Allow small margin
      clippedSamples++;
    }
  }

  const hasClipping = clippedSamples > 0;

  logger.debug({
    totalSamples,
    clippedSamples,
    hasClipping,
  }, 'Clipping detection complete');

  return {
    hasClipping,
    clippedSamples,
    totalSamples,
  };
}

/**
 * Calculate average loudness
 *
 * Computes RMS (Root Mean Square) loudness in dB.
 *
 * @param audioBuffer - Raw audio buffer (16-bit PCM)
 * @returns Average loudness in dB
 */
export function calculateAverageLoudness(audioBuffer: Buffer): number {
  const totalSamples = audioBuffer.length / 2;
  let sumSquares = 0;

  for (let i = 0; i < audioBuffer.length; i += 2) {
    const sample = audioBuffer.readInt16LE(i);
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / totalSamples);
  const db = 20 * Math.log10(rms / MAX_AMPLITUDE);

  logger.debug({
    rms: rms.toFixed(2),
    db: db.toFixed(2),
  }, 'Loudness calculation complete');

  return db;
}

/**
 * Validate audio duration matches expected from word count
 *
 * Checks that actual duration is within ±20% of expected duration based on
 * typical speech rate (~140 words/minute).
 *
 * @param durationSec - Actual audio duration in seconds
 * @param wordCount - Number of words in script
 * @returns Validation result with expected duration
 *
 * @example
 * ```typescript
 * const result = validateDuration(240, 560);
 * if (!result.isValid) {
 *   console.warn('Duration mismatch');
 * }
 * ```
 */
export function validateDuration(
  durationSec: number,
  wordCount: number
): {
  isValid: boolean;
  expectedDurationSec: number;
  actualDurationSec: number;
  differencePercent: number;
} {
  // Calculate expected duration: words / (words per minute / 60 seconds)
  const expectedDurationSec = (wordCount / WORDS_PER_MINUTE) * 60;

  // Calculate tolerance bounds
  const minDuration = expectedDurationSec * (1 - DURATION_TOLERANCE);
  const maxDuration = expectedDurationSec * (1 + DURATION_TOLERANCE);

  const isValid = durationSec >= minDuration && durationSec <= maxDuration;
  const differencePercent =
    ((durationSec - expectedDurationSec) / expectedDurationSec) * 100;

  logger.debug({
    wordCount,
    expectedDurationSec: expectedDurationSec.toFixed(2),
    actualDurationSec: durationSec.toFixed(2),
    differencePercent: differencePercent.toFixed(2),
    isValid,
  }, 'Duration validation complete');

  return {
    isValid,
    expectedDurationSec,
    actualDurationSec: durationSec,
    differencePercent,
  };
}

/**
 * Perform comprehensive audio quality checks
 *
 * Runs all quality checks (silence, clipping, duration) and returns results.
 *
 * @param audioBuffer - Raw audio buffer (16-bit PCM)
 * @param sampleRate - Sample rate in Hz
 * @param durationSec - Audio duration in seconds
 * @param wordCount - Number of words in script (optional, for duration validation)
 * @returns Audio quality information
 *
 * @example
 * ```typescript
 * const quality = validateAudioQuality(buffer, 44100, 240, 560);
 * if (quality.silencePct > 5 || quality.clippingDetected) {
 *   // Quality gate fails
 * }
 * ```
 */
export function validateAudioQuality(
  audioBuffer: Buffer,
  sampleRate: number,
  durationSec: number,
  wordCount?: number
): AudioQualityInfo {
  logger.info({
    bufferSize: audioBuffer.length,
    sampleRate,
    durationSec,
    wordCount,
  }, 'Starting audio quality validation');

  // Run quality checks
  const silenceResult = detectSilence(audioBuffer, sampleRate);
  const clippingResult = detectClipping(audioBuffer);
  const loudness = calculateAverageLoudness(audioBuffer);

  // Duration validation (if word count provided)
  let durationValid = true;
  if (wordCount) {
    const durationResult = validateDuration(durationSec, wordCount);
    durationValid = durationResult.isValid;
  }

  const quality: AudioQualityInfo = {
    silencePct: Number(silenceResult.silencePercentage.toFixed(2)),
    clippingDetected: clippingResult.hasClipping,
    averageLoudnessDb: Number(loudness.toFixed(2)),
    durationValid,
  };

  // Log warnings
  if (quality.silencePct >= MAX_SILENCE_PCT) {
    logger.warn({
      silencePct: quality.silencePct,
      threshold: MAX_SILENCE_PCT,
    }, 'Excessive silence detected in audio');
  }

  if (quality.clippingDetected) {
    logger.warn({
      clippedSamples: clippingResult.clippedSamples,
    }, 'Audio clipping detected');
  }

  if (!quality.durationValid && wordCount) {
    logger.warn({
      durationSec,
      wordCount,
    }, 'Audio duration does not match expected from word count');
  }

  logger.info({
    quality,
  }, 'Audio quality validation complete');

  return quality;
}

// =============================================================================
// Audio Stitching Functions
// =============================================================================

/**
 * Stitch multiple audio segments into a single WAV file
 *
 * Concatenates WAV segments with:
 * - Configurable silence padding between segments
 * - Audio level normalization across all segments
 * - Proper WAV header generation
 *
 * @param segments - Array of audio segments to stitch
 * @param silenceDurationMs - Silence padding between segments (default: 200ms)
 * @returns Buffer containing stitched WAV audio
 *
 * @example
 * ```typescript
 * const segments = [
 *   { index: 0, audioBuffer: buffer1, durationSec: 120 },
 *   { index: 1, audioBuffer: buffer2, durationSec: 110 },
 * ];
 * const stitched = stitchAudio(segments, 200);
 * ```
 */
export function stitchAudio(
  segments: AudioSegment[],
  silenceDurationMs: number = 200
): Buffer {
  logger.info({
    segmentCount: segments.length,
    silenceDurationMs,
  }, 'Starting audio stitching');

  // Sort segments by index to ensure correct order
  const sorted = segments.sort((a, b) => a.index - b.index);

  // Extract PCM data and channel info from each segment
  const extracted = sorted.map((segment) => extractPCMData(segment.audioBuffer));
  const pcmBuffers = extracted.map((e) => e.pcmData);

  // Determine channel count from first segment (TTS providers return mono)
  const numChannels = extracted[0]?.numChannels ?? 1;

  // Validate all segments have the same channel count
  for (let i = 1; i < extracted.length; i++) {
    if (extracted[i].numChannels !== numChannels) {
      logger.warn({
        segmentIndex: i,
        expectedChannels: numChannels,
        actualChannels: extracted[i].numChannels,
      }, 'Channel count mismatch between segments, using first segment channel count');
    }
  }

  // Normalize audio levels across all segments
  const normalized = normalizeAudioLevels(pcmBuffers);

  // Generate silence padding with matching channel count
  const sampleRate = 44100;
  const silenceBuffer = generateSilence(silenceDurationMs, sampleRate, numChannels);

  // Concatenate segments with silence padding
  const combined: Buffer[] = [];
  normalized.forEach((pcmBuffer, i) => {
    combined.push(pcmBuffer);
    // Add silence between segments (but not after last segment)
    if (i < normalized.length - 1) {
      combined.push(silenceBuffer);
    }
  });

  // Combine all PCM buffers
  const totalPcmData = Buffer.concat(combined);

  // Create WAV file with header matching input channel count
  const wavBuffer = createWAVBuffer(totalPcmData, sampleRate, numChannels);

  logger.info({
    totalPcmBytes: totalPcmData.length,
    totalWavBytes: wavBuffer.length,
    segmentCount: segments.length,
    numChannels,
  }, 'Audio stitching complete');

  return wavBuffer;
}

/**
 * Extract PCM data from WAV buffer and read actual channel count
 *
 * Uses parseWavHeader() to correctly determine channel count, data offset,
 * and data size from the WAV header.
 *
 * @param wavBuffer - Complete WAV file buffer
 * @returns PCM data and the actual number of channels
 */
function extractPCMData(wavBuffer: Buffer): ExtractedPCM {
  // Minimum WAV header size is 44 bytes
  if (wavBuffer.length < 44) {
    logger.warn({
      bufferSize: wavBuffer.length,
    }, 'WAV buffer too small, returning as-is (assuming mono)');
    return { pcmData: wavBuffer, numChannels: 1 };
  }

  // Verify RIFF header
  if (wavBuffer.toString('utf8', 0, 4) !== 'RIFF') {
    logger.warn('Invalid WAV header: missing RIFF, returning as-is (assuming mono)');
    return { pcmData: wavBuffer, numChannels: 1 };
  }

  // Verify WAVE format
  if (wavBuffer.toString('utf8', 8, 12) !== 'WAVE') {
    logger.warn('Invalid WAV header: missing WAVE, returning as-is (assuming mono)');
    return { pcmData: wavBuffer, numChannels: 1 };
  }

  try {
    const wavInfo = parseWavHeader(wavBuffer);
    const end = Math.min(wavInfo.dataOffset + wavInfo.dataSize, wavBuffer.length);
    return {
      pcmData: wavBuffer.subarray(wavInfo.dataOffset, end),
      numChannels: wavInfo.numChannels,
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to parse WAV header, falling back to fixed offset (assuming mono)');
    return { pcmData: wavBuffer.subarray(44), numChannels: 1 };
  }
}

/**
 * Generate silence buffer (16-bit PCM)
 *
 * @param durationMs - Duration of silence in milliseconds
 * @param sampleRate - Sample rate in Hz
 * @param numChannels - Number of audio channels (1 = mono, 2 = stereo)
 * @returns Buffer of silent PCM samples
 */
function generateSilence(durationMs: number, sampleRate: number, numChannels: number = 1): Buffer {
  // Calculate number of samples needed
  // 16-bit = 2 bytes per sample per channel
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const bufferSize = numSamples * numChannels * 2; // numChannels * 2 bytes

  // Create buffer filled with zeros (silence)
  const silenceBuffer = Buffer.alloc(bufferSize, 0);

  logger.debug({
    durationMs,
    sampleRate,
    numChannels,
    numSamples,
    bufferSize,
  }, 'Generated silence buffer');

  return silenceBuffer;
}

/**
 * Normalize audio levels across all segments
 *
 * Prevents volume jumps between segments by:
 * 1. Finding maximum amplitude across all segments
 * 2. Scaling all segments to 90% of max (prevents clipping)
 *
 * @param pcmBuffers - Array of PCM data buffers
 * @returns Normalized PCM buffers
 */
function normalizeAudioLevels(pcmBuffers: Buffer[]): Buffer[] {
  logger.debug({
    bufferCount: pcmBuffers.length,
  }, 'Starting audio normalization');

  // Find maximum amplitude across all segments
  let maxAmplitude = 0;
  for (const buffer of pcmBuffers) {
    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      const amplitude = Math.abs(sample);
      maxAmplitude = Math.max(maxAmplitude, amplitude);
    }
  }

  // If max amplitude is zero or very low, return original buffers
  if (maxAmplitude < 100) {
    logger.warn({
      maxAmplitude,
    }, 'Max amplitude too low, skipping normalization');
    return pcmBuffers;
  }

  // Calculate scale factor: normalize to 90% of maximum to prevent clipping
  const targetMax = MAX_AMPLITUDE * 0.9; // 90% of 16-bit max
  const scaleFactor = targetMax / maxAmplitude;

  logger.debug({
    maxAmplitude,
    targetMax,
    scaleFactor: scaleFactor.toFixed(4),
  }, 'Calculated normalization scale factor');

  // Apply normalization to all buffers
  return pcmBuffers.map((buffer, index) => {
    const normalized = Buffer.alloc(buffer.length);

    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      const normalizedSample = Math.round(sample * scaleFactor);

      // Clamp to prevent overflow
      const clampedSample = Math.max(
        -MAX_AMPLITUDE,
        Math.min(MAX_AMPLITUDE, normalizedSample)
      );

      normalized.writeInt16LE(clampedSample, i);
    }

    logger.debug({
      segmentIndex: index,
      originalSize: buffer.length,
      normalizedSize: normalized.length,
    }, 'Segment normalized');

    return normalized;
  });
}

/**
 * Create WAV file buffer with proper header
 *
 * Generates standard WAV file with:
 * - PCM format
 * - Configurable sample rate
 * - 16-bit depth
 * - Configurable channel count (matches input)
 *
 * @param pcmData - Raw PCM audio data
 * @param sampleRate - Sample rate in Hz
 * @param numChannels - Number of audio channels (1 = mono, 2 = stereo)
 * @returns Complete WAV file buffer
 */
function createWAVBuffer(pcmData: Buffer, sampleRate: number, numChannels: number = 1): Buffer {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;

  // WAV file structure:
  // - RIFF header (12 bytes)
  // - fmt chunk (24 bytes)
  // - data chunk (8 bytes + PCM data)

  const header = Buffer.alloc(44);
  let offset = 0;

  // RIFF header
  header.write('RIFF', offset);
  offset += 4;
  header.writeUInt32LE(36 + dataSize, offset); // File size - 8
  offset += 4;
  header.write('WAVE', offset);
  offset += 4;

  // fmt chunk
  header.write('fmt ', offset);
  offset += 4;
  header.writeUInt32LE(16, offset); // fmt chunk size
  offset += 4;
  header.writeUInt16LE(1, offset); // Audio format (1 = PCM)
  offset += 2;
  header.writeUInt16LE(numChannels, offset);
  offset += 2;
  header.writeUInt32LE(sampleRate, offset);
  offset += 4;
  header.writeUInt32LE(byteRate, offset);
  offset += 4;
  header.writeUInt16LE(blockAlign, offset);
  offset += 2;
  header.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data chunk
  header.write('data', offset);
  offset += 4;
  header.writeUInt32LE(dataSize, offset);

  // Combine header and PCM data
  const wavBuffer = Buffer.concat([header, pcmData]);

  logger.debug({
    headerSize: header.length,
    pcmDataSize: dataSize,
    totalSize: wavBuffer.length,
    sampleRate,
    numChannels,
    bitsPerSample,
  }, 'Created WAV buffer');

  return wavBuffer;
}
