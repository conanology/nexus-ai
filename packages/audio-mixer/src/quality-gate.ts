import { NexusError } from '@nexus-ai/core';

export function validateAudioMix(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'validateAudioMix not yet implemented',
    'audio-mixer'
  );
}
