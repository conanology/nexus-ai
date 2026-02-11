/**
 * Meme Selector — "taste engine" that decides IF and WHAT meme to insert.
 *
 * Analyzes scene content and context to determine whether a reaction meme
 * should appear after a given scene, and which reaction type to use.
 *
 * @module @nexus-ai/asset-library/meme/meme-selector
 */

import { getReactionQuery } from './meme-fetcher.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemeSelection {
  reactionType: string;
  searchQuery: string;
}

export interface MemeContext {
  /** Whether the previous scene was already a meme */
  previousWasMeme: boolean;
  /** How many memes have already been assigned in this video */
  totalMemeCount: number;
  /** The scene index in the original array (for deterministic query selection) */
  sceneIndex: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MEMES_PER_VIDEO = 5;
const MIN_SCENE_FRAMES = 120;

/** Scene types that never get memes after them */
const EXCLUDED_SCENE_TYPES = new Set([
  'intro',
  'outro',
  'chapter-break',
  'quote',
  'meme-reaction',
]);

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function parseLargeNumber(text: string): number | null {
  // Match patterns like "700", "2.3M", "$1.5 billion", "85%"
  const match = text.match(/[\d,.]+\s*(?:million|billion|trillion|M|B|T|K)?/i);
  if (!match) return null;

  let raw = match[0].replace(/[,$\s]/g, '');
  let multiplier = 1;

  if (/billion|B$/i.test(raw)) {
    multiplier = 1_000_000_000;
    raw = raw.replace(/billion|B$/i, '');
  } else if (/million|M$/i.test(raw)) {
    multiplier = 1_000_000;
    raw = raw.replace(/million|M$/i, '');
  } else if (/trillion|T$/i.test(raw)) {
    multiplier = 1_000_000_000_000;
    raw = raw.replace(/trillion|T$/i, '');
  } else if (/K$/i.test(raw)) {
    multiplier = 1_000;
    raw = raw.replace(/K$/i, '');
  }

  const num = parseFloat(raw);
  return isNaN(num) ? null : num * multiplier;
}

function containsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Decide if a meme reaction should be inserted after a scene.
 *
 * @param sceneText    The scene's content text
 * @param sceneType    The scene's type string
 * @param sceneDurationFrames  The scene's duration in frames
 * @param context      Meme insertion context (previous meme state, counts)
 * @param stat         Optional stat data from stat-callout scenes
 * @returns MemeSelection with reaction type and search query, or null if no meme
 */
export function selectMemeReaction(
  sceneText: string,
  sceneType: string,
  sceneDurationFrames: number,
  context: MemeContext,
  stat?: { number: string; label: string },
): MemeSelection | null {
  // --- Guard clauses ---

  // Never for excluded scene types
  if (EXCLUDED_SCENE_TYPES.has(sceneType)) return null;

  // No back-to-back memes
  if (context.previousWasMeme) return null;

  // Max memes per video
  if (context.totalMemeCount >= MAX_MEMES_PER_VIDEO) return null;

  // Scene too short
  if (sceneDurationFrames < MIN_SCENE_FRAMES) return null;

  // --- Reaction type detection ---
  const lower = sceneText.toLowerCase();
  let reactionType: string | null = null;

  // 1. Stat-callout with large numbers
  if (sceneType === 'stat-callout' && stat) {
    const num = parseLargeNumber(stat.number);

    // Check money keywords first (revenue/funding + large numbers)
    if (containsAny(lower, ['revenue', 'funding', 'valuation', 'raised', 'worth', 'profit', 'sales'])) {
      if (num !== null && num > 500) {
        reactionType = 'money';
      }
    }

    // Destruction/replacement language
    if (!reactionType && num !== null && num > 500) {
      if (containsAny(sceneText, ['replaced', 'eliminated', 'killed', 'destroyed', 'cut', 'laid off'])) {
        reactionType = 'rip';
      }
    }

    // Generic large number → mind blown
    if (!reactionType && num !== null && num > 500) {
      reactionType = 'mind_blown';
    }

    // "million" or "billion" in text without a parsed stat
    if (!reactionType && containsAny(lower, ['million', 'billion', 'trillion'])) {
      if (containsAny(lower, ['revenue', 'funding', 'valuation', 'raised', 'worth', 'profit', 'sales'])) {
        reactionType = 'money';
      } else {
        reactionType = 'mind_blown';
      }
    }
  }

  // 2. Replacement / destruction language (non-stat scenes)
  if (!reactionType && containsAny(sceneText, ['replaced', 'eliminated', 'killed', 'destroyed'])) {
    if (containsAny(lower, ['job', 'agent', 'worker', 'employee', 'company', 'compan'])) {
      reactionType = 'rip';
    }
  }

  // 3. Shock / disbelief language
  if (!reactionType && containsAny(lower, ['staggering', 'insane', 'unbelievable', 'unprecedented', 'jaw-dropping'])) {
    reactionType = 'shocked';
  }

  // 4. Money / revenue with large numbers
  if (!reactionType && containsAny(lower, ['revenue', 'funding', 'valuation', 'raised', 'billion', 'million'])) {
    const num = parseLargeNumber(sceneText);
    if (num !== null && num > 1_000_000) {
      reactionType = 'money';
    }
  }

  // 5. Ironic / contradictory statements
  if (!reactionType && containsAny(lower, ['but', 'however', 'yet', 'ironically', 'unfortunately'])) {
    if (containsAny(lower, ['fail', 'crash', 'broke', 'wrong', 'disaster', 'backfir', 'worse'])) {
      reactionType = 'this_is_fine';
    }
  }

  // 6. Speed / rapid change
  if (!reactionType && containsAny(lower, ['overnight', 'in just', 'within days', 'within hours', 'in mere'])) {
    reactionType = 'speed';
  }

  // 7. Comparison where new is dramatically better
  if (!reactionType && sceneType === 'comparison') {
    if (containsAny(lower, ['better', 'faster', 'cheaper', 'superior', 'outperform'])) {
      reactionType = 'impressed';
    }
  }

  // No reaction matched
  if (!reactionType) return null;

  return {
    reactionType,
    searchQuery: getReactionQuery(reactionType, context.sceneIndex),
  };
}
