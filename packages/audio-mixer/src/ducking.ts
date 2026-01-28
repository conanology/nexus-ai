import { NexusError } from '@nexus-ai/core';

export function detectSpeechSegments(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'detectSpeechSegments not yet implemented',
    'audio-mixer'
  );
}

export function generateDuckingCurve(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'generateDuckingCurve not yet implemented',
    'audio-mixer'
  );
}
