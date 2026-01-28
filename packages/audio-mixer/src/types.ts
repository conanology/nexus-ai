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
}

export interface SFXTrigger {
  segmentId: string;
  frame: number;
  soundId: string;
  volume: number;
}

export interface DuckingConfig {
  speechLevel: number;
  silenceLevel: number;
  attackMs: number;
  releaseMs: number;
}

export interface SpeechSegment {
  startSec: number;
  endSec: number;
}

export interface GainPoint {
  timeSec: number;
  gainDb: number;
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
}

export interface AudioMixerOutput {
  mixedAudioUrl: string;
  originalAudioUrl: string;
  duckingApplied: boolean;
  metrics: AudioMixerMetrics;
}
