/**
 * TTS synthesis stage implementation
 * @module @nexus-ai/tts
 */

import type { StageInput, StageOutput, TTSProvider, TTSOptions } from '@nexus-ai/core/types';
import { GeminiTTSProvider, ChirpProvider, WaveNetProvider } from '@nexus-ai/core/providers';
import { withRetry, withFallback, executeStage } from '@nexus-ai/core/utils';
import { createLogger } from '@nexus-ai/core/observability';
import { NexusError } from '@nexus-ai/core/errors';
import { CloudStorageClient } from '@nexus-ai/core/storage';
import type { TTSInput, TTSOutput, AudioSegment } from './types.js';
import { validateAudioQuality, stitchAudio } from './audio-quality.js';
import { chunkScript } from './chunker.js';

const logger = createLogger('nexus.tts');

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * TTS provider fallback chain
 * Primary: Gemini 2.5 Pro TTS (best quality)
 * Fallback1: Chirp 3 HD
 * Fallback2: WaveNet (last resort)
 */
const ttsProviders: TTSProvider[] = [
  new GeminiTTSProvider('gemini-2.5-pro-tts'),
  new ChirpProvider('chirp3-hd'),
  new WaveNetProvider(),
];

// =============================================================================
// Main Stage Function
// =============================================================================

/**
 * Execute TTS synthesis stage
 *
 * Converts SSML-tagged script to high-quality audio (44.1kHz WAV) with provider
 * fallback chain (Gemini 2.5 Pro TTS → Chirp 3 HD → WaveNet).
 *
 * **Stage responsibilities (AC2, AC6):**
 * - Take SSML-tagged script as input
 * - Use TTS provider with three-tier fallback chain
 * - Synthesize audio at 44.1kHz WAV format
 * - Upload to Cloud Storage at `{date}/tts/audio.wav`
 * - Run quality gate validation (silence, clipping, duration)
 * - Track costs via CostTracker
 * - Return StageOutput with audio artifact reference
 *
 * **Quality requirements (AC5):**
 * - Silence detection (<5% of total duration)
 * - Clipping detection (no samples at max amplitude)
 * - Duration validation (matches expected from word count)
 * - Returns DEGRADED status if checks fail
 *
 * @param input - Stage input with SSML-tagged script
 * @returns Stage output with audio artifact reference
 * @throws NexusError with appropriate severity on failure
 *
 * @example
 * ```typescript
 * const input: StageInput<TTSInput> = {
 *   pipelineId: '2026-01-08',
 *   previousStage: 'pronunciation',
 *   data: {
 *     ssmlScript: '<speak>Hello <phoneme alphabet="ipa" ph="wɜːld">world</phoneme></speak>',
 *   },
 *   config: { timeout: 300000, retries: 3 }
 * };
 *
 * const output = await executeTTS(input);
 * console.log(`Audio: ${output.data.audioUrl}`);
 * ```
 */
export async function executeTTS(
  input: StageInput<TTSInput>
): Promise<StageOutput<TTSOutput>> {
  return executeStage(input, 'tts', async (data, config) => {
    const { pipelineId } = input;
    const { ssmlScript, voice, rate, pitch, maxChunkChars } = data;
    const storage = new CloudStorageClient();

    // Validate input
    if (!ssmlScript || ssmlScript.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_TTS_INVALID_INPUT',
        'SSML script cannot be empty',
        'tts',
        { pipelineId }
      );
    }

    // Determine max chunk size
    // Note: TTS API has a 5000 BYTE limit, not character limit
    // Use 4000 chars to account for SSML overhead and UTF-8 encoding
    const maxChars = maxChunkChars || 4000;

    // Chunk script with SSML preservation
    const chunks = chunkScript(ssmlScript, maxChars);

    logger.info({
      pipelineId,
      stage: 'tts',
      chunkCount: chunks.length,
      chunkingRequired: chunks.length > 1,
    }, 'Script chunked for TTS processing');

    // TTS options
    const ttsOptions: TTSOptions = {
      voice,
      speakingRate: rate || 1.0,
      pitch: pitch || 0,
      ssmlInput: true,
      audioEncoding: 'LINEAR16', // Force WAV output (critical for stitching)
    };

    // If single chunk, use simple synthesis path
    if (chunks.length === 1) {
      return await synthesizeSingleChunk(
        pipelineId,
        chunks[0].text,
        ttsOptions,
        config.tracker as any, // Cast because executeStage types might not fully expose tracker
        storage,
        ssmlScript,
        data.topicData
      );
    }

    // Multi-chunk path: synthesize each chunk separately
    logger.info({
      pipelineId,
      stage: 'tts',
      chunkCount: chunks.length,
    }, 'Multi-chunk synthesis required');

    const segments: AudioSegment[] = [];
    let usedProvider = '';
    let tier: 'primary' | 'fallback' = 'primary';
    let totalAttempts = 0;

    // Synthesize each chunk
    for (const chunk of chunks) {
      logger.info({
        pipelineId,
        stage: 'tts',
        chunkIndex: chunk.index,
        chunkLength: chunk.text.length,
      }, 'Synthesizing chunk');

      // Execute TTS with retry + fallback pattern for this chunk
      const fallbackResult = await withRetry(
        () =>
          withFallback(
            ttsProviders,
            async (provider) => {
              logger.debug({
                pipelineId,
                stage: 'tts',
                chunkIndex: chunk.index,
                provider: provider.name,
              }, 'Attempting chunk synthesis');

              // Synthesize audio with provider
              const result = await provider.synthesize(chunk.text, ttsOptions);

              // Track cost for this attempt
              if (config.tracker && typeof (config.tracker as any).recordApiCall === 'function') {
                (config.tracker as any).recordApiCall(
                  provider.name,
                  { input: chunk.text.length, output: 0 },
                  result.cost
                );
              }

              return { result, provider: provider.name };
            },
            {
              stage: 'tts',
              onFallback: (from, to, error) => {
                logger.warn({
                  pipelineId,
                  stage: 'tts',
                  chunkIndex: chunk.index,
                  fromProvider: from,
                  toProvider: to,
                  error: error.code,
                }, 'Chunk synthesis fallback triggered');
              },
            }
          ),
        {
          maxRetries: 3,
          stage: 'tts',
          onRetry: (attempt, delay, error) => {
            logger.warn({
              pipelineId,
              stage: 'tts',
              chunkIndex: chunk.index,
              attempt,
              delay,
              error: error.code,
            }, 'Retrying chunk synthesis');
          },
        }
      );

      const { result: ttsResult, tier: chunkTier } = fallbackResult.result;
      const { result: audioResult, provider: chunkProvider } = ttsResult;

      // Track provider and tier (use worst tier across all chunks)
      usedProvider = chunkProvider;
      if (chunkTier === 'fallback') {
        tier = 'fallback';
      }
      totalAttempts += fallbackResult.attempts;

      if (!audioResult.audioContent) {
        throw NexusError.critical(
          'NEXUS_TTS_NO_AUDIO',
          `Chunk ${chunk.index} synthesis returned no audio content`,
          'tts',
          { provider: chunkProvider, chunkIndex: chunk.index }
        );
      }

      // Upload segment to Cloud Storage
      const segmentUrl = await storage.uploadArtifact(
        pipelineId,
        'tts',
        `audio-segments/${chunk.index}.wav`,
        audioResult.audioContent,
        'audio/wav'
      );

      logger.info({
        pipelineId,
        stage: 'tts',
        chunkIndex: chunk.index,
        provider: chunkProvider,
        tier: chunkTier,
        segmentUrl,
        durationSec: audioResult.durationSec,
      }, 'Chunk synthesized and uploaded');

      // Store segment
      segments.push({
        index: chunk.index,
        audioBuffer: audioResult.audioContent,
        durationSec: audioResult.durationSec,
      });
    }

    // Stitch audio segments together
    logger.info({
      pipelineId,
      stage: 'tts',
      segmentCount: segments.length,
    }, 'Stitching audio segments');

    const stitchedAudioBuffer = stitchAudio(segments, 200);

    // Calculate total duration (segments + silence padding)
    const segmentDuration = segments.reduce((sum, s) => sum + s.durationSec, 0);
    const silenceDuration = (segments.length - 1) * 0.2; // 200ms per gap
    const totalDuration = segmentDuration + silenceDuration;

    // Upload stitched audio to Cloud Storage
    const audioUrl = await storage.uploadArtifact(
      pipelineId,
      'tts',
      'audio.wav',
      stitchedAudioBuffer,
      'audio/wav'
    );

    logger.info({
      pipelineId,
      stage: 'tts',
      audioUrl,
      segmentCount: segments.length,
      totalDuration,
    }, 'Stitched audio uploaded to Cloud Storage');

    // Estimate word count for duration validation (approximate)
    const textContent = ssmlScript.replace(/<[^>]+>/g, '');
    const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;

    // Run quality validation on stitched audio
    const sampleRate = 44100; // Standard for our pipeline
    const qualityMetrics = validateAudioQuality(
      stitchedAudioBuffer,
      sampleRate,
      totalDuration,
      wordCount
    );

    // Add segment info to measurements
    const qualityMeasurements = {
      ...qualityMetrics,
      codec: 'wav',
      sampleRate,
      segmentCount: segments.length,
      durationSec: totalDuration,
    };

    // Construct stage result (to be processed by executeStage)
    // We return additional properties like artifacts and provider info
    // executeStage will pick these up
    // Include script for visual-gen (strip SSML tags to get plain text with [VISUAL:] cues)
    const scriptForVisualGen = ssmlScript.replace(/<[^>]+>/g, '').trim();

    return {
      audioUrl,
      durationSec: totalDuration,
      audioDurationSec: totalDuration, // Alias for visual-gen compatibility
      format: 'wav',
      sampleRate,
      segmentCount: segments.length,
      script: scriptForVisualGen, // Pass through for visual-gen
      topicData: data.topicData, // Pass through for YouTube metadata generation
      // Metadata for executeStage
      artifacts: [
        {
          type: 'audio',
          url: audioUrl,
          size: stitchedAudioBuffer.length,
          contentType: 'audio/wav',
          generatedAt: new Date().toISOString(),
          stage: 'tts',
        },
        // Add segment artifacts
        ...segments.map((segment) => ({
          type: 'audio-segment' as const,
          url: `gs://nexus-ai-artifacts/${pipelineId}/tts/audio-segments/${segment.index}.wav`,
          size: segment.audioBuffer.length,
          contentType: 'audio/wav',
          generatedAt: new Date().toISOString(),
          stage: 'tts',
        })),
      ],
      // Pass quality info for the gate
      quality: {
        stage: 'tts',
        timestamp: new Date().toISOString(),
        measurements: qualityMeasurements,
      },
      provider: {
        name: usedProvider,
        tier,
        attempts: totalAttempts,
      },
    } as any;
  }, { qualityGate: 'tts' });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Synthesize a single chunk (no stitching needed)
 */
async function synthesizeSingleChunk(
  pipelineId: string,
  scriptText: string,
  ttsOptions: TTSOptions,
  tracker: any,
  storage: CloudStorageClient,
  originalScript: string,
  topicData?: any
): Promise<any> {
  logger.debug({
    pipelineId,
    stage: 'tts',
  }, 'Using single-chunk synthesis path');

  // Execute TTS with retry + fallback pattern
  const fallbackResult = await withRetry(
    () =>
      withFallback(
        ttsProviders,
        async (provider) => {
          logger.debug({
            pipelineId,
            stage: 'tts',
            provider: provider.name,
          }, 'Attempting TTS synthesis');

          // Synthesize audio with provider
          const result = await provider.synthesize(scriptText, ttsOptions);

          // Track cost for this attempt
          if (tracker && typeof tracker.recordApiCall === 'function') {
            tracker.recordApiCall(
              provider.name,
              { input: scriptText.length, output: 0 },
              result.cost
            );
          }

          return { result, provider: provider.name };
        },
        {
          stage: 'tts',
          onFallback: (from, to, error) => {
            logger.warn({
              pipelineId,
              stage: 'tts',
              fromProvider: from,
              toProvider: to,
              error: error.code,
            }, 'TTS provider fallback triggered');
          },
        }
      ),
    {
      maxRetries: 3,
      stage: 'tts',
      onRetry: (attempt, delay, error) => {
        logger.warn({
          pipelineId,
          stage: 'tts',
          attempt,
          delay,
          error: error.code,
        }, 'Retrying TTS synthesis');
      },
    }
  );

  const { result: ttsResult, tier } = fallbackResult.result;
  const { result: audioResult, provider: usedProvider } = ttsResult;

  // Validate audio content exists
  if (!audioResult.audioContent) {
    throw NexusError.critical(
      'NEXUS_TTS_NO_AUDIO',
      'Provider returned no audio content',
      'tts',
      { provider: usedProvider }
    );
  }

  // Upload audio to Cloud Storage
  const audioUrl = await storage.uploadArtifact(
    pipelineId,
    'tts',
    'audio.wav',
    audioResult.audioContent,
    'audio/wav'
  );

  // Estimate word count for duration validation
  const textContent = originalScript.replace(/<[^>]+>/g, '');
  const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;

  // Run quality validation
  const qualityMetrics = validateAudioQuality(
    audioResult.audioContent,
    audioResult.sampleRate,
    audioResult.durationSec,
    wordCount
  );

  const qualityMeasurements = {
    ...qualityMetrics,
    codec: audioResult.codec,
    sampleRate: audioResult.sampleRate,
    segmentCount: 1,
    durationSec: audioResult.durationSec,
  };

  // Strip SSML tags to get plain text with [VISUAL:] cues for visual-gen
  const scriptForVisualGen = originalScript.replace(/<[^>]+>/g, '').trim();

  return {
    audioUrl,
    durationSec: audioResult.durationSec,
    audioDurationSec: audioResult.durationSec, // Alias for visual-gen compatibility
    format: audioResult.codec,
    sampleRate: audioResult.sampleRate,
    script: scriptForVisualGen, // Pass through for visual-gen
    topicData, // Pass through for YouTube metadata generation
    artifacts: [
      {
        type: 'audio',
        url: audioUrl,
        size: audioResult.audioContent.length,
        contentType: `audio/${audioResult.codec}`,
        generatedAt: new Date().toISOString(),
        stage: 'tts',
      },
    ],
    quality: {
      stage: 'tts',
      timestamp: new Date().toISOString(),
      measurements: qualityMeasurements,
    },
    provider: {
      name: usedProvider,
      tier,
      attempts: fallbackResult.attempts,
    },
  };
}

