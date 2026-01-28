import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import ffmpegPath from 'ffmpeg-static';
import { NexusError } from '@nexus-ai/core';
import type { SpeechSegment, GainPoint, DuckingConfig } from './types.js';

const execFileAsync = promisify(execFile);

export const DEFAULT_DUCKING_CONFIG: DuckingConfig = {
  speechLevel: -20,
  silenceLevel: -12,
  attackMs: 50,
  releaseMs: 300,
};

/**
 * Detect speech segments in an audio file using ffmpeg silencedetect.
 * Converts to 16kHz mono WAV, detects silence, then inverts to speech segments.
 * Merges adjacent speech segments closer than 200ms apart.
 */
export async function detectSpeechSegments(
  audioPath: string
): Promise<SpeechSegment[]> {
  if (!ffmpegPath) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_VAD_FAILED',
      'ffmpeg-static binary path not found',
      'audio-mixer'
    );
  }

  const tempWav = join(tmpdir(), `nexus-vad-${randomUUID()}.wav`);

  try {
    // Convert to 16kHz mono WAV
    await execFileAsync(ffmpegPath, [
      '-i', audioPath,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      '-y',
      tempWav,
    ]);

    // Run silencedetect on the converted file
    // noise=-30dB: threshold for silence detection
    // d=0.3: minimum silence duration (300ms)
    const { stderr } = await execFileAsync(ffmpegPath, [
      '-i', tempWav,
      '-af', 'silencedetect=noise=-30dB:d=0.3',
      '-f', 'null',
      '-',
    ]);

    // Get audio duration from the conversion output
    const duration = await getAudioDuration(tempWav);

    // Parse silence periods from ffmpeg stderr output
    const silencePeriods = parseSilenceDetectOutput(stderr, duration);

    // Invert silence periods to get speech segments
    const speechSegments = invertToSpeech(silencePeriods, duration);

    // Merge adjacent segments closer than 200ms
    return mergeAdjacentSegments(speechSegments, 0.2);
  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_VAD_FAILED',
      `Voice activity detection failed: ${error instanceof Error ? error.message : String(error)}`,
      'audio-mixer',
      { audioPath }
    );
  } finally {
    // Clean up temp file
    try {
      await unlink(tempWav);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get audio duration in seconds using ffprobe-like approach via ffmpeg.
 */
async function getAudioDuration(filePath: string): Promise<number> {
  const { stderr } = await execFileAsync(ffmpegPath!, [
    '-i', filePath,
    '-f', 'null',
    '-',
  ]);

  // Parse duration from ffmpeg output: "Duration: HH:MM:SS.ss"
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
  if (!match) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_VAD_FAILED',
      'Could not determine audio duration from ffmpeg output',
      'audio-mixer'
    );
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const fractional = parseFloat(`0.${match[4]}`);

  return hours * 3600 + minutes * 60 + seconds + fractional;
}

interface SilencePeriod {
  start: number;
  end: number;
}

/**
 * Parse ffmpeg silencedetect output to extract silence periods.
 * ffmpeg outputs lines like:
 *   [silencedetect @ 0x...] silence_start: 1.234
 *   [silencedetect @ 0x...] silence_end: 2.567 | silence_duration: 1.333
 */
function parseSilenceDetectOutput(
  stderr: string,
  totalDuration: number
): SilencePeriod[] {
  const periods: SilencePeriod[] = [];
  const lines = stderr.split('\n');

  let currentStart: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) {
      currentStart = parseFloat(startMatch[1]);
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && currentStart !== null) {
      periods.push({
        start: currentStart,
        end: parseFloat(endMatch[1]),
      });
      currentStart = null;
    }
  }

  // Handle trailing silence_start without matching silence_end
  // (audio ends during a silence period)
  if (currentStart !== null && totalDuration > currentStart) {
    periods.push({
      start: currentStart,
      end: totalDuration,
    });
  }

  return periods;
}

/**
 * Invert silence periods to speech segments.
 * If the audio starts with speech (no silence at t=0), the first segment starts at 0.
 * If the audio ends with speech (no silence at end), the last segment ends at duration.
 */
function invertToSpeech(
  silencePeriods: SilencePeriod[],
  totalDuration: number
): SpeechSegment[] {
  if (silencePeriods.length === 0) {
    // No silence detected - entire audio is speech (or empty)
    if (totalDuration <= 0) {
      return [];
    }
    return [{ startSec: 0, endSec: totalDuration }];
  }

  const segments: SpeechSegment[] = [];

  // Speech before first silence
  if (silencePeriods[0].start > 0) {
    segments.push({
      startSec: 0,
      endSec: silencePeriods[0].start,
    });
  }

  // Speech between silence periods
  for (let i = 0; i < silencePeriods.length - 1; i++) {
    const gapStart = silencePeriods[i].end;
    const gapEnd = silencePeriods[i + 1].start;
    if (gapEnd > gapStart) {
      segments.push({
        startSec: gapStart,
        endSec: gapEnd,
      });
    }
  }

  // Speech after last silence
  const lastSilence = silencePeriods[silencePeriods.length - 1];
  if (lastSilence.end < totalDuration) {
    segments.push({
      startSec: lastSilence.end,
      endSec: totalDuration,
    });
  }

  return segments;
}

/**
 * Merge speech segments that are closer than mergeThresholdSec apart.
 */
function mergeAdjacentSegments(
  segments: SpeechSegment[],
  mergeThresholdSec: number
): SpeechSegment[] {
  if (segments.length <= 1) {
    return segments;
  }

  const merged: SpeechSegment[] = [{ ...segments[0] }];

  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    const current = segments[i];

    if (current.startSec - last.endSec < mergeThresholdSec) {
      // Merge: extend the previous segment
      last.endSec = current.endSec;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Generate a ducking gain curve based on speech segments.
 * Music ducks to speechLevel during speech and returns to silenceLevel during silence.
 * Attack uses exponential shape, release uses linear shape.
 */
export function generateDuckingCurve(
  speechSegments: SpeechSegment[],
  config: DuckingConfig,
  totalDurationSec: number
): GainPoint[] {
  const {
    speechLevel,
    silenceLevel,
    attackMs,
    releaseMs,
  } = config;

  const attackSec = attackMs / 1000;
  const releaseSec = releaseMs / 1000;

  // Empty segments → flat curve at silenceLevel
  if (speechSegments.length === 0) {
    return [
      { timeSec: 0, gainDb: silenceLevel },
      { timeSec: totalDurationSec, gainDb: silenceLevel },
    ];
  }

  const points: GainPoint[] = [];

  // Initial point at silence level
  points.push({ timeSec: 0, gainDb: silenceLevel });

  for (const segment of speechSegments) {
    const attackStart = Math.max(0, segment.startSec - attackSec);
    const releaseEnd = Math.min(totalDurationSec, segment.endSec + releaseSec);

    // Attack start: begin transition from silenceLevel
    if (attackStart > 0) {
      points.push({ timeSec: attackStart, gainDb: silenceLevel });
    }

    // Attack end / speech start: reach speechLevel
    points.push({ timeSec: segment.startSec, gainDb: speechLevel });

    // Speech end: still at speechLevel, begin release
    points.push({ timeSec: segment.endSec, gainDb: speechLevel });

    // Release end: return to silenceLevel
    points.push({ timeSec: releaseEnd, gainDb: silenceLevel });
  }

  // Final point at silence level
  if (points[points.length - 1].timeSec < totalDurationSec) {
    points.push({ timeSec: totalDurationSec, gainDb: silenceLevel });
  }

  // Sort by time and deduplicate overlapping regions
  return deduplicatePoints(points.sort((a, b) => a.timeSec - b.timeSec));
}

/**
 * Remove duplicate time points, keeping the lower (more ducked) gain value
 * for overlapping envelope regions.
 */
function deduplicatePoints(points: GainPoint[]): GainPoint[] {
  if (points.length <= 1) {
    return points;
  }

  const result: GainPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1];
    if (Math.abs(points[i].timeSec - last.timeSec) < 0.0001) {
      // Same time: keep the lower gain (more ducking)
      last.gainDb = Math.min(last.gainDb, points[i].gainDb);
    } else {
      result.push(points[i]);
    }
  }

  return result;
}
