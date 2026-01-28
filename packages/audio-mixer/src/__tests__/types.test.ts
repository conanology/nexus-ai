import { describe, it, expect } from 'vitest';
import type {
  MoodType,
  LicenseInfo,
  MusicTrack,
  SFXTrigger,
  DuckingConfig,
  SpeechSegment,
  GainPoint,
  AudioMixerMetrics,
  AudioMixerInput,
  AudioMixerOutput,
} from '../types.js';

describe('Audio Mixer Type Definitions', () => {
  it('should compile MoodType correctly', () => {
    const mood: MoodType = 'energetic';
    expect(mood).toBe('energetic');

    const moods: MoodType[] = ['energetic', 'contemplative', 'urgent', 'neutral'];
    expect(moods).toHaveLength(4);
  });

  it('should compile LicenseInfo correctly', () => {
    const license: LicenseInfo = {
      type: 'CC-BY-4.0',
      attribution: 'Artist Name',
      restrictions: ['no-commercial'],
    };
    expect(license.type).toBe('CC-BY-4.0');
    expect(license.attribution).toBe('Artist Name');
    expect(license.restrictions).toEqual(['no-commercial']);
  });

  it('should compile MusicTrack correctly', () => {
    const track: MusicTrack = {
      id: 'track-001',
      mood: 'energetic',
      tempo: 120,
      duration: 180,
      gcsPath: 'gs://bucket/music/track-001.wav',
      license: { type: 'CC-BY-4.0', attribution: 'Artist', restrictions: [] },
    };
    expect(track.id).toBe('track-001');
    expect(track.mood).toBe('energetic');
    expect(track.tempo).toBe(120);
    expect(track.duration).toBe(180);
    expect(track.gcsPath).toContain('gs://');
    expect(track.license.type).toBe('CC-BY-4.0');
  });

  it('should compile SFXTrigger correctly', () => {
    const trigger: SFXTrigger = {
      segmentId: 'seg-1',
      frame: 150,
      soundId: 'whoosh-01',
      volume: 0.8,
    };
    expect(trigger.segmentId).toBe('seg-1');
    expect(trigger.frame).toBe(150);
    expect(trigger.soundId).toBe('whoosh-01');
    expect(trigger.volume).toBe(0.8);
  });

  it('should compile DuckingConfig correctly', () => {
    const config: DuckingConfig = {
      speechLevel: -6,
      silenceLevel: -20,
      attackMs: 50,
      releaseMs: 200,
    };
    expect(config.speechLevel).toBe(-6);
    expect(config.silenceLevel).toBe(-20);
    expect(config.attackMs).toBe(50);
    expect(config.releaseMs).toBe(200);
  });

  it('should compile SpeechSegment correctly', () => {
    const segment: SpeechSegment = {
      startSec: 0.5,
      endSec: 3.2,
    };
    expect(segment.startSec).toBe(0.5);
    expect(segment.endSec).toBe(3.2);
  });

  it('should compile GainPoint correctly', () => {
    const point: GainPoint = {
      timeSec: 1.5,
      gainDb: -12,
    };
    expect(point.timeSec).toBe(1.5);
    expect(point.gainDb).toBe(-12);
  });

  it('should compile AudioMixerMetrics correctly', () => {
    const metrics: AudioMixerMetrics = {
      voicePeakDb: -3,
      musicPeakDb: -18,
      mixedPeakDb: -1,
      duckingSegments: 12,
      sfxTriggered: 5,
      durationSec: 120,
    };
    expect(metrics.voicePeakDb).toBe(-3);
    expect(metrics.musicPeakDb).toBe(-18);
    expect(metrics.mixedPeakDb).toBe(-1);
    expect(metrics.duckingSegments).toBe(12);
    expect(metrics.sfxTriggered).toBe(5);
    expect(metrics.durationSec).toBe(120);
  });

  it('should compile AudioMixerInput correctly', () => {
    const input: AudioMixerInput = {
      voiceTrackUrl: 'gs://bucket/voice.wav',
      directionDocument: {
        version: '2.0',
        metadata: {} as any,
        segments: [],
        globalAudio: {} as any,
      },
      targetDurationSec: 120,
    };
    expect(input.voiceTrackUrl).toContain('gs://');
    expect(input.directionDocument.version).toBe('2.0');
    expect(input.targetDurationSec).toBe(120);
  });

  it('should compile AudioMixerOutput correctly', () => {
    const output: AudioMixerOutput = {
      mixedAudioUrl: 'gs://bucket/mixed.wav',
      originalAudioUrl: 'gs://bucket/voice.wav',
      duckingApplied: true,
      metrics: {
        voicePeakDb: -3,
        musicPeakDb: -18,
        mixedPeakDb: -1,
        duckingSegments: 12,
        sfxTriggered: 5,
        durationSec: 120,
      },
    };
    expect(output.mixedAudioUrl).toContain('gs://');
    expect(output.originalAudioUrl).toContain('gs://');
    expect(output.duckingApplied).toBe(true);
    expect(output.metrics.duckingSegments).toBe(12);
  });
});
