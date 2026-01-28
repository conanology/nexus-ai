import { describe, it, expect } from 'vitest';
import { NexusError } from '@nexus-ai/core';
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
  describe('quality-gate.ts stubs', () => {
    it('validateAudioMix throws NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED', () => {
      expectNotImplementedError(validateAudioMix);
    });
  });
});
