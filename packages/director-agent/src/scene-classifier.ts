/**
 * Scene Classifier
 *
 * Uses Gemini LLM to classify script segments into scene types
 * and generate visualData payloads for each.
 *
 * @module @nexus-ai/director-agent/scene-classifier
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  SCENE_TYPES,
  SCENE_PACING_VALUES,
  DEFAULT_SCENE_PACING,
  VISUAL_DATA_SCHEMAS,
  LLMDirectorResponseSchema,
} from './types.js';
import type {
  ScriptSegment,
  ClassifiedSegment,
  SceneType,
  ScenePacing,
  LLMSceneEntry,
} from './types.js';
import { DIRECTOR_SYSTEM_PROMPT } from './prompts/director-system.js';
import { buildDirectorUserPrompt } from './prompts/director-user.js';

// =============================================================================
// Constants
// =============================================================================

const MODEL_NAME = 'gemini-2.5-flash';
const TEMPERATURE = 0.3;
const MAX_OUTPUT_TOKENS = 16384;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validates that a string is a valid SceneType.
 */
function isValidSceneType(value: string): value is SceneType {
  return (SCENE_TYPES as readonly string[]).includes(value);
}

/**
 * Validates that a string is a valid ScenePacing value.
 */
function isValidPacing(value: string): value is ScenePacing {
  return (SCENE_PACING_VALUES as readonly string[]).includes(value);
}

/**
 * Generates default visualData for a scene type when LLM output is invalid.
 */
function defaultVisualData(sceneType: SceneType, segmentText: string): Record<string, unknown> {
  switch (sceneType) {
    case 'intro':
      return {};
    case 'outro':
      return {};
    case 'narration-default':
      return { backgroundVariant: 'gradient' };
    case 'text-emphasis':
      return {
        phrase: segmentText.slice(0, 80),
        style: 'fade',
      };
    case 'full-screen-text':
      return {
        text: segmentText.slice(0, 120),
        alignment: 'center',
      };
    case 'stat-callout':
      return { number: '0', label: 'stat', countUp: true };
    case 'comparison':
      return {
        left: { title: 'Before', items: ['Item 1'] },
        right: { title: 'After', items: ['Item 1'] },
      };
    case 'diagram':
      return {
        nodes: [{ id: 'a', label: 'Start' }, { id: 'b', label: 'End' }],
        edges: [{ from: 'a', to: 'b' }],
        layout: 'horizontal',
      };
    case 'logo-showcase':
      return { logos: [{ name: 'Brand' }], layout: 'sequential' };
    case 'timeline':
      return { events: [{ year: '2024', label: 'Event' }] };
    case 'quote':
      return { text: segmentText.slice(0, 100), attribution: 'Unknown' };
    case 'list-reveal':
      return { items: ['Item 1', 'Item 2'], style: 'bullet' };
    case 'code-block':
      return { code: '// code example', language: 'javascript' };
    case 'chapter-break':
      return { title: 'Next Section' };
    case 'meme-reaction':
      return { gifSrc: '', reactionType: 'shocked', description: 'Reaction meme' };
    case 'map-animation':
      return {
        mapType: 'world',
        highlightedCountries: [],
        animationStyle: 'simultaneous',
      };
    default:
      return { backgroundVariant: 'gradient' };
  }
}

/**
 * Validates and repairs a single LLM scene entry.
 * Returns a valid ClassifiedSegment.
 */
function validateEntry(
  entry: LLMSceneEntry,
  segment: ScriptSegment,
): ClassifiedSegment {
  // Validate scene type
  let sceneType: SceneType;
  if (isValidSceneType(entry.sceneType)) {
    sceneType = entry.sceneType;
  } else {
    sceneType = 'narration-default';
  }

  // Validate visualData against the Zod schema for this scene type
  const schema = VISUAL_DATA_SCHEMAS[sceneType];
  const result = schema.safeParse(entry.visualData);

  let visualData: Record<string, unknown>;
  if (result.success) {
    visualData = result.data as Record<string, unknown>;
  } else {
    // VisualData didn't match schema — use defaults
    visualData = defaultVisualData(sceneType, segment.text);
  }

  // Validate pacing — use default for scene type if missing or invalid
  const pacing: ScenePacing =
    entry.pacing && isValidPacing(entry.pacing)
      ? entry.pacing
      : DEFAULT_SCENE_PACING[sceneType];

  return {
    ...segment,
    sceneType,
    visualData,
    pacing,
  };
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Classifies script segments into scene types using Gemini LLM.
 *
 * @param segments - Parsed script segments
 * @param metadata - Optional video metadata to inject into intro/outro
 * @returns Array of classified segments with scene types and visualData
 *
 * @throws Never — on complete failure, returns all segments as narration-default
 */
export async function classifyScenes(
  segments: ScriptSegment[],
  metadata?: { topic?: string; episodeNumber?: number; title?: string },
): Promise<ClassifiedSegment[]> {
  if (segments.length === 0) {
    return [];
  }

  // Build fallback in case of total LLM failure
  const buildFallback = (warning: string): ClassifiedSegment[] => {
    const fallback = segments.map((seg, index) => {
      let sceneType: SceneType = 'narration-default';
      let visualData: Record<string, unknown> = { backgroundVariant: 'gradient' };

      if (index === 0) {
        sceneType = 'intro';
        visualData = {};
        if (metadata?.episodeNumber !== undefined) {
          visualData.episodeNumber = metadata.episodeNumber;
        }
        if (metadata?.title) {
          visualData.episodeTitle = metadata.title;
        }
      } else if (index === segments.length - 1) {
        sceneType = 'outro';
        visualData = {};
      }

      return { ...seg, sceneType, visualData, pacing: DEFAULT_SCENE_PACING[sceneType] };
    });

    // Attach the warning as a property on the array for the caller to read
    (fallback as ClassifiedSegment[] & { _warning?: string })._warning = warning;
    return fallback;
  };

  // Resolve API key
  const apiKey = process.env.NEXUS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallback(
      'GEMINI_API_KEY environment variable is not set. Using narration-default fallback for all scenes.',
    );
  }

  // Build prompt
  const userPrompt = buildDirectorUserPrompt(segments);

  // Retry loop
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: DIRECTOR_SYSTEM_PROMPT,
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(userPrompt);
      const responseText = result.response.text();

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw new Error(
          `LLM returned invalid JSON (attempt ${attempt + 1}): ${responseText.slice(0, 200)}`,
        );
      }

      // Validate with Zod
      const validated = LLMDirectorResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(
          `LLM response failed schema validation (attempt ${attempt + 1}): ${validated.error.message}`,
        );
      }

      const entries = validated.data;

      // Ensure we got the right number of entries
      if (entries.length !== segments.length) {
        throw new Error(
          `LLM returned ${entries.length} scenes but expected ${segments.length} (attempt ${attempt + 1})`,
        );
      }

      // Validate each entry and build ClassifiedSegments
      const classified = entries.map((entry, index) =>
        validateEntry(entry, segments[index]),
      );

      // Inject metadata into intro scene
      if (classified.length > 0 && classified[0].sceneType === 'intro' && metadata) {
        if (metadata.episodeNumber !== undefined) {
          classified[0].visualData.episodeNumber = metadata.episodeNumber;
        }
        if (metadata.title) {
          classified[0].visualData.episodeTitle = metadata.title;
        }
      }

      return classified;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted — graceful degradation
  const message = `LLM classification failed after ${MAX_RETRIES} attempts: ${lastError?.message ?? 'Unknown error'}. Using narration-default fallback.`;
  return buildFallback(message);
}
