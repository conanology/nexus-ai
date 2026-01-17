/**
 * Visual cue parser implementation
 * Extracts [VISUAL: description] markers from script text
 */

import type { VisualCue } from './types.js';

/**
 * Regex pattern to match visual cue markers
 * Matches: [VISUAL: description] (case-insensitive)
 */
const VISUAL_CUE_PATTERN = /\[visual:\s*([^\]]+?)\]/gi;

/**
 * Parse visual cues from script text
 * @param script - Script text containing visual cue markers
 * @returns Array of parsed visual cues
 */
export function parseVisualCues(script: string): VisualCue[] {
  const cues: VisualCue[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  // Reset regex state
  VISUAL_CUE_PATTERN.lastIndex = 0;

  while ((match = VISUAL_CUE_PATTERN.exec(script)) !== null) {
    const description = match[1].trim();

    // Skip empty descriptions
    if (!description) {
      continue;
    }

    cues.push({
      index: index++,
      description,
      context: script,
      position: match.index
    });
  }

  return cues;
}
