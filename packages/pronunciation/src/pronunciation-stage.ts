import {
  StageInput,
  StageOutput,
  executeStage,
  logger,
  CostTracker,
  addToReviewQueue,
  PRONUNCIATION_UNKNOWN_THRESHOLD,
  type PronunciationItemContent,
  type TermLocation,
} from '@nexus-ai/core';
import { getScriptText, type ScriptGenOutput } from '@nexus-ai/script-gen';
import { NexusError } from '@nexus-ai/core/errors';
import { PronunciationClient } from './pronunciation-client.js';
import { extractTerms, extractContext } from './extractor.js';
import { tagScript } from './ssml-tagger.js';
import type { PronunciationEntry } from './types.js';

/**
 * Input for the pronunciation stage
 * Supports both V1 (string) and V2 (ScriptGenOutput) inputs for backward compatibility
 */
export interface PronunciationInput {
  /** Script content - either raw string (V1) or full ScriptGenOutput (V2) */
  script: string | ScriptGenOutput;
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Type guard to check if input is a ScriptGenOutput object
 * Checks for the presence of required fields that distinguish ScriptGenOutput from string
 * @param input - Script input (string or ScriptGenOutput)
 * @returns true if input is a ScriptGenOutput object
 */
function isScriptGenOutput(input: string | ScriptGenOutput): input is ScriptGenOutput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  // Check for required V1 fields (script and artifactUrl are the minimum distinguishing fields)
  // V2 extends V1, so this check works for both
  return 'script' in input && 'artifactUrl' in input;
}

/**
 * Extract clean narration text from script input
 * Uses getScriptText() from @nexus-ai/script-gen to handle both V1 and V2 formats
 *
 * @param input - Script input (string or ScriptGenOutput)
 * @returns Clean narration text without visual cues or stage directions
 * @throws NexusError if input is empty or invalid
 */
function extractCleanScript(input: string | ScriptGenOutput): string {
  // Handle plain string input (legacy path)
  if (typeof input === 'string') {
    if (!input || input.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_PRONUNCIATION_INVALID_INPUT',
        'Script input cannot be empty',
        'pronunciation'
      );
    }
    // V1 string: getScriptText only reads the 'script' field for V1 inputs
    // Create minimal wrapper - other fields are not accessed for bracket stripping
    const v1Wrapper = { script: input } as unknown as ScriptGenOutput;
    return getScriptText(v1Wrapper);
  }

  // Handle ScriptGenOutput object (V1 or V2)
  const result = getScriptText(input);
  if (!result || result.trim().length === 0) {
    throw NexusError.critical(
      'NEXUS_PRONUNCIATION_INVALID_INPUT',
      'Script content cannot be empty',
      'pronunciation'
    );
  }
  return result;
}

/**
 * Output for the pronunciation stage
 */
export interface PronunciationOutput {
  /** SSML-tagged script */
  ssmlScript: string;
  /** List of unknown terms flagged for review */
  flaggedTerms: string[];
  /** Whether this stage output requires human review */
  requiresReview?: boolean;
  /** Pass-through topic data for downstream stages (YouTube metadata) */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
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

      // Extract clean script text (handles both V1 string and V2 ScriptGenOutput)
      const cleanScript = extractCleanScript(data.script);

      const isV2Input = isScriptGenOutput(data.script);
      logger.info(
        {
          pipelineId: input.pipelineId,
          scriptLength: cleanScript.length,
          inputFormat: isV2Input ? 'V2 (ScriptGenOutput)' : 'V1 (string)',
        },
        'Pronunciation stage started'
      );

      // 1. Extract potential technical terms from clean script (no brackets)
      const termList = extractTerms(cleanScript, { includeContext: false });
      const terms = new Set(termList);
      logger.debug({ termCount: terms.size }, 'Extracted technical terms from clean script');

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
      let requiresReview = false;
      if (flaggedTerms.length > PRONUNCIATION_UNKNOWN_THRESHOLD) {
        logger.warn({ flaggedCount: flaggedTerms.length }, 'High number of unknown terms flagged');
        requiresReview = true;

        // Build term locations for context (using clean script without brackets)
        const termLocations: TermLocation[] = flaggedTerms.map((term) => {
          const context = extractContext(cleanScript, term);
          const lines = cleanScript.split('\n');
          let lineNumber = 1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(term)) {
              lineNumber = i + 1;
              break;
            }
          }
          return {
            term,
            lineNumber,
            surroundingText: context,
          };
        });

        // Create consolidated review item for all unknown terms
        const itemContent: PronunciationItemContent = {
          unknownTerms: flaggedTerms,
          totalTerms: terms.size,
          knownTerms: terms.size - flaggedTerms.length,
        };

        const itemContext: Record<string, unknown> = {
          scriptExcerpt: cleanScript.substring(0, 500),
          termLocations,
        };

        await addToReviewQueue({
          type: 'pronunciation',
          pipelineId: input.pipelineId,
          stage: 'pronunciation',
          item: itemContent,
          context: itemContext,
        });
      }

      // 4. Generate SSML-tagged script from clean narration
      const ssmlScript = tagScript(cleanScript, pronunciationMap, { processHints: true });

      // 5. Calculate quality metrics
      const accuracy = terms.size > 0 
        ? ((terms.size - flaggedTerms.length) / terms.size) * 100 
        : 100;

      const result: PronunciationOutput = {
        ssmlScript,
        flaggedTerms,
        requiresReview,
        // Pass-through topic data for YouTube metadata generation
        topicData: data.topicData,
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
