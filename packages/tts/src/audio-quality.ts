/**
 * Audio quality validation utilities
 * @module @nexus-ai/tts/audio-quality
 */

import { AudioQualityInfo } from './types.js';
import { createLogger } from '@nexus-ai/core/observability';

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
