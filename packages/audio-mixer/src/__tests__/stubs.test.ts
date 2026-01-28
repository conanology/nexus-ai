import { describe, it, expect } from 'vitest';
import { NexusError } from '@nexus-ai/core';
import { detectSpeechSegments, generateDuckingCurve } from '../ducking.js';
import { loadMusicLibrary, selectMusic, prepareLoopedTrack } from '../music-selector.js';
import { loadSFXLibrary, getSFX, extractSFXTriggers } from '../sfx.js';
import { validateAudioMix } from '../quality-gate.js';

function expectNotImplementedError(fn: () => never): void {
  try {
    fn();
    expect.unreachable('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(NexusError);
    expect((error as NexusError).code).toBe('NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED');
    expect((error as NexusError).stage).toBe('audio-mixer');
  }
}

describe('Audio Mixer Stub Implementations', () => {
  describe('ducking.ts stubs', () => {
    it('detectSpeechSegments throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(detectSpeechSegments);
    });

    it('generateDuckingCurve throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(generateDuckingCurve);
    });
  });

  describe('music-selector.ts stubs', () => {
    it('loadMusicLibrary throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(loadMusicLibrary);
    });

    it('selectMusic throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(selectMusic);
    });

    it('prepareLoopedTrack throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(prepareLoopedTrack);
    });
  });

  describe('sfx.ts stubs', () => {
    it('loadSFXLibrary throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(loadSFXLibrary);
    });

    it('getSFX throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(getSFX);
    });

    it('extractSFXTriggers throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(extractSFXTriggers);
    });
  });

  describe('quality-gate.ts stubs', () => {
    it('validateAudioMix throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(validateAudioMix);
    });
  });
});
