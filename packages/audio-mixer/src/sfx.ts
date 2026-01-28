import { NexusError } from '@nexus-ai/core';
import type { SfxLibrary, SfxTrack } from './types.js';

const DEFAULT_SFX_LIBRARY_URL = 'https://storage.googleapis.com/nexus-ai-assets/sfx/library.json';
let sfxLibraryCache: SfxLibrary | null = null;

export async function loadSFXLibrary(gcsUrl?: string): Promise<SfxLibrary> {
  if (sfxLibraryCache) {
    return sfxLibraryCache;
  }

  const url = gcsUrl ?? DEFAULT_SFX_LIBRARY_URL;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_SFX_LOAD_FAILED',
      `Failed to fetch SFX library: ${error instanceof Error ? error.message : String(error)}`,
      'audio-mixer'
    );
  }

  if (!response.ok) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_SFX_LOAD_FAILED',
      `Failed to load SFX library: ${response.status}`,
      'audio-mixer'
    );
  }

  const data = (await response.json()) as SfxLibrary;
  if (!data || !Array.isArray(data.tracks)) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_SFX_LOAD_FAILED',
      'Invalid SFX library format: missing tracks array',
      'audio-mixer'
    );
  }

  sfxLibraryCache = data;
  return data;
}

export function clearSFXLibraryCache(): void {
  sfxLibraryCache = null;
}

export function getSFX(soundId: string, library: SfxLibrary): SfxTrack | undefined {
  return library.tracks.find((t) => t.id === soundId);
}

export function extractSFXTriggers(): never {
  throw NexusError.critical(
    'NEXUS_AUDIO_MIXER_NOT_IMPLEMENTED',
    'extractSFXTriggers not yet implemented',
    'audio-mixer'
  );
}
