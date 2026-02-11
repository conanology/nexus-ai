/**
 * Director Agent User Prompt Builder
 *
 * Constructs the user message from parsed script segments for the LLM.
 *
 * @module @nexus-ai/director-agent/prompts/director-user
 */

import type { ScriptSegment } from '../types.js';

/**
 * Builds the user prompt that presents script segments for classification.
 *
 * @param segments - Parsed script segments with frame timings
 * @returns Formatted prompt string
 */
export function buildDirectorUserPrompt(segments: ScriptSegment[]): string {
  if (segments.length === 0) {
    return 'No segments to classify. Return an empty JSON array: []';
  }

  const segmentLines = segments
    .map(
      (seg) =>
        `[Segment ${seg.index}] (frames ${seg.startFrame}-${seg.endFrame}):\n"${seg.text}"`,
    )
    .join('\n\n');

  return `Analyze these script segments and assign scene types with visual data for each:

${segmentLines}

Respond with a JSON array of exactly ${segments.length} objects (one per segment).
Remember: first segment MUST be "intro", last segment MUST be "outro".
Any numbers/stats MUST use "stat-callout". Any company names MUST use "logo-showcase".`;
}
