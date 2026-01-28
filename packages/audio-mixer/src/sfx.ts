import { NexusError } from '@nexus-ai/core';

export function loadSFXLibrary(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'loadSFXLibrary not yet implemented',
    'audio-mixer'
  );
}

export function getSFX(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'getSFX not yet implemented',
    'audio-mixer'
  );
}

export function extractSFXTriggers(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'extractSFXTriggers not yet implemented',
    'audio-mixer'
  );
}
