import type { DirectionDocument } from '@nexus-ai/script-gen';

export type MoodType = 'energetic' | 'contemplative' | 'urgent' | 'neutral';

export interface LicenseInfo {
  type: string;
  attribution: string;
  restrictions: string[];
}

export interface MusicTrack {
  id: string;
  mood: MoodType;
  tempo: number;
  duration: number;
  gcsPath: string;
  license: LicenseInfo;
  loopable: boolean;
  loopPoints?: { startSec: number; endSec: number };
  energy: number;
  tags: string[];
}

export interface MusicLibrary {
  tracks: MusicTrack[];
}

export interface MusicSelectionCriteria {
  mood: MoodType;
  minDurationSec: number;
  excludeTrackIds?: string[];
  targetEnergy?: number;
  tags?: string[];
}

export interface SFXTrigger {
  segmentId: string;
  frame: number;
  soundId: string;
  volume: number;
}

export type SfxCategory = 'transitions' | 'ui' | 'emphasis' | 'ambient';

export interface SfxTrack {
  id: string;
  filename: string;
  category: SfxCategory;
  durationSec: number;
  gcsPath: string;
  tags: string[];
}

export interface SfxLibrary {
  tracks: SfxTrack[];
}

export interface DuckingConfig {
  speechLevel: number;
  silenceLevel: number;
  attackMs: number;
  releaseMs: number;
}

/** Silence drop — full mute of music before high-impact scenes */
export interface SilenceDrop {
  /** Start time of the silence window (scene start - 1.0s) */
  timeSec: number;
  /** Duration of silence in seconds (1.0 for V3) */
  durationSec: number;
  /** Fade-back duration in milliseconds (300 for V3) */
  fadeBackMs: number;
}

export interface SpeechSegment {
  startSec: number;
  endSec: number;
}

export interface GainPoint {
  timeSec: number;
  gainDb: number;
}

export interface SFXTriggerResolved {
  segmentId: string;
  timeSec: number;
  soundId: string;
  gcsPath: string;
  volume: number;
  durationSec: number;
}

export interface AudioMixerMetrics {
  voicePeakDb: number;
  musicPeakDb: number;
  mixedPeakDb: number;
  duckingSegments: number;
  sfxTriggered: number;
  durationSec: number;
}

export interface AudioMixerInput {
  voiceTrackUrl: string;
  directionDocument: DirectionDocument;
  targetDurationSec: number;
  /** Pre-built silence drops for high-impact scenes (built by caller from Scene[] data) */
  silenceDrops?: SilenceDrop[];
}

export interface AudioMixerOutput {
  mixedAudioUrl: string;
  originalAudioUrl: string;
  duckingApplied: boolean;
  metrics: AudioMixerMetrics;
}

// Quality Gate Types

export interface AudioMixerQualityMetrics {
  peakDb: number;
  voicePeakDb: number;
  musicDuckLevel: number;
  durationDiffPercent: number;
}

export interface AudioQualityCheckResult {
  passed: boolean;
  severity?: 'CRITICAL' | 'DEGRADED';
  code?: string;
  message: string;
  actualValue: number;
  threshold: number;
}

export interface AudioMixerQualityResult {
  status: 'PASS' | 'DEGRADED' | 'FAIL';
  checks: Record<string, AudioQualityCheckResult>;
  flags: string[];
  metrics: AudioMixerQualityMetrics;
}

// Quality Gate Constants

export const AUDIO_MIXER_ERROR_CODES = {
  DURATION_MISMATCH: 'DURATION_MISMATCH',
  CLIPPING_DETECTED: 'CLIPPING_DETECTED',
  VOICE_LEVEL_OUT_OF_RANGE: 'VOICE_LEVEL_OUT_OF_RANGE',
  MUSIC_DUCK_INSUFFICIENT: 'MUSIC_DUCK_INSUFFICIENT',
} as const;

export const AUDIO_MIXER_QUALITY_THRESHOLDS = {
  DURATION_MATCH_PERCENT: 1,
  MAX_PEAK_DB: -0.5,
  VOICE_MIN_DB: -9,
  VOICE_MAX_DB: -3,
  MUSIC_DUCK_MAX_DB: -18,
} as const;
