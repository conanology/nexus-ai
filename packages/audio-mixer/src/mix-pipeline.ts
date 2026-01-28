import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import ffmpegPath from 'ffmpeg-static';
import {
  NexusError,
  logger,
  executeStage,
  type StageInput,
  type StageOutput,
  type StageConfig,
} from '@nexus-ai/core';
import type { AudioMixerInput, AudioMixerOutput, GainPoint, MoodType, SFXTriggerResolved } from './types.js';
import { detectSpeechSegments, generateDuckingCurve, DEFAULT_DUCKING_CONFIG } from './ducking.js';
import { loadMusicLibrary, selectMusic, prepareLoopedTrack } from './music-selector.js';
import { loadSFXLibrary, extractSFXTriggers } from './sfx.js';
import { downloadFromGCS, uploadToGCS } from './gcs-helpers.js';

const execFileAsync = promisify(execFile);
const log = logger.child({ module: 'nexus.audio-mixer.mix-pipeline' });

/**
 * Build the FFmpeg filter_complex string for mixing voice, music (with ducking), and SFX.
 */
export function buildFilterComplex(
  duckingCurve: GainPoint[],
  sfxTriggers: SFXTriggerResolved[],
  totalInputs: number
): string {
  const filters: string[] = [];
  const mixInputLabels: string[] = [];

  // Input 0: voice - pass through
  filters.push('[0:a]acopy[voice]');
  mixInputLabels.push('[voice]');

  // Input 1: music with ducking volume envelope
  if (totalInputs > 1) {
    const volumeExpr = buildVolumeExpression(duckingCurve);
    filters.push(`[1:a]volume='${volumeExpr}':eval=frame[music]`);
    mixInputLabels.push('[music]');
  }

  // Inputs 2+: SFX with delay and volume
  for (let i = 0; i < sfxTriggers.length; i++) {
    const inputIdx = i + 2;
    if (inputIdx >= totalInputs) break;

    const trigger = sfxTriggers[i];
    const delayMs = Math.round(trigger.timeSec * 1000);
    filters.push(
      `[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${trigger.volume.toFixed(2)}[sfx${i}]`
    );
    mixInputLabels.push(`[sfx${i}]`);
  }

  // Mix all streams
  const mixCount = mixInputLabels.length;
  if (mixCount > 1) {
    filters.push(
      `${mixInputLabels.join('')}amix=inputs=${mixCount}:duration=longest:dropout_transition=2[mixed]`
    );
    // Normalize: target voice peaks at -6dB
    filters.push('[mixed]loudnorm=I=-16:TP=-6:LRA=11[out]');
  } else {
    // Only voice, just normalize
    filters.push('[voice]loudnorm=I=-16:TP=-6:LRA=11[out]');
  }

  return filters.join(';');
}

/**
 * Convert GainPoint[] ducking curve to an FFmpeg volume expression.
 * Uses linear interpolation between gain points.
 */
function buildVolumeExpression(duckingCurve: GainPoint[]): string {
  if (duckingCurve.length === 0) {
    return '1';
  }

  if (duckingCurve.length === 1) {
    return dbToLinear(duckingCurve[0].gainDb).toFixed(4);
  }

  // Build piecewise expression using enable/volume segments
  // FFmpeg volume filter expression: use if() with between() for each segment
  const parts: string[] = [];

  for (let i = 0; i < duckingCurve.length - 1; i++) {
    const p0 = duckingCurve[i];
    const p1 = duckingCurve[i + 1];

    const v0 = dbToLinear(p0.gainDb);
    const v1 = dbToLinear(p1.gainDb);

    if (Math.abs(v0 - v1) < 0.001) {
      // Constant gain segment
      parts.push(`if(between(t,${p0.timeSec.toFixed(3)},${p1.timeSec.toFixed(3)}),${v0.toFixed(4)}`);
    } else {
      // Linear interpolation
      const dt = p1.timeSec - p0.timeSec;
      const slope = (v1 - v0) / (dt || 1);
      parts.push(
        `if(between(t,${p0.timeSec.toFixed(3)},${p1.timeSec.toFixed(3)}),${v0.toFixed(4)}+${slope.toFixed(6)}*(t-${p0.timeSec.toFixed(3)})`
      );
    }
  }

  // Close all if() calls and add default fallback
  const expr = parts.join(',') + ',1' + ')'.repeat(parts.length);
  return expr;
}

/**
 * Convert dB to linear gain.
 */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Execute the full audio mix pipeline.
 */
async function executeMixPipeline(
  data: AudioMixerInput,
  _config: StageConfig,
  pipelineId?: string
): Promise<AudioMixerOutput> {
  if (!ffmpegPath) {
    throw NexusError.critical(
      'NEXUS_AUDIO_MIXER_MIX_FAILED',
      'ffmpeg-static binary path not found',
      'audio-mixer'
    );
  }

  const tempFiles: string[] = [];

  try {
    // 1. Download voice track
    const voicePath = join(tmpdir(), `nexus-voice-${randomUUID()}.wav`);
    tempFiles.push(voicePath);
    await downloadFromGCS(data.voiceTrackUrl, voicePath);
    log.info({ voicePath }, 'Voice track downloaded');

    // 2. Select and prepare music
    const mood = data.directionDocument.globalAudio.defaultMood as MoodType;
    const musicLibrary = await loadMusicLibrary();
    const musicTrack = selectMusic(
      { mood, minDurationSec: data.targetDurationSec },
      musicLibrary
    );

    let musicPath: string | null = null;
    if (musicTrack) {
      const prepared = await prepareLoopedTrack(musicTrack, data.targetDurationSec);
      // If prepareLoopedTrack returns a GCS path, download it
      if (prepared.startsWith('gs://') || prepared.startsWith('https://')) {
        musicPath = join(tmpdir(), `nexus-music-${randomUUID()}.wav`);
        tempFiles.push(musicPath);
        await downloadFromGCS(prepared, musicPath);
      } else {
        musicPath = prepared;
        tempFiles.push(musicPath);
      }
      log.info({ musicPath, trackId: musicTrack.id }, 'Music track prepared');
    }

    // 3. Detect speech segments via VAD
    const speechSegments = await detectSpeechSegments(voicePath);
    log.info({ segmentCount: speechSegments.length }, 'Speech segments detected');

    // 4. Generate ducking curve
    const duckingCurve = generateDuckingCurve(
      speechSegments,
      DEFAULT_DUCKING_CONFIG,
      data.targetDurationSec
    );
    const duckingApplied = speechSegments.length > 0 && musicPath !== null;

    // 5. Extract SFX triggers
    const sfxLibrary = await loadSFXLibrary();
    const sfxTriggers = extractSFXTriggers(data.directionDocument.segments, sfxLibrary);
    log.info({ sfxCount: sfxTriggers.length }, 'SFX triggers resolved');

    // 6. Download SFX files (track trigger+path pairs to avoid misalignment on partial failure)
    const activeSfx: { trigger: SFXTriggerResolved; path: string }[] = [];
    for (const trigger of sfxTriggers) {
      const sfxPath = join(tmpdir(), `nexus-sfx-${randomUUID()}.wav`);
      tempFiles.push(sfxPath);
      try {
        await downloadFromGCS(trigger.gcsPath, sfxPath);
        activeSfx.push({ trigger, path: sfxPath });
      } catch (err) {
        log.warn(
          { soundId: trigger.soundId, error: err instanceof Error ? err.message : String(err) },
          'Failed to download SFX file, skipping'
        );
      }
    }

    const activeSfxTriggers = activeSfx.map((s) => s.trigger);
    const sfxPaths = activeSfx.map((s) => s.path);

    // 7. Build FFmpeg command
    const outputPath = join(tmpdir(), `nexus-mixed-${randomUUID()}.wav`);
    tempFiles.push(outputPath);

    const inputArgs: string[] = ['-i', voicePath];
    let totalInputs = 1;

    if (musicPath) {
      inputArgs.push('-i', musicPath);
      totalInputs++;
    }

    for (const sfxPath of sfxPaths) {
      inputArgs.push('-i', sfxPath);
      totalInputs++;
    }

    const filterComplex = buildFilterComplex(
      duckingApplied ? duckingCurve : [],
      musicPath ? activeSfxTriggers : [],
      totalInputs
    );

    const ffmpegArgs = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-ar', '44100',
      '-ac', '2',
      '-f', 'wav',
      '-y',
      outputPath,
    ];

    log.info({ filterComplex, inputCount: totalInputs }, 'Running FFmpeg mix');
    await execFileAsync(ffmpegPath, ffmpegArgs);
    log.info({ outputPath }, 'FFmpeg mix complete');

    // 8. Upload mixed audio to GCS
    const effectivePipelineId = pipelineId ?? new Date().toISOString().slice(0, 10);
    const gcsOutputUrl = `gs://nexus-ai-artifacts/${effectivePipelineId}/audio-mixer/mixed.wav`;
    const mixedAudioUrl = await uploadToGCS(outputPath, gcsOutputUrl);

    // 9. Build output
    // Note: peak dB values are estimates based on loudnorm target settings, not measured from output.
    // Actual measurement would require a second FFmpeg analysis pass on the mixed file.
    const output: AudioMixerOutput = {
      mixedAudioUrl,
      originalAudioUrl: data.voiceTrackUrl,
      duckingApplied,
      metrics: {
        voicePeakDb: -6,
        musicPeakDb: musicPath ? DEFAULT_DUCKING_CONFIG.silenceLevel : 0,
        mixedPeakDb: -6,
        duckingSegments: speechSegments.length,
        sfxTriggered: sfxPaths.length,
        durationSec: data.targetDurationSec,
      },
    };

    return output;
  } finally {
    // Clean up all temp files
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Execute the audio mix stage with executeStage wrapper.
 * Orchestrates voice + music (ducking) + SFX mixing via FFmpeg.
 */
export async function mixAudio(
  input: StageInput<AudioMixerInput>
): Promise<StageOutput<AudioMixerOutput>> {
  const pipelineId = input.pipelineId;
  return executeStage<AudioMixerInput, AudioMixerOutput>(
    input,
    'audio-mixer',
    (data, config) => executeMixPipeline(data, config, pipelineId)
  );
}
