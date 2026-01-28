// Types
export type {
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
} from './types.js';

// Ducking stubs
export { detectSpeechSegments, generateDuckingCurve } from './ducking.js';

// Music selector stubs
export { loadMusicLibrary, selectMusic, prepareLoopedTrack } from './music-selector.js';

// SFX stubs
export { loadSFXLibrary, getSFX, extractSFXTriggers } from './sfx.js';

// Quality gate stub
export { validateAudioMix } from './quality-gate.js';
