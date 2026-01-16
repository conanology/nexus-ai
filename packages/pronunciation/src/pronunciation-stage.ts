import {
  StageInput,
  StageOutput,
  executeStage,
  logger,
  CostTracker,
} from '@nexus-ai/core';
import { PronunciationClient } from './pronunciation-client.js';

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

      // 1. Extract potential technical terms
      const terms = extractTechnicalTerms(data.script);
      logger.debug({ termCount: terms.size }, 'Extracted technical terms');

      // 2. Look up terms in dictionary
      const flaggedTerms: string[] = [];
      const pronunciationMap = new Map<string, string>();

      // Load dictionary once
      await client.getDictionary(tracker);

      for (const term of terms) {
        const entry = await client.lookupTerm(term, tracker);
        if (entry) {
          pronunciationMap.set(term.toLowerCase(), entry.ssml);
        } else {
          flaggedTerms.push(term);
        }
      }

      // 3. Flag unknown terms for review if threshold exceeded (>3)
      if (flaggedTerms.length > 3) {
        logger.warn({ flaggedCount: flaggedTerms.length }, 'High number of unknown terms flagged');
        // In a real implementation, this would create a review item in Firestore
      }

      // 4. Generate SSML-tagged script
      const ssmlScript = tagScript(data.script, pronunciationMap);

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
          status: accuracy >= 98 ? 'PASS' : 'WARN',
        },
      };
    },
    { qualityGate: 'pronunciation' }
  );
}

/**
 * Extract potential technical terms from script
 * Simple implementation: capitalized words (proper nouns), acronyms, camelCase
 */
function extractTechnicalTerms(script: string): Set<string> {
  const terms = new Set<string>();
  
  // Match potential technical terms:
  // 1. Acronyms (2+ uppercase letters)
  // 2. Capitalized words (Proper Nouns)
  // 3. camelCase/PascalCase words
  // 4. Words with numbers (GPT-4)
  const regex = /\b([A-Z]{2,}|[A-Z][a-z]+[A-Z][a-zA-Z]*|[A-Z][a-z0-9]+(-[A-Z0-9][a-z0-9]*)*)\b/g;
  
  let match;
  while ((match = regex.exec(script)) !== null) {
    const term = match[0];
    // Filter out common English words at start of sentence if needed
    // For now, keep it simple
    terms.add(term);
  }
  
  return terms;
}

/**
 * Replace terms in script with SSML tags
 */
function tagScript(script: string, pronunciationMap: Map<string, string>): string {
  let taggedScript = script;
  
  // Sort terms by length descending to avoid partial replacements (e.g., "GPT-4" before "GPT")
  const sortedTerms = Array.from(pronunciationMap.keys()).sort((a, b) => b.length - a.length);
  
  for (const term of sortedTerms) {
    const ssml = pronunciationMap.get(term)!;
    // Use word boundaries and case-insensitive matching
    const regex = new RegExp(`\b${escapeRegExp(term)}\b`, 'gi');
    taggedScript = taggedScript.replace(regex, ssml);
  }
  
  return taggedScript;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\\]/g, '\\$&');
}
