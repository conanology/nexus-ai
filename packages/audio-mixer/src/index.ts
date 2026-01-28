// Types
export type {
  MoodType,
  LicenseInfo,
  MusicTrack,
  MusicLibrary,
  MusicSelectionCriteria,
  SFXTrigger,
  SFXTriggerResolved,
  DuckingConfig,
  SpeechSegment,
  GainPoint,
  AudioMixerMetrics,
  AudioMixerInput,
  AudioMixerOutput,
  SfxCategory,
  SfxTrack,
  SfxLibrary,
  AudioMixerQualityResult,
  AudioQualityCheckResult,
  AudioMixerQualityMetrics,
} from './types.js';

export {
  AUDIO_MIXER_ERROR_CODES,
  AUDIO_MIXER_QUALITY_THRESHOLDS,
} from './types.js';

// Ducking
export { detectSpeechSegments, generateDuckingCurve, DEFAULT_DUCKING_CONFIG } from './ducking.js';

// Music selector
export { loadMusicLibrary, selectMusic, prepareLoopedTrack, clearMusicLibraryCache } from './music-selector.js';

// SFX
export { loadSFXLibrary, getSFX, extractSFXTriggers, clearSFXLibraryCache } from './sfx.js';

// Mix pipeline
export { mixAudio, buildFilterComplex } from './mix-pipeline.js';

// Quality gate
export { validateAudioMix } from './quality-gate.js';
