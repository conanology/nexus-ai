import { NexusError, logger } from '@nexus-ai/core';
import type { DirectionSegment } from '@nexus-ai/script-gen';
import type { SfxLibrary, SfxTrack, SFXTriggerResolved } from './types.js';

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

const log = logger.child({ module: 'nexus.audio-mixer.sfx' });

/**
 * Extract and resolve SFX triggers from direction document segments.
 * Resolves sound IDs to SfxTrack entries with GCS paths and timing.
 */
export function extractSFXTriggers(
  segments: DirectionSegment[],
  sfxLibrary: SfxLibrary
): SFXTriggerResolved[] {
  const resolved: SFXTriggerResolved[] = [];

  for (const segment of segments) {
    const sfxCues = segment.audio?.sfxCues;
    if (!sfxCues || sfxCues.length === 0) {
      continue;
    }

    for (const cue of sfxCues) {
      const track = getSFX(cue.sound, sfxLibrary);
      if (!track) {
        log.warn(
          { soundId: cue.sound, segmentId: segment.id },
          'SFX sound not found in library, skipping'
        );
        continue;
      }

      const timeSec = resolveTriggerTime(cue.trigger, cue.triggerValue, segment);
      if (timeSec === null) {
        log.warn(
          { trigger: cue.trigger, triggerValue: cue.triggerValue, segmentId: segment.id },
          'Could not resolve SFX trigger time, skipping'
        );
        continue;
      }

      resolved.push({
        segmentId: segment.id,
        timeSec,
        soundId: cue.sound,
        gcsPath: track.gcsPath,
        volume: cue.volume,
        durationSec: track.durationSec,
      });
    }
  }

  // Sort by time
  resolved.sort((a, b) => a.timeSec - b.timeSec);
  return resolved;
}

/**
 * Resolve a trigger type + value to a time offset in seconds.
 * Returns null if the trigger cannot be resolved.
 */
function resolveTriggerTime(
  trigger: string,
  triggerValue: string | undefined,
  segment: DirectionSegment
): number | null {
  const timing = segment.timing;

  switch (trigger) {
    case 'segment_start': {
      return timing.actualStartSec ?? timing.estimatedStartSec ?? null;
    }
    case 'segment_end': {
      return timing.actualEndSec ?? timing.estimatedEndSec ?? null;
    }
    case 'timestamp': {
      if (triggerValue === undefined) {
        return null;
      }
      const parsed = parseFloat(triggerValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case 'word': {
      // Attempt word-level timing lookup
      if (triggerValue && timing.wordTimings) {
        const wordTiming = timing.wordTimings.find(
          (wt) => wt.word.toLowerCase() === triggerValue.toLowerCase()
        );
        if (wordTiming) {
          return wordTiming.startTime;
        }
      }
      log.warn(
        { trigger, triggerValue, segmentId: segment.id },
        'Word trigger could not be resolved - word timings unavailable or word not found'
      );
      return null;
    }
    default:
      return null;
  }
}
