/**
 * Cold Open Hook Extractor
 *
 * Scans classified scenes to find the single most compelling stat or statement
 * for use as a cold open before the intro sequence.
 *
 * Priority order:
 * 1. Big stat (stat-callout scenes scored by magnitude + keywords)
 * 2. Dramatic statement (text-emphasis scenes with power words)
 * 3. null (no suitable hook — go straight to intro)
 *
 * @module @nexus-ai/director-agent/hook-extractor
 */

import type {
  Scene,
  StatCalloutVisualData,
  TextEmphasisVisualData,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface ColdOpenHook {
  /** The compelling statement to display */
  text: string;
  /** How to render it */
  sceneType: 'stat-callout' | 'text-emphasis';
  /** Ready-to-use visualData for the scene component */
  visualData: StatCalloutVisualData | TextEmphasisVisualData;
  /** Which scene this was extracted from (index in the scenes array) */
  sourceSceneIndex: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum score for a stat to qualify as a cold open hook */
const MIN_STAT_SCORE = 6;

/** Maximum words for a cold open text */
const MAX_HOOK_WORDS = 15;

/** Keywords that indicate dramatic disruption — +3 bonus */
const DISRUPTION_KEYWORDS = [
  'replaced',
  'eliminated',
  'killed',
  'disrupted',
  'destroyed',
  'wiped out',
  'obsolete',
];

/** Keywords that indicate financial impact — +2 bonus */
const FINANCIAL_KEYWORDS = [
  'revenue',
  'profit',
  'funding',
  'valuation',
  'billion',
  'million',
  'worth',
];

/** Dramatic phrases that qualify text-emphasis scenes */
const DRAMATIC_PHRASES = [
  'biggest',
  'largest',
  'first ever',
  'unprecedented',
  'never before',
  'end of',
  'death of',
  'collapse of',
  'revolution',
  'disruption',
  'transformation',
];

// =============================================================================
// Stat Scoring
// =============================================================================

/**
 * Extracts the raw numeric value from a stat number string.
 * Handles: "700", "2.3M", "2,300,000", "$85", "1.5B", etc.
 */
function parseNumericValue(numStr: string): number {
  // Strip prefix chars ($, €, etc.) and commas
  const cleaned = numStr.replace(/[$€£,]/g, '').trim();

  // Check for M/B suffix multipliers
  const multiplierMatch = cleaned.match(/^([\d.]+)\s*([MBKmb])/);
  if (multiplierMatch) {
    const base = parseFloat(multiplierMatch[1]);
    const suffix = multiplierMatch[2].toUpperCase();
    if (suffix === 'B') return base * 1_000_000_000;
    if (suffix === 'M') return base * 1_000_000;
    if (suffix === 'K') return base * 1_000;
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Scores a stat-callout scene for cold open potential.
 *
 * Scoring:
 * - Number > 1,000,000 or label contains "million"/"billion" → 10
 * - Number > 10,000 → 8
 * - Number > 1,000 → 6
 * - Number > 100 → 4
 * - Has comparison → +2
 * - Label contains disruption keywords → +3
 * - Label contains financial keywords → +2
 */
function scoreStatScene(visualData: StatCalloutVisualData): number {
  const numericValue = parseNumericValue(visualData.number);
  const labelLower = visualData.label.toLowerCase();
  const fullText = `${visualData.number} ${visualData.label}`.toLowerCase();

  // Base score from magnitude
  let score = 0;
  if (
    numericValue > 1_000_000 ||
    fullText.includes('million') ||
    fullText.includes('billion')
  ) {
    score = 10;
  } else if (numericValue > 10_000) {
    score = 8;
  } else if (numericValue > 1_000) {
    score = 6;
  } else if (numericValue > 100) {
    score = 4;
  }

  // Comparison bonus
  if (visualData.comparison) {
    score += 2;
  }

  // Disruption keyword bonus
  if (DISRUPTION_KEYWORDS.some((kw) => labelLower.includes(kw))) {
    score += 3;
  }

  // Financial keyword bonus
  if (FINANCIAL_KEYWORDS.some((kw) => fullText.includes(kw))) {
    score += 2;
  }

  return score;
}

// =============================================================================
// Text Trimming
// =============================================================================

/**
 * Trims text to max N words, ending at a natural break.
 */
function trimToMaxWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  const trimmed = words.slice(0, maxWords).join(' ');

  // Try to end at punctuation if possible
  const lastPunctuation = trimmed.search(/[.!?,;—](?=[^.!?,;—]*$)/);
  if (lastPunctuation > trimmed.length * 0.6) {
    return trimmed.slice(0, lastPunctuation + 1);
  }

  return trimmed;
}

/**
 * Builds a short hook text from a stat scene.
 * Format: "{number} {label}" or "{prefix}{number}{suffix} {label}"
 */
function buildStatHookText(visualData: StatCalloutVisualData): string {
  const parts: string[] = [];

  if (visualData.prefix) parts.push(visualData.prefix);
  parts.push(visualData.number);
  if (visualData.suffix) parts.push(visualData.suffix);

  return trimToMaxWords(`${parts.join('')} ${visualData.label}`, MAX_HOOK_WORDS);
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Extracts the most compelling hook from classified scenes for a cold open.
 *
 * @param script - The full script text (unused currently, reserved for future NLP)
 * @param scenes - Classified scenes from the director pipeline
 * @returns ColdOpenHook if a suitable hook was found, null otherwise
 */
export function extractColdOpenHook(
  _script: string,
  scenes: Scene[],
): ColdOpenHook | null {
  // --- Strategy A: Big stat priority ---
  let bestStatScore = 0;
  let bestStatIndex = -1;
  let bestStatData: StatCalloutVisualData | null = null;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.type !== 'stat-callout') continue;

    const visualData = scene.visualData as StatCalloutVisualData;
    const score = scoreStatScene(visualData);

    if (score > bestStatScore) {
      bestStatScore = score;
      bestStatIndex = i;
      bestStatData = visualData;
    }
  }

  if (bestStatScore >= MIN_STAT_SCORE && bestStatData) {
    return {
      text: buildStatHookText(bestStatData),
      sceneType: 'stat-callout',
      visualData: {
        number: bestStatData.number,
        label: bestStatData.label,
        prefix: bestStatData.prefix,
        suffix: bestStatData.suffix,
        countUp: false, // No count-up in cold open — number appears instantly
      },
      sourceSceneIndex: bestStatIndex,
    };
  }

  // --- Strategy B: Dramatic statement ---
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.type !== 'text-emphasis') continue;

    const visualData = scene.visualData as TextEmphasisVisualData;
    const phraseLower = visualData.phrase.toLowerCase();

    const isDramatic = DRAMATIC_PHRASES.some((dp) => phraseLower.includes(dp));
    if (isDramatic) {
      const trimmedPhrase = trimToMaxWords(visualData.phrase, MAX_HOOK_WORDS);
      return {
        text: trimmedPhrase,
        sceneType: 'text-emphasis',
        visualData: {
          phrase: trimmedPhrase,
          highlightWords: visualData.highlightWords,
          style: 'slam', // Always slam for cold open — punchy
        },
        sourceSceneIndex: i,
      };
    }
  }

  // --- Strategy C: No suitable hook ---
  return null;
}
