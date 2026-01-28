// Types
export type {
  MoodType,
  LicenseInfo,
  MusicTrack,
  MusicLibrary,
  MusicSelectionCriteria,
  SFXTrigger,
  DuckingConfig,
  SpeechSegment,
  GainPoint,
  AudioMixerMetrics,
  AudioMixerInput,
  AudioMixerOutput,
  SfxCategory,
  SfxTrack,
  SfxLibrary,
} from './types.js';

// Ducking
export { detectSpeechSegments, generateDuckingCurve, DEFAULT_DUCKING_CONFIG } from './ducking.js';

// Music selector
export { loadMusicLibrary, selectMusic, prepareLoopedTrack, clearMusicLibraryCache } from './music-selector.js';

// SFX
export { loadSFXLibrary, getSFX, extractSFXTriggers, clearSFXLibraryCache } from './sfx.js';

// Quality gate stub
export { validateAudioMix } from './quality-gate.js';
