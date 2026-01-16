/**
 * SSML Tagging for TTS Pronunciation
 *
 * Generates SSML-tagged scripts with pronunciation markup for technical terms.
 * Uses longest-first term replacement with word boundary protection to prevent
 * partial replacements (e.g., "GPT" doesn't replace the "GPT" in "GPT-4").
 *
 * @module @nexus-ai/pronunciation/ssml-tagger
 */

import type { PronunciationEntry } from './types.js';

/**
 * Pronunciation hint parsed from [PRONOUNCE: ...] tags
 */
export interface PronunciationHint {
  /** Term to pronounce */
  term: string;
  /** Pronunciation guidance (may need IPA conversion) */
  pronunciation: string;
  /** Position in script where hint was found */
  position: number;
}

/**
 * Options for SSML tagging
 */
export interface SSMLTagOptions {
  /** Whether to process [PRONOUNCE: ...] hints */
  processHints?: boolean;
}

/**
 * Escape XML special characters in text
 *
 * IMPORTANT: Must be applied BEFORE adding SSML tags.
 * Escapes & first to avoid double-escaping.
 *
 * @param text - Text to escape
 * @returns XML-escaped text
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;') // MUST be first
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse pronunciation hints from script
 *
 * Extracts [PRONOUNCE: term = "pronunciation"] hints for inline pronunciation guidance.
 *
 * Format: [PRONOUNCE: {term} = "{pronunciation}"]
 * Example: [PRONOUNCE: Mixtral = "mix-trahl"]
 *
 * @param script - Script text to parse
 * @returns Array of parsed pronunciation hints
 */
export function parsePronunciationHints(script: string): PronunciationHint[] {
  const hints: PronunciationHint[] = [];
  const regex = /\[PRONOUNCE:\s*([^=]+?)\s*=\s*"([^"]+?)"\s*\]/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(script)) !== null) {
    hints.push({
      term: match[1].trim(),
      pronunciation: match[2].trim(),
      position: match.index,
    });
  }

  return hints;
}

/**
 * Convert English pronunciation guidance to approximate IPA
 *
 * NOTE: This is a simplified heuristic converter. For production use,
 * this should be replaced with LLM-based IPA generation or a comprehensive
 * pronunciation-to-IPA mapping database.
 *
 * @param pronunciation - English pronunciation guidance (e.g., "mix-trahl")
 * @returns Approximate IPA transcription
 */
function convertPronunciationToIPA(pronunciation: string): string {
  // Simple heuristic mapping of common patterns
  // This is NOT comprehensive and should be replaced with proper IPA conversion
  return (
    pronunciation
      .toLowerCase()
      // Common vowel sounds
      .replace(/ah/g, 'ɑː')
      .replace(/ay/g, 'eɪ')
      .replace(/ee/g, 'iː')
      .replace(/eye/g, 'aɪ')
      .replace(/oh/g, 'oʊ')
      .replace(/oo/g, 'uː')
      .replace(/uh/g, 'ʌ')
      // Common consonants
      .replace(/sh/g, 'ʃ')
      .replace(/ch/g, 'tʃ')
      .replace(/th/g, 'θ')
      .replace(/zh/g, 'ʒ')
      .replace(/ng/g, 'ŋ')
      // Remove hyphens used for syllable separation
      .replace(/-/g, '')
  );
}

/**
 * Process pronunciation hints and add to pronunciations map
 *
 * Converts hints to pronunciation entries with IPA phonemes.
 * If a term already exists in the map, the existing entry is used.
 *
 * @param hints - Parsed pronunciation hints
 * @param pronunciations - Existing pronunciations map (will be mutated)
 */
function processPronunciationHints(
  hints: PronunciationHint[],
  pronunciations: Map<string, PronunciationEntry>
): void {
  for (const hint of hints) {
    const termKey = hint.term.toLowerCase();

    // Skip if term already has a pronunciation entry
    if (pronunciations.has(termKey)) {
      continue;
    }

    // Convert pronunciation guidance to IPA (approximate)
    const ipa = convertPronunciationToIPA(hint.pronunciation);

    // Create temporary pronunciation entry from hint
    const entry: PronunciationEntry = {
      term: termKey,
      ipa,
      ssml: `<phoneme alphabet="ipa" ph="${ipa}">${hint.term}</phoneme>`,
      verified: false, // Mark as unverified since it's from hint
      source: 'inline-hint',
      usageCount: 0,
      lastUsed: null,
      addedDate: new Date().toISOString().split('T')[0],
    };

    pronunciations.set(termKey, entry);
  }
}

/**
 * Escape special regex characters in a string
 *
 * Allows using user input safely in regex patterns.
 *
 * @param str - String to escape
 * @returns Regex-safe string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
}

/**
 * Escape XML in content while preserving SSML phoneme tags
 *
 * Splits text into SSML tags and plain text, escaping only the plain text portions.
 *
 * @param text - Text with SSML tags
 * @returns XML-escaped text with valid SSML tags
 */
function escapeXmlPreservingSSML(text: string): string {
  const tagRegex = /<phoneme[^>]*>.*?<\/phoneme>/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    // Escape text before this tag
    const beforeTag = text.substring(lastIndex, match.index);
    result += escapeXml(beforeTag);

    // Add the SSML tag as-is (already valid XML)
    result += match[0];

    lastIndex = match.index + match[0].length;
  }

  // Escape remaining text after last tag
  result += escapeXml(text.substring(lastIndex));

  return result;
}

/**
 * Generate SSML phoneme tag for a term
 *
 * @param term - Original term (preserves case)
 * @param ipa - IPA phonetic transcription
 * @returns SSML phoneme tag
 */
function generateSSMLTag(term: string, ipa: string): string {
  return `<phoneme alphabet="ipa" ph="${ipa}">${term}</phoneme>`;
}

/**
 * Tag script with SSML pronunciation markup
 *
 * Processes script to add SSML phoneme tags for technical terms using
 * pronunciation dictionary entries. Implements:
 * - Longest-first term sorting to prevent partial replacements
 * - Word boundary regex for safe matching
 * - Case-insensitive matching with original case preservation
 * - XML escaping for content (not SSML tags)
 * - Visual cue and structure preservation
 *
 * @param script - Original script text
 * @param pronunciations - Map of term (lowercase) to pronunciation entry
 * @param options - Tagging options
 * @returns SSML-tagged script
 */
export function tagScript(
  script: string,
  pronunciations: Map<string, PronunciationEntry>,
  options: SSMLTagOptions = {}
): string {
  if (!script || script.length === 0) {
    return '';
  }

  let processedScript = script;

  // Step 1: Process pronunciation hints if requested
  if (options.processHints) {
    const hints = parsePronunciationHints(processedScript);

    // Add hints to pronunciations map (converts pronunciation guidance to IPA)
    processPronunciationHints(hints, pronunciations);

    // Remove hint tags from script, leaving the term itself
    // The term will be matched and tagged in subsequent steps
    for (const hint of hints) {
      // Create a specific regex that matches this exact hint
      const escapedTerm = hint.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedPronunciation = hint.pronunciation.replace(/"/g, '\\"');
      const hintPattern = new RegExp(
        `\\[PRONOUNCE:\\s*${escapedTerm}\\s*=\\s*"${escapedPronunciation}"\\s*\\]`,
        'g'
      );
      processedScript = processedScript.replace(hintPattern, hint.term);
    }
  }

  // Step 2: Sort terms by length (longest first) to prevent partial replacements
  const sortedTerms = Array.from(pronunciations.keys()).sort((a, b) => b.length - a.length);

  // Step 3: Replace terms with SSML tags (on unescaped content)
  let taggedScript = processedScript;

  for (const termKey of sortedTerms) {
    const entry = pronunciations.get(termKey);
    if (!entry) continue;

    // Escape the term for use in regex, handling special characters properly
    const escapedTerm = escapeRegExp(termKey);

    // Build regex that matches term but NOT when it's inside an SSML tag
    // For terms with special characters (like C++ or C#), word boundaries won't work
    // So we use a more flexible approach: match if surrounded by whitespace, punctuation, or string boundaries
    const hasOnlyWordChars = /^[A-Za-z0-9_-]+$/.test(termKey);
    const regex = hasOnlyWordChars
      ? new RegExp(`\\b${escapedTerm}\\b`, 'gi')
      : new RegExp(`(?<=^|[\\s,.:;!?()\\[\\]{}\"'<>])${escapedTerm}(?=$|[\\s,.:;!?()\\[\\]{}\"'<>])`, 'gi');

    // Find all existing SSML tags to avoid replacing inside them
    const tagRegex = /<phoneme[^>]*>.*?<\/phoneme>/g;
    let tagMatch: RegExpExecArray | null;

    const existingTags: Array<{ start: number; end: number; text: string }> = [];
    while ((tagMatch = tagRegex.exec(taggedScript)) !== null) {
      existingTags.push({
        start: tagMatch.index,
        end: tagMatch.index + tagMatch[0].length,
        text: tagMatch[0],
      });
    }

    // If no existing tags, just do the replacement
    if (existingTags.length === 0) {
      taggedScript = taggedScript.replace(regex, (match) => {
        return generateSSMLTag(match, entry.ipa);
      });
    } else {
      // Process text between tags
      let result = '';
      let currentPos = 0;

      for (const tag of existingTags) {
        // Process text before this tag
        const beforeTag = taggedScript.substring(currentPos, tag.start);
        const processedBefore = beforeTag.replace(regex, (match) => {
          return generateSSMLTag(match, entry.ipa);
        });

        result += processedBefore + tag.text;
        currentPos = tag.end;
      }

      // Process remaining text after last tag
      const afterLastTag = taggedScript.substring(currentPos);
      const processedAfter = afterLastTag.replace(regex, (match) => {
        return generateSSMLTag(match, entry.ipa);
      });

      result += processedAfter;
      taggedScript = result;
    }
  }

  // Step 4: Escape XML special characters in content while preserving SSML tags
  return escapeXmlPreservingSSML(taggedScript);
}
