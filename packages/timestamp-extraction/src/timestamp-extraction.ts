/**
 * @nexus-ai/timestamp-extraction
 * Main stage executor for timestamp extraction
 *
 * This stage extracts word-level timing from TTS audio using:
 * 1. Google Cloud Speech-to-Text (primary)
 * 2. Estimated timing (fallback)
 */

import {
  type StageInput,
  type StageOutput,
  type QualityMetrics,
  createPipelineLogger,
  CostTracker,
  NexusError,
  withRetry,
} from '@nexus-ai/core';

import type { WordTiming, DirectionDocument } from '@nexus-ai/script-gen';

import type {
  TimestampExtractionInput,
  TimestampExtractionOutput,
  TimingMetadata,
} from './types.js';

import { applyEstimatedTimings } from './fallback.js';
import { validateTimestampExtraction } from './quality-gate.js';
import { countWords } from './types.js';

// STT integration (Story 6.6)
import {
  recognizeLongRunning,
  shouldUseFallback,
  DEFAULT_STT_CONFIG,
  type STTExtractionResult,
} from './stt-client.js';
import { downloadAndConvert, isValidGcsUrl } from './audio-utils.js';
import {
  mapWordsToSegments,
  applyWordTimingsToSegments,
} from './word-mapper.js';

const STAGE_NAME = 'timestamp-extraction';

/**
 * Execute timestamp extraction stage.
 *
 * Extracts word-level timing from TTS audio and enriches the DirectionDocument.
 * Uses Google Cloud STT for extraction, with estimated timing as fallback.
 *
 * @param input - Stage input with audio URL and direction document
 * @returns Stage output with enriched direction document and word timings
 */
export async function executeTimestampExtraction(
  input: StageInput<TimestampExtractionInput>
): Promise<StageOutput<TimestampExtractionOutput>> {
  const startTime = Date.now();
  const tracker = new CostTracker(input.pipelineId, STAGE_NAME);
  const log = createPipelineLogger(input.pipelineId, STAGE_NAME);

  try {
    // Validate input first
    if (!input.data.directionDocument) {
      throw NexusError.critical(
        'NEXUS_TIMESTAMP_INVALID_INPUT',
        'Direction document is required',
        STAGE_NAME
      );
    }

    if (!input.data.audioUrl) {
      throw NexusError.critical(
        'NEXUS_TIMESTAMP_INVALID_INPUT',
        'Audio URL is required',
        STAGE_NAME
      );
    }

    if (!input.data.audioDurationSec || input.data.audioDurationSec <= 0) {
      throw NexusError.critical(
        'NEXUS_TIMESTAMP_INVALID_INPUT',
        'Audio duration must be a positive number',
        STAGE_NAME
      );
    }

    // Count expected words from segments
    const expectedWordCount = input.data.directionDocument.segments.reduce(
      (sum, seg) => sum + countWords(seg.content.text),
      0
    );

    log.info(
      {
        audioUrl: input.data.audioUrl,
        audioDurationSec: input.data.audioDurationSec,
        segmentCount: input.data.directionDocument.segments.length,
        expectedWordCount,
      },
      'Stage started'
    );

    let wordTimings: WordTiming[];
    let enrichedDocument: DirectionDocument;
    let timingMetadata: TimingMetadata;
    let providerName = 'google-stt';
    let providerTier: 'primary' | 'fallback' = 'primary';
    let retryAttempts = 1;

    // Attempt STT extraction with retry (per project-context.md pattern)
    const sttResult = await attemptSTTExtraction(
      input.data.audioUrl,
      input.pipelineId,
      tracker,
      log
    );

    retryAttempts = sttResult.attempts;

    // Check if we should use fallback
    const fallbackDecision = shouldUseFallback(
      sttResult.result,
      expectedWordCount,
      sttResult.error
    );

    if (fallbackDecision.useFallback) {
      // Use estimated timing (fallback)
      log.info(
        {
          reason: fallbackDecision.reason,
        },
        'Using estimated timing fallback'
      );

      const result = applyEstimatedTimings(
        input.data.directionDocument,
        input.data.audioDurationSec
      );

      wordTimings = result.wordTimings;
      enrichedDocument = result.document;
      timingMetadata = {
        source: 'estimated',
        estimationMethod: 'character-weighted',
        fallbackReason: fallbackDecision.reason,
        warningFlags: ['estimated-timing-used', `fallback-reason:${fallbackDecision.reason}`],
      };

      providerName = 'estimated';
      providerTier = 'fallback';

      // No cost for estimated timing
      tracker.recordApiCall('estimated-timing', {}, 0);
    } else {
      // Use STT extraction results
      const stt = sttResult.result!;

      log.info(
        {
          sttWordCount: stt.words.length,
          sttConfidence: stt.confidence,
          expectedWordCount,
        },
        'STT extraction successful, mapping words to segments'
      );

      // Map STT words to segments
      const mappingResult = mapWordsToSegments(
        stt.words,
        input.data.directionDocument.segments,
        input.pipelineId
      );

      // Apply word timings to segments
      const updatedSegments = applyWordTimingsToSegments(
        input.data.directionDocument.segments,
        mappingResult
      );

      enrichedDocument = {
        ...input.data.directionDocument,
        segments: updatedSegments,
      };
      wordTimings = mappingResult.allWordTimings;

      timingMetadata = {
        source: 'extracted',
        extractionConfidence: stt.confidence,
        mappingStats: {
          expectedWords: mappingResult.stats.expectedWordCount,
          sttWords: mappingResult.stats.sttWordCount,
          mappedWords: mappingResult.stats.mappedWordCount,
          matchRatio: mappingResult.stats.matchRatio,
        },
        warningFlags:
          mappingResult.stats.matchRatio < 0.9
            ? ['word-mapping-incomplete']
            : [],
      };

      // Check if mapping ratio is too low - trigger fallback
      if (mappingResult.stats.matchRatio < 0.8) {
        log.warn(
          {
            matchRatio: mappingResult.stats.matchRatio,
          },
          'Word mapping ratio below threshold, switching to fallback'
        );

        const fallbackResult = applyEstimatedTimings(
          input.data.directionDocument,
          input.data.audioDurationSec
        );

        wordTimings = fallbackResult.wordTimings;
        enrichedDocument = fallbackResult.document;
        timingMetadata = {
          source: 'estimated',
          estimationMethod: 'character-weighted',
          fallbackReason: `word-mapping-ratio-${(mappingResult.stats.matchRatio * 100).toFixed(0)}%`,
          warningFlags: [
            'estimated-timing-used',
            'stt-mapping-failed',
          ],
        };

        providerName = 'estimated';
        providerTier = 'fallback';
      }
    }

    // Check for empty segments
    if (wordTimings.length === 0) {
      timingMetadata.warningFlags.push('no-words-extracted');
      log.warn(
        {
          segmentCount: input.data.directionDocument.segments.length,
        },
        'No words extracted from segments'
      );
    }

    // Run quality gate validation
    const qualityResult = validateTimestampExtraction(
      wordTimings,
      input.data.directionDocument,
      Date.now() - startTime
    );

    // Quality gate FAIL check - must throw per project-context.md
    if (qualityResult.status === 'FAIL') {
      const failedChecks = Object.entries(qualityResult.checks)
        .filter(([, check]) => !check.passed && check.severity === 'CRITICAL')
        .map(([name]) => name)
        .join(', ');

      throw NexusError.degraded(
        'NEXUS_TIMESTAMP_QUALITY_GATE_FAIL',
        `Quality gate failed: ${failedChecks || 'critical checks failed'}`,
        STAGE_NAME,
        { checks: qualityResult.checks, flags: qualityResult.flags }
      );
    }

    // Map quality result to QualityMetrics
    const quality: QualityMetrics = {
      stage: STAGE_NAME,
      timestamp: new Date().toISOString(),
      measurements: {
        status: qualityResult.status,
        wordCount: wordTimings.length,
        timingSource: timingMetadata.source,
        confidence: timingMetadata.extractionConfidence,
        checks: qualityResult.checks,
        flags: qualityResult.flags,
      },
    };

    // Build output
    const outputData: TimestampExtractionOutput = {
      directionDocument: enrichedDocument,
      wordTimings,
      timingMetadata,
      audioUrl: input.data.audioUrl,
      audioDurationSec: input.data.audioDurationSec,
      topicData: input.data.topicData,
    };

    const durationMs = Date.now() - startTime;

    const output: StageOutput<TimestampExtractionOutput> = {
      success: true,
      data: outputData,
      quality,
      cost: tracker.getSummary(),
      durationMs,
      provider: {
        name: providerName,
        tier: providerTier,
        attempts: retryAttempts,
      },
      warnings:
        timingMetadata.warningFlags.length > 0
          ? timingMetadata.warningFlags
          : undefined,
    };

    log.info(
      {
        durationMs,
        wordCount: wordTimings.length,
        timingSource: timingMetadata.source,
        qualityStatus: qualityResult.status,
        provider: providerName,
        tier: providerTier,
      },
      'Stage complete'
    );

    return output;
  } catch (error) {
    log.error(
      {
        error,
      },
      'Stage failed'
    );

    if (error instanceof NexusError) {
      throw error;
    }

    throw NexusError.critical(
      'NEXUS_TIMESTAMP_EXECUTION_FAILED',
      error instanceof Error ? error.message : 'Unknown error',
      STAGE_NAME,
      { originalError: error }
    );
  }
}

/**
 * Attempt STT extraction from audio file with retry.
 *
 * Uses withRetry from @nexus-ai/core per project-context.md requirements
 * for external API calls.
 *
 * @param audioUrl - GCS URL to audio file
 * @param pipelineId - Pipeline ID for logging
 * @param tracker - Cost tracker
 * @param log - Logger instance
 * @returns STT result or error, with attempt count
 */
async function attemptSTTExtraction(
  audioUrl: string,
  pipelineId: string,
  tracker: CostTracker,
  log: ReturnType<typeof createPipelineLogger>
): Promise<{ result: STTExtractionResult | null; error: Error | null; attempts: number }> {
  try {
    // Validate GCS URL format
    if (!isValidGcsUrl(audioUrl)) {
      log.warn(
        {
          audioUrl,
        },
        'Invalid GCS URL format, using fallback'
      );
      return {
        result: null,
        error: new Error(`Invalid GCS URL format: ${audioUrl}`),
        attempts: 1,
      };
    }

    // Download and convert audio
    log.info({}, 'Downloading audio from GCS');
    const audioData = await downloadAndConvert(audioUrl, pipelineId);

    log.info(
      {
        originalFormat: audioData.originalFormat.encoding,
        originalSampleRate: audioData.originalFormat.sampleRate,
        conversionPerformed: audioData.conversionPerformed,
        durationSec: audioData.originalFormat.durationSec,
      },
      'Audio downloaded and converted'
    );

    // Call STT with retry wrapper (per project-context.md)
    log.info({}, 'Starting STT recognition');
    const retryResult = await withRetry(
      () =>
        recognizeLongRunning(
          audioData.buffer,
          {
            ...DEFAULT_STT_CONFIG,
            sampleRateHertz: 24000, // After conversion
          },
          pipelineId,
          tracker
        ),
      { maxRetries: 3, stage: STAGE_NAME }
    );

    return { result: retryResult.result, error: null, attempts: retryResult.attempts };
  } catch (error) {
    log.warn(
      {
        error,
      },
      'STT extraction failed, will use fallback'
    );
    return {
      result: null,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: 1,
    };
  }
}
