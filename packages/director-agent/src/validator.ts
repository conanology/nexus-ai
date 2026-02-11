/**
 * Scene Validator
 *
 * Enforces Section 7.4 Director Rules on classified scenes.
 * Repairs violations where specified, warns on others.
 *
 * @module @nexus-ai/director-agent/validator
 */

import type { ClassifiedSegment, SceneType } from './types.js';
import { VISUAL_DATA_SCHEMAS } from './types.js';

// =============================================================================
// Constants
// =============================================================================

/** Minimum segment duration in frames (3 seconds at 30fps) */
const MIN_SCENE_FRAMES = 90;

/** Regex to detect numbers > 100 or percentages in text */
const STAT_PATTERN = /\b\d{3,}[\d,.]*/g;
const PERCENTAGE_PATTERN = /\b\d+(\.\d+)?%/g;
const MONEY_PATTERN = /[$€£]\s?\d+/g;

// =============================================================================
// Validation Result
// =============================================================================

export interface ValidationResult {
  scenes: ClassifiedSegment[];
  warnings: string[];
}

// =============================================================================
// Rule Enforcers
// =============================================================================

/**
 * Rule: No more than 2 consecutive segments with the same scene type.
 * If violated, changes the middle one to 'narration-default' or 'text-emphasis'.
 *
 * Auto-repairs and warns.
 */
function enforceNoTripleRepetition(scenes: ClassifiedSegment[]): string[] {
  const warnings: string[] = [];

  for (let i = 1; i < scenes.length - 1; i++) {
    if (
      scenes[i - 1].sceneType === scenes[i].sceneType &&
      scenes[i].sceneType === scenes[i + 1].sceneType
    ) {
      const original = scenes[i].sceneType;

      // Choose a replacement that breaks the pattern
      const replacement: SceneType =
        original === 'narration-default' ? 'text-emphasis' : 'narration-default';

      scenes[i] = {
        ...scenes[i],
        sceneType: replacement,
        visualData:
          replacement === 'text-emphasis'
            ? {
                phrase: scenes[i].text.slice(0, 80),
                style: 'fade' as const,
              }
            : { backgroundVariant: 'gradient' as const },
      };

      warnings.push(
        `Scene ${i}: Changed from "${original}" to "${replacement}" to avoid 3 consecutive "${original}" scenes.`,
      );
    }
  }

  return warnings;
}

/**
 * Rule: First scene must be 'intro', last scene must be 'outro'.
 *
 * Auto-repairs and warns.
 */
function enforceBookends(scenes: ClassifiedSegment[]): string[] {
  const warnings: string[] = [];

  if (scenes.length === 0) return warnings;

  if (scenes[0].sceneType !== 'intro') {
    const original = scenes[0].sceneType;
    scenes[0] = {
      ...scenes[0],
      sceneType: 'intro',
      visualData: {},
    };
    warnings.push(
      `Scene 0: Forced to "intro" (was "${original}"). First scene must always be intro.`,
    );
  }

  if (scenes.length > 1 && scenes[scenes.length - 1].sceneType !== 'outro') {
    const lastIdx = scenes.length - 1;
    const original = scenes[lastIdx].sceneType;
    scenes[lastIdx] = {
      ...scenes[lastIdx],
      sceneType: 'outro',
      visualData: {},
    };
    warnings.push(
      `Scene ${lastIdx}: Forced to "outro" (was "${original}"). Last scene must always be outro.`,
    );
  }

  return warnings;
}

/**
 * Rule: Segments containing numbers > 100 or percentages should use 'stat-callout'.
 *
 * Warns but does NOT auto-change (per spec — "don't auto-change, just warn").
 */
function checkStatUsage(scenes: ClassifiedSegment[]): string[] {
  const warnings: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Skip intro/outro — they have special purposes
    if (scene.sceneType === 'intro' || scene.sceneType === 'outro') continue;
    if (scene.sceneType === 'stat-callout') continue;

    const hasLargeNumber = STAT_PATTERN.test(scene.text);
    STAT_PATTERN.lastIndex = 0; // Reset regex state

    const hasPercentage = PERCENTAGE_PATTERN.test(scene.text);
    PERCENTAGE_PATTERN.lastIndex = 0;

    const hasMoney = MONEY_PATTERN.test(scene.text);
    MONEY_PATTERN.lastIndex = 0;

    if (hasLargeNumber || hasPercentage || hasMoney) {
      warnings.push(
        `Scene ${i}: Contains numeric data but uses "${scene.sceneType}" instead of "stat-callout". Consider changing to stat-callout.`,
      );
    }
  }

  return warnings;
}

/**
 * Rule: Any scene shorter than MIN_SCENE_FRAMES gets a warning.
 */
function checkMinDuration(scenes: ClassifiedSegment[]): string[] {
  const warnings: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const duration = scenes[i].endFrame - scenes[i].startFrame;
    if (duration < MIN_SCENE_FRAMES) {
      warnings.push(
        `Scene ${i}: Duration is ${duration} frames (${(duration / 30).toFixed(1)}s), below minimum of ${MIN_SCENE_FRAMES} frames (3s).`,
      );
    }
  }

  return warnings;
}

/**
 * Rule: If > 50% of scenes are the same type, warn about visual monotony.
 */
function checkVariety(scenes: ClassifiedSegment[]): string[] {
  const warnings: string[] = [];

  if (scenes.length < 4) return warnings; // Not meaningful for very short sequences

  const counts = new Map<SceneType, number>();
  for (const scene of scenes) {
    counts.set(scene.sceneType, (counts.get(scene.sceneType) ?? 0) + 1);
  }

  for (const [type, count] of counts) {
    const percentage = count / scenes.length;
    if (percentage > 0.5) {
      warnings.push(
        `Visual monotony: ${count}/${scenes.length} scenes (${(percentage * 100).toFixed(0)}%) use "${type}". Consider more variety.`,
      );
    }
  }

  return warnings;
}

/**
 * Validates visualData for each scene against its Zod schema.
 * Repairs invalid data with sensible defaults.
 */
function validateVisualData(scenes: ClassifiedSegment[]): string[] {
  const warnings: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const schema = VISUAL_DATA_SCHEMAS[scene.sceneType];

    if (!schema) continue;

    const result = schema.safeParse(scene.visualData);
    if (!result.success) {
      warnings.push(
        `Scene ${i}: visualData for "${scene.sceneType}" failed validation. Applied defaults. Issues: ${result.error.issues.map((issue) => issue.message).join(', ')}`,
      );

      // Apply type-appropriate defaults
      scenes[i] = {
        ...scenes[i],
        visualData: getDefaultVisualData(scene.sceneType, scene.text),
      };
    }
  }

  return warnings;
}

/**
 * Generates reasonable default visualData for a given scene type.
 */
function getDefaultVisualData(
  sceneType: SceneType,
  text: string,
): Record<string, unknown> {
  switch (sceneType) {
    case 'intro':
      return {};
    case 'chapter-break':
      return { title: text.slice(0, 50) };
    case 'narration-default':
      return { backgroundVariant: 'gradient' };
    case 'text-emphasis':
      return { phrase: text.slice(0, 80), style: 'fade' };
    case 'full-screen-text':
      return { text: text.slice(0, 120), alignment: 'center' };
    case 'stat-callout':
      return { number: '0', label: text.slice(0, 40), countUp: true };
    case 'comparison':
      return {
        left: { title: 'Before', items: ['Item 1'] },
        right: { title: 'After', items: ['Item 1'] },
      };
    case 'diagram':
      return {
        nodes: [
          { id: 'a', label: 'Start' },
          { id: 'b', label: 'End' },
        ],
        edges: [{ from: 'a', to: 'b' }],
        layout: 'horizontal',
      };
    case 'logo-showcase':
      return { logos: [{ name: 'Brand' }], layout: 'sequential' };
    case 'timeline':
      return { events: [{ year: '2024', label: text.slice(0, 40) }] };
    case 'quote':
      return { text: text.slice(0, 100), attribution: 'Unknown' };
    case 'list-reveal':
      return { items: [text.slice(0, 60)], style: 'bullet' };
    case 'code-block':
      return { code: '// code', language: 'javascript' };
    case 'outro':
      return {};
    default:
      return { backgroundVariant: 'gradient' };
  }
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Validates classified scenes against Section 7.4 Director Rules.
 *
 * Enforcement behavior:
 * - Triple repetition: AUTO-REPAIR (changes middle scene + warns)
 * - Bookends (intro/outro): AUTO-REPAIR (forces correct type + warns)
 * - Stats not using stat-callout: WARN ONLY
 * - Short scene duration: WARN ONLY
 * - Visual monotony (>50% same type): WARN ONLY
 * - Invalid visualData: AUTO-REPAIR with defaults + warns
 *
 * @param scenes - Classified segments from the scene classifier
 * @returns Validated/repaired scenes and accumulated warnings
 */
export function validateScenes(scenes: ClassifiedSegment[]): ValidationResult {
  if (scenes.length === 0) {
    return { scenes: [], warnings: [] };
  }

  // Clone to avoid mutating the input
  const repaired = scenes.map((s) => ({ ...s, visualData: { ...s.visualData } }));

  const warnings: string[] = [];

  // Order matters: bookends first, then content rules, then quality checks
  warnings.push(...enforceBookends(repaired));
  warnings.push(...enforceNoTripleRepetition(repaired));
  warnings.push(...validateVisualData(repaired));
  warnings.push(...checkStatUsage(repaired));
  warnings.push(...checkMinDuration(repaired));
  warnings.push(...checkVariety(repaired));

  return { scenes: repaired, warnings };
}
