/**
 * Pronunciation dictionary types for NEXUS-AI TTS
 *
 * @module @nexus-ai/pronunciation/types
 */

/**
 * Pronunciation dictionary entry
 */
export interface PronunciationEntry {
  /** Term (lowercase key) */
  term: string;
  /** IPA phonetic transcription */
  ipa: string;
  /** Full SSML phoneme tag */
  ssml: string;
  /** Human-verified status */
  verified: boolean;
  /** Source of entry: seed, auto, or manual */
  source: 'seed' | 'auto' | 'manual';
  /** Number of times this term has been used */
  usageCount: number;
  /** Last time this term was used (ISO 8601) */
  lastUsed: string | null;
  /** Date entry was added (ISO 8601) */
  addedDate: string;
}

/**
 * Input for adding a new pronunciation term
 */
export interface AddTermInput {
  /** Term to add */
  term: string;
  /** IPA phonetic transcription */
  ipa: string;
  /** Optional SSML (will be generated if not provided) */
  ssml?: string;
  /** Source of entry (defaults to 'manual') */
  source?: 'seed' | 'auto' | 'manual';
  /** Whether this entry is verified (defaults to false) */
  verified?: boolean;
}
