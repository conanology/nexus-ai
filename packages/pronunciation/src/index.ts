/**
 * @nexus-ai/pronunciation - Pronunciation dictionary with IPA phonemes for TTS
 *
 * @module @nexus-ai/pronunciation
 */

export { PronunciationClient } from './pronunciation-client.js';
export { executePronunciation } from './pronunciation-stage.js';
export type { PronunciationEntry, AddTermInput } from './types.js';
export type { PronunciationInput, PronunciationOutput } from './pronunciation-stage.js';
export { extractTerms, extractPronounceHints, extractContext } from './extractor.js';
export type { ExtractedTerm, ExtractTermsOptions } from './extractor.js';
export { ReviewQueueClient } from './review-queue.js';
export type { ReviewQueueItem, AddToReviewQueueInput } from './review-queue.js';
export { executePronunciationExtraction } from './extraction-stage.js';
export type {
  PronunciationExtractionInput,
  PronunciationExtractionOutput,
} from './extraction-stage.js';