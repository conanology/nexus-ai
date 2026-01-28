import { NexusError } from '@nexus-ai/core';

export function loadMusicLibrary(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'loadMusicLibrary not yet implemented',
    'audio-mixer'
  );
}

export function selectMusic(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'selectMusic not yet implemented',
    'audio-mixer'
  );
}

export function prepareLoopedTrack(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'prepareLoopedTrack not yet implemented',
    'audio-mixer'
  );
}
