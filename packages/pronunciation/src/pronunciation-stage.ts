import {
  StageInput,
  StageOutput,
  executeStage,
  logger,
  CostTracker,
} from '@nexus-ai/core';
import { PronunciationClient } from './pronunciation-client.js';
import { ReviewQueueClient } from './review-queue.js';
import { extractTerms, extractContext } from './extractor.js';
import { tagScript } from './ssml-tagger.js';
import type { PronunciationEntry } from './types.js';

/**
 * Input for the pronunciation stage
 */
export interface PronunciationInput {
  /** Script content to process */
  script: string;
}

/**
 * Output for the pronunciation stage
 */
export interface PronunciationOutput {
  /** SSML-tagged script */
  ssmlScript: string;
  /** List of unknown terms flagged for review */
  flaggedTerms: string[];
}

/**
 * Execute the pronunciation dictionary stage (Stage 4)
 *
 * Extracts technical terms, checks against IPA dictionary, flags unknowns,
 * and generates SSML-tagged script for TTS synthesis.
 *
 * @param input - Stage input with script
 * @returns Stage output with SSML script and flagged terms
 */
export async function executePronunciation(
  input: StageInput<PronunciationInput>
): Promise<StageOutput<PronunciationOutput>> {
  return executeStage(
    input,
    'pronunciation',
    async (data) => {
      const tracker = new CostTracker(input.pipelineId, 'pronunciation');
      const client = new PronunciationClient();

      logger.info(
        {
          pipelineId: input.pipelineId,
          scriptLength: data.script.length,
        },
        'Pronunciation stage started'
      );

      // 1. Extract potential technical terms from extractor.ts
      const termList = extractTerms(data.script, { includeContext: false });
      const terms = new Set(termList);
      logger.debug({ termCount: terms.size }, 'Extracted technical terms');

      // 2. Look up terms in dictionary
      const flaggedTerms: string[] = [];
      const pronunciationMap = new Map<string, PronunciationEntry>();

      // Load dictionary once
      await client.getDictionary(tracker);

      for (const term of terms) {
        const entry = await client.lookupTerm(term, tracker);
        if (entry) {
          pronunciationMap.set(term.toLowerCase(), entry);
        } else {
          flaggedTerms.push(term);
        }
      }

      // 3. Flag unknown terms for review if threshold exceeded (>3)
      if (flaggedTerms.length > 3) {
        logger.warn({ flaggedCount: flaggedTerms.length }, 'High number of unknown terms flagged');

        // Add unknown terms to review queue with context
        const reviewQueueClient = new ReviewQueueClient();
        for (const term of flaggedTerms) {
          const context = extractContext(data.script, term);
          await reviewQueueClient.addToReviewQueue({
            term,
            context,
            pipelineId: input.pipelineId
          });
        }
      }

      // 4. Generate SSML-tagged script
      const ssmlScript = tagScript(data.script, pronunciationMap, { processHints: true });

      // 5. Calculate quality metrics
      const accuracy = terms.size > 0 
        ? ((terms.size - flaggedTerms.length) / terms.size) * 100 
        : 100;

      const result: PronunciationOutput = {
        ssmlScript,
        flaggedTerms,
      };

      return {
        ...result,
        quality: {
          metrics: {
            totalTerms: terms.size,
            knownTerms: terms.size - flaggedTerms.length,
            unknownTerms: flaggedTerms.length,
            accuracy,
          },
          status: accuracy >= 98 ? 'PASS' : 'DEGRADED',
        },
      };
    },
    { qualityGate: 'pronunciation' }
  );
}
