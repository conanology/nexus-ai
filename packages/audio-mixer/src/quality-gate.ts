/**
 * @nexus-ai/audio-mixer
 * Quality gate validation for audio mixing output
 *
 * Validates mixed audio metrics against defined thresholds.
 */

import type {
  AudioMixerInput,
  AudioMixerOutput,
  AudioMixerQualityResult,
  AudioQualityCheckResult,
  AudioMixerQualityMetrics,
} from './types.js';

import {
  AUDIO_MIXER_ERROR_CODES,
  AUDIO_MIXER_QUALITY_THRESHOLDS,
} from './types.js';

/**
 * Validate audio mix output against quality thresholds.
 *
 * Checks:
 * - Duration match: output duration within 1% of target (CRITICAL)
 * - No clipping: mixed peak < -0.5 dB (DEGRADED)
 * - Voice levels: voice peak between -9 dB and -3 dB (DEGRADED)
 * - Music ducking: music peak < -18 dB during speech, only when ducking applied (DEGRADED)
 *
 * @param output - Audio mixer output with metrics
 * @param input - Audio mixer input with target duration
 * @returns Quality validation result with status, checks, flags, and metrics
 */
export function validateAudioMix(
  output: AudioMixerOutput,
  input: AudioMixerInput
): AudioMixerQualityResult {
  const checks: Record<string, AudioQualityCheckResult> = {
    durationMatch: checkDurationMatch(output, input),
    noClipping: checkNoClipping(output),
    voiceLevels: checkVoiceLevels(output),
    musicDucking: checkMusicDucking(output),
  };

  let status: 'PASS' | 'DEGRADED' | 'FAIL' = 'PASS';
  const flags: string[] = [];

  for (const [_name, check] of Object.entries(checks)) {
    if (!check.passed) {
      if (check.severity === 'CRITICAL') {
        status = 'FAIL';
      } else if (status !== 'FAIL') {
        status = 'DEGRADED';
      }

      if (check.code) {
        flags.push(check.code);
      }
    }
  }

  const metrics: AudioMixerQualityMetrics = {
    peakDb: output.metrics.mixedPeakDb,
    voicePeakDb: output.metrics.voicePeakDb,
    musicDuckLevel: output.metrics.musicPeakDb,
    durationDiffPercent:
      input.targetDurationSec > 0
        ? (Math.abs(output.metrics.durationSec - input.targetDurationSec) /
            input.targetDurationSec) *
          100
        : 100,
  };

  return {
    status,
    checks,
    flags,
    metrics,
  };
}

// -----------------------------------------------------------------------------
// Individual Check Functions
// -----------------------------------------------------------------------------

/**
 * Check that output duration matches target within 1%.
 * CRITICAL severity - FAIL if mismatch.
 */
function checkDurationMatch(
  output: AudioMixerOutput,
  input: AudioMixerInput
): AudioQualityCheckResult {
  if (input.targetDurationSec <= 0) {
    return {
      passed: false,
      severity: 'CRITICAL',
      code: AUDIO_MIXER_ERROR_CODES.DURATION_MISMATCH,
      message: `Invalid target duration: ${input.targetDurationSec}s (must be positive)`,
      actualValue: input.targetDurationSec,
      threshold: AUDIO_MIXER_QUALITY_THRESHOLDS.DURATION_MATCH_PERCENT,
    };
  }

  const diffPercent =
    (Math.abs(output.metrics.durationSec - input.targetDurationSec) /
      input.targetDurationSec) *
    100;
  const passed = diffPercent <= AUDIO_MIXER_QUALITY_THRESHOLDS.DURATION_MATCH_PERCENT;

  return {
    passed,
    severity: passed ? undefined : 'CRITICAL',
    code: passed ? undefined : AUDIO_MIXER_ERROR_CODES.DURATION_MISMATCH,
    message: passed
      ? `Duration match: ${diffPercent.toFixed(2)}% difference`
      : `Duration mismatch: ${diffPercent.toFixed(2)}% > ${AUDIO_MIXER_QUALITY_THRESHOLDS.DURATION_MATCH_PERCENT}% threshold`,
    actualValue: diffPercent,
    threshold: AUDIO_MIXER_QUALITY_THRESHOLDS.DURATION_MATCH_PERCENT,
  };
}

/**
 * Check that mixed audio peak is below clipping threshold.
 * DEGRADED severity - headroom check at -0.5 dB.
 */
function checkNoClipping(output: AudioMixerOutput): AudioQualityCheckResult {
  const passed = output.metrics.mixedPeakDb < AUDIO_MIXER_QUALITY_THRESHOLDS.MAX_PEAK_DB;

  return {
    passed,
    severity: passed ? undefined : 'DEGRADED',
    code: passed ? undefined : AUDIO_MIXER_ERROR_CODES.CLIPPING_DETECTED,
    message: passed
      ? `No clipping: peak ${output.metrics.mixedPeakDb} dB (headroom OK)`
      : `Clipping detected: peak ${output.metrics.mixedPeakDb} dB >= ${AUDIO_MIXER_QUALITY_THRESHOLDS.MAX_PEAK_DB} dB threshold`,
    actualValue: output.metrics.mixedPeakDb,
    threshold: AUDIO_MIXER_QUALITY_THRESHOLDS.MAX_PEAK_DB,
  };
}

/**
 * Check that voice peak levels are within acceptable range.
 * DEGRADED severity - voice should be between -9 dB and -3 dB.
 */
function checkVoiceLevels(output: AudioMixerOutput): AudioQualityCheckResult {
  const voicePeak = output.metrics.voicePeakDb;
  const passed =
    voicePeak >= AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MIN_DB &&
    voicePeak <= AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MAX_DB;

  return {
    passed,
    severity: passed ? undefined : 'DEGRADED',
    code: passed ? undefined : AUDIO_MIXER_ERROR_CODES.VOICE_LEVEL_OUT_OF_RANGE,
    message: passed
      ? `Voice levels OK: ${voicePeak} dB (within ${AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MIN_DB} to ${AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MAX_DB} dB)`
      : `Voice level out of range: ${voicePeak} dB (expected ${AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MIN_DB} to ${AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MAX_DB} dB)`,
    actualValue: voicePeak,
    threshold: voicePeak < AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MIN_DB
      ? AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MIN_DB
      : AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MAX_DB,
  };
}

/**
 * Check that music is adequately ducked during speech.
 * DEGRADED severity - music peak should be < -18 dB.
 * Only checked when duckingApplied is true.
 */
function checkMusicDucking(output: AudioMixerOutput): AudioQualityCheckResult {
  if (!output.duckingApplied) {
    return {
      passed: true,
      message: 'Music ducking check skipped (ducking not applied)',
      actualValue: output.metrics.musicPeakDb,
      threshold: AUDIO_MIXER_QUALITY_THRESHOLDS.MUSIC_DUCK_MAX_DB,
    };
  }

  const passed = output.metrics.musicPeakDb < AUDIO_MIXER_QUALITY_THRESHOLDS.MUSIC_DUCK_MAX_DB;

  return {
    passed,
    severity: passed ? undefined : 'DEGRADED',
    code: passed ? undefined : AUDIO_MIXER_ERROR_CODES.MUSIC_DUCK_INSUFFICIENT,
    message: passed
      ? `Music ducking OK: ${output.metrics.musicPeakDb} dB (< ${AUDIO_MIXER_QUALITY_THRESHOLDS.MUSIC_DUCK_MAX_DB} dB)`
      : `Insufficient music ducking: ${output.metrics.musicPeakDb} dB >= ${AUDIO_MIXER_QUALITY_THRESHOLDS.MUSIC_DUCK_MAX_DB} dB threshold`,
    actualValue: output.metrics.musicPeakDb,
    threshold: AUDIO_MIXER_QUALITY_THRESHOLDS.MUSIC_DUCK_MAX_DB,
  };
}
