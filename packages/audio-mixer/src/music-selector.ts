import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import ffmpegPath from 'ffmpeg-static';
import { NexusError } from '@nexus-ai/core';
import type { MusicLibrary, MusicTrack, MusicSelectionCriteria } from './types.js';

const execFileAsync = promisify(execFile);

const DEFAULT_GCS_URL = 'https://storage.googleapis.com/nexus-ai-assets/music/library.json';

let cachedLibrary: MusicLibrary | null = null;

export async function loadMusicLibrary(gcsUrl?: string): Promise<MusicLibrary> {
  if (cachedLibrary) {
    return cachedLibrary;
  }

  const url = gcsUrl ?? DEFAULT_GCS_URL;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED',
      `Failed to fetch music library: ${error instanceof Error ? error.message : String(error)}`,
      'audio-mixer'
    );
  }

  if (!response.ok) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED',
      `Failed to load music library: ${response.status}`,
      'audio-mixer'
    );
  }

  const data = (await response.json()) as MusicLibrary;
  if (!data || !Array.isArray(data.tracks)) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_LIBRARY_LOAD_FAILED',
      'Invalid music library format: missing tracks array',
      'audio-mixer'
    );
  }
  cachedLibrary = data;
  return data;
}

export function clearMusicLibraryCache(): void {
  cachedLibrary = null;
}

export function selectMusic(
  criteria: MusicSelectionCriteria,
  library: MusicLibrary
): MusicTrack | null {
  const { mood, minDurationSec, excludeTrackIds, targetEnergy, tags } = criteria;

  // Filter by mood (exact match, required)
  let candidates = library.tracks.filter((track) => track.mood === mood);

  // Filter by duration (track.duration >= minDurationSec OR track.loopable)
  candidates = candidates.filter(
    (track) => track.duration >= minDurationSec || track.loopable
  );

  // Exclude recently used tracks
  if (excludeTrackIds && excludeTrackIds.length > 0) {
    const excludeSet = new Set(excludeTrackIds);
    candidates = candidates.filter((track) => !excludeSet.has(track.id));
  }

  if (candidates.length === 0) {
    return null;
  }

  // Score each candidate (0-3 scale)
  let bestTrack: MusicTrack | null = null;
  let bestScore = -1;

  for (const track of candidates) {
    // Duration fit: closer to target = higher (0-1), guard against zero division
    const durationFit = minDurationSec > 0
      ? 1 - Math.min(1, Math.abs(track.duration - minDurationSec) / minDurationSec)
      : 1;

    // Energy match (0-1, clamped)
    const energyMatch = targetEnergy !== undefined
      ? Math.max(0, 1 - Math.abs(track.energy - targetEnergy))
      : 0.5;

    // Tag overlap (0-1)
    let tagScore = 0.5;
    if (tags && tags.length > 0) {
      const trackTagSet = new Set(track.tags);
      const matchingTags = tags.filter((t) => trackTagSet.has(t)).length;
      tagScore = matchingTags / tags.length;
    }

    const totalScore = durationFit + energyMatch + tagScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestTrack = track;
    }
  }

  return bestTrack;
}

export async function prepareLoopedTrack(
  track: MusicTrack,
  targetDurationSec: number
): Promise<string> {
  // If track is long enough, return its path directly (GCS path or local path depending on source).
  // Note: Caller is responsible for downloading GCS paths if local file access is needed.
  if (track.duration >= targetDurationSec) {
    return track.gcsPath;
  }

  if (!ffmpegPath) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_LOOP_FAILED',
      'ffmpeg-static binary path not found',
      'audio-mixer'
    );
  }

  const outputPath = join(tmpdir(), `nexus-loop-${randomUUID()}.wav`);

  // Calculate loop parameters
  const loopStart = track.loopPoints?.startSec ?? 0;
  const loopEnd = track.loopPoints?.endSec ?? track.duration;
  const loopDuration = loopEnd - loopStart;

  if (loopDuration <= 0) {
    throw NexusError.critical(
      'NEXUS_AUDIO_MIXER_LOOP_FAILED',
      `Invalid loop points: start=${loopStart}, end=${loopEnd}`,
      'audio-mixer'
    );
  }

  const loopCount = Math.ceil(targetDurationSec / loopDuration);

  try {
    const args = [
      '-stream_loop', String(loopCount - 1),
      '-i', track.gcsPath,
      '-ss', String(loopStart),
      '-t', String(targetDurationSec),
      '-c', 'copy',
      outputPath,
    ];

    await execFileAsync(ffmpegPath, args);
    return outputPath;
  } catch (error) {
    // Clean up on error
    try {
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }

    if (error instanceof NexusError) {
      throw error;
    }

    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_LOOP_FAILED',
      `Failed to create looped track: ${error instanceof Error ? error.message : String(error)}`,
      'audio-mixer'
    );
  }
}
