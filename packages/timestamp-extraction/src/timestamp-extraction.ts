/**
 * @nexus-ai/timestamp-extraction
 * Main stage executor for timestamp extraction
 *
 * This stage extracts word-level timing from TTS audio.
 * Currently uses estimated timing; STT integration added in Story 6.6.
 */

import {
  type StageInput,
  type StageOutput,
  type QualityMetrics,
  createPipelineLogger,
  CostTracker,
  NexusError,
} from '@nexus-ai/core';

import type { WordTiming } from '@nexus-ai/script-gen';

import type {
  TimestampExtractionInput,
  TimestampExtractionOutput,
  TimingMetadata,
} from './types.js';

import { applyEstimatedTimings } from './fallback.js';
import { validateTimestampExtraction } from './quality-gate.js';

const STAGE_NAME = 'timestamp-extraction';

/**
 * Execute timestamp extraction stage.
 *
 * Extracts word-level timing from TTS audio and enriches the DirectionDocument.
 * Currently uses estimated timing; STT extraction will be added in Story 6.6.
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

    log.info({
      audioUrl: input.data.audioUrl,
      audioDurationSec: input.data.audioDurationSec,
      segmentCount: input.data.directionDocument.segments.length,
    }, 'Stage started');

    // TODO (Story 6.6): Implement STT extraction
    // For now, use estimated timing as fallback
    const useEstimatedTiming = true;

    let wordTimings: WordTiming[];
    let enrichedDocument: typeof input.data.directionDocument;
    let timingMetadata: TimingMetadata;

    if (useEstimatedTiming) {
      // Use estimated timing (fallback)
      log.info({
        reason: 'STT not yet implemented (Story 6.6)',
      }, 'Using estimated timing');

      const result = applyEstimatedTimings(
        input.data.directionDocument,
        input.data.audioDurationSec
      );

      wordTimings = result.wordTimings;
      enrichedDocument = result.document;
      timingMetadata = {
        source: 'estimated',
        estimationMethod: 'character-weighted',
        warningFlags: ['estimated-timing-used'],
      };

      // No cost for estimated timing
      tracker.recordApiCall('estimated-timing', {}, 0);
    } else {
      // TODO (Story 6.6): STT extraction path
      // This branch will be implemented when Google Cloud STT is integrated
      throw NexusError.critical(
        'NEXUS_TIMESTAMP_NOT_IMPLEMENTED',
        'STT extraction not yet implemented',
        STAGE_NAME
      );
    }

    // Check for empty segments
    if (wordTimings.length === 0) {
      timingMetadata.warningFlags.push('no-words-extracted');
      log.warn({
        segmentCount: input.data.directionDocument.segments.length,
      }, 'No words extracted from segments');
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
        name: useEstimatedTiming ? 'estimated' : 'google-stt',
        tier: useEstimatedTiming ? 'fallback' : 'primary',
        attempts: 1,
      },
      warnings: timingMetadata.warningFlags.length > 0
        ? timingMetadata.warningFlags
        : undefined,
    };

    log.info({
      durationMs,
      wordCount: wordTimings.length,
      timingSource: timingMetadata.source,
      qualityStatus: qualityResult.status,
    }, 'Stage complete');

    return output;
  } catch (error) {
    log.error({
      error,
    }, 'Stage failed');

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
