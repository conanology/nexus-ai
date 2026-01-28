import { describe, it, expect } from 'vitest';
import type { DirectionDocument } from '@nexus-ai/script-gen';
import { validateAudioMix } from '../quality-gate.js';
import type { AudioMixerOutput, AudioMixerInput, AudioMixerMetrics } from '../types.js';
import {
  AUDIO_MIXER_ERROR_CODES,
  AUDIO_MIXER_QUALITY_THRESHOLDS,
} from '../types.js';

const DEFAULT_METRICS: AudioMixerMetrics = {
  voicePeakDb: -6,
  musicPeakDb: -20,
  mixedPeakDb: -6,
  duckingSegments: 5,
  sfxTriggered: 2,
  durationSec: 120,
};

function makeMetrics(overrides?: Partial<AudioMixerMetrics>): AudioMixerMetrics {
  return { ...DEFAULT_METRICS, ...overrides };
}

function makeOutput(overrides?: Partial<AudioMixerOutput>): AudioMixerOutput {
  return {
    mixedAudioUrl: 'https://storage.googleapis.com/nexus-ai-artifacts/2026-01-28/audio-mixer/mixed.wav',
    originalAudioUrl: 'https://storage.googleapis.com/nexus-ai-artifacts/2026-01-28/tts/voice.wav',
    duckingApplied: true,
    metrics: DEFAULT_METRICS,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<AudioMixerInput>): AudioMixerInput {
  return {
    voiceTrackUrl: 'gs://nexus-ai-artifacts/2026-01-28/tts/voice.wav',
    directionDocument: {} as DirectionDocument,
    targetDurationSec: 120,
    ...overrides,
  };
}

describe('validateAudioMix', () => {
  describe('PASS scenarios', () => {
    it('returns PASS when all checks pass with valid audio output', () => {
      const result = validateAudioMix(makeOutput(), makeInput());

      expect(result.status).toBe('PASS');
      expect(result.flags).toEqual([]);
      expect(result.checks.durationMatch.passed).toBe(true);
      expect(result.checks.noClipping.passed).toBe(true);
      expect(result.checks.voiceLevels.passed).toBe(true);
      expect(result.checks.musicDucking.passed).toBe(true);
    });

    it('returns PASS when music ducking check is skipped (duckingApplied=false)', () => {
      const result = validateAudioMix(
        makeOutput({ duckingApplied: false }),
        makeInput()
      );

      expect(result.status).toBe('PASS');
      expect(result.checks.musicDucking.passed).toBe(true);
      expect(result.checks.musicDucking.message).toContain('skipped');
    });
  });

  describe('FAIL scenarios', () => {
    it('returns FAIL for duration mismatch beyond 1% threshold (CRITICAL)', () => {
      const output = makeOutput({
        metrics: makeMetrics({ durationSec: 130 }), // ~8.3% off from 120
      });

      const result = validateAudioMix(output, makeInput());

      expect(result.status).toBe('FAIL');
      expect(result.checks.durationMatch.passed).toBe(false);
      expect(result.checks.durationMatch.severity).toBe('CRITICAL');
      expect(result.checks.durationMatch.code).toBe(AUDIO_MIXER_ERROR_CODES.DURATION_MISMATCH);
      expect(result.flags).toContain(AUDIO_MIXER_ERROR_CODES.DURATION_MISMATCH);
    });
  });

  describe('DEGRADED scenarios', () => {
    it('returns DEGRADED for clipping detected (peak >= -0.5dB)', () => {
      const output = makeOutput({
        metrics: makeMetrics({ mixedPeakDb: -0.3 }), // Above -0.5 threshold
      });

      const result = validateAudioMix(output, makeInput());

      expect(result.status).toBe('DEGRADED');
      expect(result.checks.noClipping.passed).toBe(false);
      expect(result.checks.noClipping.severity).toBe('DEGRADED');
      expect(result.checks.noClipping.code).toBe(AUDIO_MIXER_ERROR_CODES.CLIPPING_DETECTED);
      expect(result.flags).toContain(AUDIO_MIXER_ERROR_CODES.CLIPPING_DETECTED);
    });

    it('returns DEGRADED for voice levels below range', () => {
      const output = makeOutput({
        metrics: makeMetrics({ voicePeakDb: -12 }), // Below -9 dB min
      });

      const result = validateAudioMix(output, makeInput());

      expect(result.status).toBe('DEGRADED');
      expect(result.checks.voiceLevels.passed).toBe(false);
      expect(result.checks.voiceLevels.severity).toBe('DEGRADED');
      expect(result.checks.voiceLevels.code).toBe(AUDIO_MIXER_ERROR_CODES.VOICE_LEVEL_OUT_OF_RANGE);
    });

    it('returns DEGRADED for voice levels above range', () => {
      const output = makeOutput({
        metrics: makeMetrics({ voicePeakDb: -1 }), // Above -3 dB max
      });

      const result = validateAudioMix(output, makeInput());

      expect(result.status).toBe('DEGRADED');
      expect(result.checks.voiceLevels.passed).toBe(false);
      expect(result.checks.voiceLevels.code).toBe(AUDIO_MIXER_ERROR_CODES.VOICE_LEVEL_OUT_OF_RANGE);
    });

    it('returns DEGRADED for insufficient music ducking (>= -18dB during speech)', () => {
      const output = makeOutput({
        metrics: makeMetrics({ musicPeakDb: -15 }), // Above -18 dB threshold
      });

      const result = validateAudioMix(output, makeInput());

      expect(result.status).toBe('DEGRADED');
      expect(result.checks.musicDucking.passed).toBe(false);
      expect(result.checks.musicDucking.severity).toBe('DEGRADED');
      expect(result.checks.musicDucking.code).toBe(AUDIO_MIXER_ERROR_CODES.MUSIC_DUCK_INSUFFICIENT);
    });
  });

  describe('combined failures', () => {
    it('returns FAIL when CRITICAL overrides DEGRADED (multiple failures)', () => {
      const output = makeOutput({
        metrics: makeMetrics({
          voicePeakDb: -12, // DEGRADED: voice out of range
          musicPeakDb: -15, // DEGRADED: insufficient ducking
          mixedPeakDb: -0.3, // DEGRADED: clipping
          durationSec: 130, // CRITICAL: duration mismatch
        }),
      });

      const result = validateAudioMix(output, makeInput());

      expect(result.status).toBe('FAIL');
      expect(result.flags).toContain(AUDIO_MIXER_ERROR_CODES.DURATION_MISMATCH);
      expect(result.flags).toContain(AUDIO_MIXER_ERROR_CODES.CLIPPING_DETECTED);
      expect(result.flags).toContain(AUDIO_MIXER_ERROR_CODES.VOICE_LEVEL_OUT_OF_RANGE);
      expect(result.flags).toContain(AUDIO_MIXER_ERROR_CODES.MUSIC_DUCK_INSUFFICIENT);
      expect(result.flags).toHaveLength(4);
    });
  });

  describe('exact threshold boundaries', () => {
    it('PASS at just under 1% duration difference', () => {
      const output = makeOutput({
        metrics: makeMetrics({ durationSec: 121.19 }), // ~0.992%
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.durationMatch.passed).toBe(true);
    });

    it('FAIL at just over 1% duration difference', () => {
      const output = makeOutput({
        metrics: makeMetrics({ durationSec: 121.21 }), // ~1.008%
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.durationMatch.passed).toBe(false);
    });

    it('PASS at peak just below -0.5 dB threshold', () => {
      const output = makeOutput({
        metrics: makeMetrics({ mixedPeakDb: -0.51 }),
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.noClipping.passed).toBe(true);
    });

    it('DEGRADED at exactly -0.5 dB peak (not strictly less than)', () => {
      const output = makeOutput({
        metrics: makeMetrics({ mixedPeakDb: -0.5 }),
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.noClipping.passed).toBe(false);
    });

    it('PASS at voice level exactly -9 dB (lower bound inclusive)', () => {
      const output = makeOutput({
        metrics: makeMetrics({ voicePeakDb: -9 }),
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.voiceLevels.passed).toBe(true);
    });

    it('PASS at voice level exactly -3 dB (upper bound inclusive)', () => {
      const output = makeOutput({
        metrics: makeMetrics({ voicePeakDb: -3 }),
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.voiceLevels.passed).toBe(true);
    });

    it('PASS at music level just below -18 dB threshold', () => {
      const output = makeOutput({
        metrics: makeMetrics({ musicPeakDb: -18.01 }),
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.musicDucking.passed).toBe(true);
    });

    it('DEGRADED at music level exactly -18 dB (not strictly less than)', () => {
      const output = makeOutput({
        metrics: makeMetrics({ musicPeakDb: -18 }),
      });

      const result = validateAudioMix(output, makeInput());
      expect(result.checks.musicDucking.passed).toBe(false);
    });
  });

  describe('metrics calculation', () => {
    it('returns correct AudioMixerQualityMetrics', () => {
      const result = validateAudioMix(makeOutput(), makeInput());

      expect(result.metrics).toEqual({
        peakDb: -6,
        voicePeakDb: -6,
        musicDuckLevel: -20,
        durationDiffPercent: 0,
      });
    });

    it('calculates correct durationDiffPercent', () => {
      const output = makeOutput({
        metrics: makeMetrics({ durationSec: 119 }), // 1 sec shorter
      });

      const result = validateAudioMix(output, makeInput());

      // (|119 - 120| / 120) * 100 = 0.8333...%
      expect(result.metrics.durationDiffPercent).toBeCloseTo(0.8333, 3);
    });
  });

  describe('edge cases', () => {
    it('FAIL for duration shorter than target beyond 1% threshold', () => {
      const output = makeOutput({
        metrics: makeMetrics({ durationSec: 100 }), // 16.7% shorter than 120
      });

      const result = validateAudioMix(output, makeInput());

      expect(result.status).toBe('FAIL');
      expect(result.checks.durationMatch.passed).toBe(false);
      expect(result.checks.durationMatch.severity).toBe('CRITICAL');
    });

    it('FAIL for zero target duration (guards against division by zero)', () => {
      const result = validateAudioMix(makeOutput(), makeInput({ targetDurationSec: 0 }));

      expect(result.status).toBe('FAIL');
      expect(result.checks.durationMatch.passed).toBe(false);
      expect(result.checks.durationMatch.severity).toBe('CRITICAL');
      expect(result.checks.durationMatch.message).toContain('Invalid target duration');
    });

    it('FAIL for negative target duration', () => {
      const result = validateAudioMix(makeOutput(), makeInput({ targetDurationSec: -10 }));

      expect(result.status).toBe('FAIL');
      expect(result.checks.durationMatch.passed).toBe(false);
      expect(result.checks.durationMatch.severity).toBe('CRITICAL');
    });
  });

  describe('constants', () => {
    it('exports AUDIO_MIXER_ERROR_CODES with expected keys', () => {
      expect(AUDIO_MIXER_ERROR_CODES.DURATION_MISMATCH).toBe('DURATION_MISMATCH');
      expect(AUDIO_MIXER_ERROR_CODES.CLIPPING_DETECTED).toBe('CLIPPING_DETECTED');
      expect(AUDIO_MIXER_ERROR_CODES.VOICE_LEVEL_OUT_OF_RANGE).toBe('VOICE_LEVEL_OUT_OF_RANGE');
      expect(AUDIO_MIXER_ERROR_CODES.MUSIC_DUCK_INSUFFICIENT).toBe('MUSIC_DUCK_INSUFFICIENT');
    });

    it('exports AUDIO_MIXER_QUALITY_THRESHOLDS with expected values', () => {
      expect(AUDIO_MIXER_QUALITY_THRESHOLDS.DURATION_MATCH_PERCENT).toBe(1);
      expect(AUDIO_MIXER_QUALITY_THRESHOLDS.MAX_PEAK_DB).toBe(-0.5);
      expect(AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MIN_DB).toBe(-9);
      expect(AUDIO_MIXER_QUALITY_THRESHOLDS.VOICE_MAX_DB).toBe(-3);
      expect(AUDIO_MIXER_QUALITY_THRESHOLDS.MUSIC_DUCK_MAX_DB).toBe(-18);
    });
  });
});
