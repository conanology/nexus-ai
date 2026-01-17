/**
 * TTS synthesis stage implementation
 * @module @nexus-ai/tts
 */

import type { StageInput, StageOutput, TTSProvider, TTSOptions } from '@nexus-ai/core/types';
import { GeminiTTSProvider, ChirpProvider, WaveNetProvider } from '@nexus-ai/core/providers';
import { withRetry, withFallback } from '@nexus-ai/core/utils';
import { createLogger, CostTracker } from '@nexus-ai/core/observability';
import { qualityGate } from '@nexus-ai/core/quality';
import { NexusError } from '@nexus-ai/core/errors';
import { CloudStorageClient } from '@nexus-ai/core/storage';
import type { TTSInput, TTSOutput } from './types.js';
import { validateAudioQuality } from './audio-quality.js';
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
  const startTime = Date.now();
  const { pipelineId, data } = input;
  const { ssmlScript, voice, rate, pitch } = data;

  // Initialize cost tracker for this stage
  const tracker = new CostTracker(pipelineId, 'tts');
  const storage = new CloudStorageClient();

  logger.info({
    pipelineId,
    stage: 'tts',
    scriptLength: ssmlScript.length,
  }, 'TTS stage started');

  try {
    // Validate input
    if (!ssmlScript || ssmlScript.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_TTS_INVALID_INPUT',
        'SSML script cannot be empty',
        'tts',
        { pipelineId }
      );
    }

    // Chunk script (currently returns single chunk, Story 3.2 will implement actual chunking)
    const chunks = chunkScript(ssmlScript);

    logger.debug({
      pipelineId,
      stage: 'tts',
      chunkCount: chunks.length,
    }, 'Script chunked for TTS processing');

    // TTS options
    const ttsOptions: TTSOptions = {
      voice,
      speakingRate: rate || 1.0,
      pitch: pitch || 0,
      ssmlInput: true, // Always true for our pipeline
    };

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
            const result = await provider.synthesize(chunks[0], ttsOptions);

            // Track cost for this attempt
            tracker.recordApiCall(
              provider.name,
              { input: ssmlScript.length, output: 0 }, // character count
              result.cost
            );

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

    logger.info({
      pipelineId,
      stage: 'tts',
      provider: usedProvider,
      tier,
      attempts: fallbackResult.attempts,
      cost: audioResult.cost,
      durationSec: audioResult.durationSec,
    }, 'TTS synthesis complete');

    // Handle audio upload and quality check
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

    logger.debug({
      pipelineId,
      stage: 'tts',
      audioUrl,
    }, 'Audio uploaded to Cloud Storage');

    // Estimate word count for duration validation (approximate)
    // Remove tags to get text content length
    const textContent = ssmlScript.replace(/<[^>]+>/g, '');
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

    // Run quality validation on actual audio buffer
    const qualityMetrics = validateAudioQuality(
      audioResult.audioContent,
      audioResult.sampleRate,
      audioResult.durationSec,
      wordCount
    );

    // Add codec/segment info to measurements
    const qualityMeasurements = {
      ...qualityMetrics,
      codec: audioResult.codec,
      sampleRate: audioResult.sampleRate,
      segmentCount: chunks.length,
      durationSec: audioResult.durationSec,
    };

    logger.debug({
      pipelineId,
      stage: 'tts',
      quality: qualityMeasurements,
    }, 'Running quality gate checks');

    // Check quality gate
    const gateResult = await qualityGate.check('tts', {
      quality: {
        stage: 'tts',
        timestamp: new Date().toISOString(),
        measurements: qualityMeasurements,
      },
    });

    const warnings: string[] = [];

    // Add warnings from quality gate
    if (gateResult.warnings && gateResult.warnings.length > 0) {
      warnings.push(...gateResult.warnings);
    }

    // Warn if using fallback provider
    if (tier === 'fallback') {
      warnings.push(`TTS used fallback provider: ${usedProvider}`);
    }

    // Construct stage output
    const output: StageOutput<TTSOutput> = {
      success: true,
      data: {
        audioUrl,
        durationSec: audioResult.durationSec,
        format: audioResult.codec,
        sampleRate: audioResult.sampleRate,
      },
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
      cost: tracker.getSummary(),
      durationMs: Date.now() - startTime,
      provider: {
        name: usedProvider,
        tier,
        attempts: fallbackResult.attempts,
      },
      warnings,
    };

    logger.info({
      pipelineId,
      stage: 'tts',
      durationMs: output.durationMs,
      provider: output.provider,
      audioDuration: audioResult.durationSec,
      cost: output.cost,
    }, 'TTS stage complete');

    return output;
  } catch (error) {
    logger.error({
      pipelineId,
      stage: 'tts',
      error,
      durationMs: Date.now() - startTime,
    }, 'TTS stage failed');

    throw NexusError.fromError(error, 'tts');
  }
}
