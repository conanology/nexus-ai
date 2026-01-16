/**
 * Term extraction logic for pronunciation dictionary
 *
 * Extracts technical terms, names, acronyms, and explicitly tagged terms
 * from scripts for pronunciation validation.
 *
 * @module @nexus-ai/pronunciation/extractor
 */

/**
 * Extracted term with context
 */
export interface ExtractedTerm {
  /** The extracted term */
  term: string;
  /** Sentence or paragraph context where term was found */
  context: string;
}

/**
 * Options for term extraction
 */
export interface ExtractTermsOptions {
  /** Whether to include sentence context for each term */
  includeContext?: boolean;
}

/**
 * Extract terms explicitly tagged with [PRONOUNCE: ...] hints
 *
 * @param text - Script text to process
 * @returns Array of term strings from PRONOUNCE hints
 */
export function extractPronounceHints(text: string): string[] {
  const hints: string[] = [];
  const regex = /\[PRONOUNCE:\s*([^\]]+?)\s*\]/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    hints.push(match[1].trim());
  }

  return hints;
}

/**
 * Check if a match is at the start of a sentence
 */
function isAtSentenceStart(text: string, matchIndex: number): boolean {
  if (matchIndex === 0) return true;

  // Get text before the match
  const before = text.substring(0, matchIndex).trim();

  // Check if there's a sentence terminator before this position
  const lastSentenceEnd = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?')
  );

  // If no sentence terminator found, check if there's meaningful text before
  if (lastSentenceEnd === -1) {
    // This is the first sentence - only true start if no words before
    const words = before.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length === 0;
  }

  // Check what's between the sentence terminator and the match
  const betweenText = before.substring(lastSentenceEnd + 1).trim();

  // If there's only whitespace or quotes, it's sentence start
  // Otherwise check if it's just punctuation or a single word
  if (betweenText.length === 0 || betweenText.match(/^["'(\s]*$/) !== null) {
    return true;
  }

  // Count words - if only quotes and no words, it's sentence start
  const words = betweenText.split(/\s+/).filter(w => w.length > 0 && !w.match(/^["'()]+$/));
  return words.length === 0;
}

/**
 * Extract potential technical terms from script text
 *
 * Identifies:
 * - Capitalized words not at sentence start
 * - CamelCase/PascalCase terms (e.g., "PyTorch", "HuggingFace")
 * - Acronyms (e.g., "RLHF", "LLM")
 * - Terms containing numbers (e.g., "GPT-4")
 * - Terms explicitly tagged with [PRONOUNCE: ...]
 *
 * @param text - Script text to process
 * @param options - Extraction options
 * @returns Array of unique terms or terms with context
 */
export function extractTerms(text: string, options?: { includeContext: true }): ExtractedTerm[];
export function extractTerms(text: string, options?: { includeContext?: false }): string[];
export function extractTerms(
  text: string,
  options?: ExtractTermsOptions
): string[] | ExtractedTerm[] {
  const includeContext = options?.includeContext ?? false;
  const termsWithContext: ExtractedTerm[] = [];
  const termsMap = new Map<string, Set<string>>(); // term -> set of contexts

  // Split text into sentences for context extraction (preserve punctuation)
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentences: string[] = [];
  let sentenceMatch: RegExpExecArray | null;

  while ((sentenceMatch = sentenceRegex.exec(text)) !== null) {
    sentences.push(sentenceMatch[0].trim());
  }

  // If no sentences found (no punctuation), treat entire text as one sentence
  if (sentences.length === 0 && text.trim().length > 0) {
    sentences.push(text.trim());
  }

  // Extract PRONOUNCE hints first
  const hints = extractPronounceHints(text);
  for (const hint of hints) {
    // Find sentence containing this hint
    for (const sentence of sentences) {
      if (sentence.includes(`[PRONOUNCE: ${hint}]`) || sentence.includes(hint)) {
        if (includeContext) {
          termsWithContext.push({ term: hint, context: sentence });
        } else {
          if (!termsMap.has(hint)) {
            termsMap.set(hint, new Set());
          }
        }
        break;
      }
    }
  }

  // Patterns to match technical terms (order matters - more specific first)
  const patterns = [
    // Terms with numbers and suffixes: GPT-4, GPT-3.5-turbo, LLaMA-2 (MOST SPECIFIC)
    { regex: /\b([A-Z][a-zA-Z]*-\d+(?:\.\d+)?(?:-[a-z0-9]+)?)\b/g, name: 'with-numbers' },
    // CamelCase/PascalCase: PyTorch, HuggingFace, TensorFlow
    { regex: /\b([A-Z][a-z]+[A-Z][a-zA-Z]*)\b/g, name: 'camelcase' },
    // Acronyms: RLHF, LLM, GPT (2+ uppercase letters)
    { regex: /\b([A-Z]{2,})\b/g, name: 'acronym' },
    // Capitalized technical names: Llama, Gemini (MOST GENERAL)
    { regex: /\b([A-Z][a-z]+)\b/g, name: 'capitalized' },
  ];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // Track matched positions to avoid overlapping matches
    const matchedRanges: Array<{ start: number; end: number }> = [];

    for (const { regex } of patterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(trimmed)) !== null) {
        const term = match[1];
        const matchIndex = match.index;
        const matchEnd = matchIndex + term.length;

        // Skip if at sentence start
        if (isAtSentenceStart(trimmed, matchIndex)) {
          continue;
        }

        // Skip if this position was already matched by a more specific pattern
        const overlaps = matchedRanges.some(
          (range) => matchIndex >= range.start && matchIndex < range.end
        );
        if (overlaps) {
          continue;
        }

        // Record this match
        matchedRanges.push({ start: matchIndex, end: matchEnd });

        if (includeContext) {
          termsWithContext.push({ term, context: trimmed });
        } else {
          if (!termsMap.has(term)) {
            termsMap.set(term, new Set());
          }
          termsMap.get(term)!.add(trimmed);
        }
      }
    }
  }

  if (includeContext) {
    return termsWithContext;
  }

  return Array.from(termsMap.keys());
}

/**
 * Extract context (sentence or paragraph) for a specific term
 *
 * @param text - Full script text
 * @param term - Term to find context for
 * @returns Context string (sentence containing the term)
 */
export function extractContext(text: string, term: string): string {
  // Split into sentences
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentences: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push(match[0].trim());
  }

  // Find first sentence containing the term
  for (const sentence of sentences) {
    if (sentence.includes(term)) {
      return sentence;
    }
  }

  // Fallback: return a portion of text around the term
  const index = text.indexOf(term);
  if (index === -1) return '';

  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + term.length + 50);
  return text.substring(start, end).trim();
}
