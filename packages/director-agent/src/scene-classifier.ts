/**
 * Scene Classifier
 *
 * Uses Gemini LLM to classify script segments into scene types
 * and generate visualData payloads for each.
 *
 * Features:
 * - Increased output token limit (65536) for large scripts
 * - JSON repair for truncated/malformed LLM output
 * - Batched classification for scripts with >25 segments
 * - Heuristic keyword-based fallback when LLM fails
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
const MAX_OUTPUT_TOKENS = 65536;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const BATCH_SIZE = 25;

// =============================================================================
// Known Tech Companies (for heuristic classification)
// =============================================================================

const KNOWN_COMPANIES = [
  'OpenAI', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Facebook',
  'Netflix', 'Salesforce', 'Slack', 'Atlassian', 'GitHub', 'Tesla', 'Nvidia',
  'Intel', 'AMD', 'Oracle', 'IBM', 'Adobe', 'Twitter', 'Uber', 'Airbnb',
  'Stripe', 'SpaceX', 'DeepMind', 'Anthropic', 'HuggingFace', 'Hugging Face',
  'Stability AI', 'Midjourney', 'Spotify', 'TikTok', 'Snapchat', 'LinkedIn',
  'Pinterest', 'Shopify', 'Cloudflare', 'Vercel', 'Supabase', 'Docker',
  'Redis', 'MongoDB', 'Snowflake', 'Databricks', 'Palantir', 'Zoom',
  'Twilio', 'Figma', 'Notion', 'Discord', 'Reddit', 'Mozilla',
  'Samsung', 'Sony', 'Copilot', 'ChatGPT', 'Claude', 'Llama', 'Mistral',
  'Cohere', 'Perplexity', 'Cursor', 'Devin', 'Klarna', 'Matplotlib',
  'Python', 'React', 'TypeScript', 'Rust', 'Golang', 'Swift', 'Kubernetes',
  'AWS', 'Azure', 'GCP', 'Gemini', 'GPT', 'DALL-E', 'Sora', 'Copilot',
  'WordPress', 'Elastic', 'Confluent', 'HashiCorp', 'Terraform',
  'GitHub Actions', 'Jenkins', 'CircleCI', 'Datadog', 'Grafana',
];

// Build regex patterns once at module load
const COMPANY_PATTERNS: Array<{ pattern: RegExp; name: string }> = KNOWN_COMPANIES
  .sort((a, b) => b.length - a.length) // longest first to avoid partial matches
  .map((name) => ({
    pattern: new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    name,
  }));

// =============================================================================
// Helpers (validation)
// =============================================================================

function isValidSceneType(value: string): value is SceneType {
  return (SCENE_TYPES as readonly string[]).includes(value);
}

function isValidPacing(value: string): value is ScenePacing {
  return (SCENE_PACING_VALUES as readonly string[]).includes(value);
}

function defaultVisualData(sceneType: SceneType, segmentText: string): Record<string, unknown> {
  switch (sceneType) {
    case 'intro':
      return {};
    case 'outro':
      return {};
    case 'narration-default':
      return { backgroundVariant: 'gradient' };
    case 'text-emphasis':
      return { phrase: segmentText.slice(0, 80), style: 'fade' };
    case 'full-screen-text':
      return { text: segmentText.slice(0, 120), alignment: 'center' };
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
      return { mapType: 'world', highlightedCountries: [], animationStyle: 'simultaneous' };
    default:
      return { backgroundVariant: 'gradient' };
  }
}

function validateEntry(
  entry: LLMSceneEntry,
  segment: ScriptSegment,
): ClassifiedSegment {
  let sceneType: SceneType;
  if (isValidSceneType(entry.sceneType)) {
    sceneType = entry.sceneType;
  } else {
    sceneType = 'narration-default';
  }

  const schema = VISUAL_DATA_SCHEMAS[sceneType];
  const result = schema.safeParse(entry.visualData);

  let visualData: Record<string, unknown>;
  if (result.success) {
    visualData = result.data as Record<string, unknown>;
  } else {
    visualData = defaultVisualData(sceneType, segment.text);
  }

  const pacing: ScenePacing =
    entry.pacing && isValidPacing(entry.pacing)
      ? entry.pacing
      : DEFAULT_SCENE_PACING[sceneType];

  return { ...segment, sceneType, visualData, pacing };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// JSON Repair
// =============================================================================

/**
 * Attempts to repair malformed/truncated JSON from LLM output.
 * Handles: markdown fences, trailing commas, truncated strings, unclosed brackets.
 */
function repairJSON(text: string): unknown | null {
  let cleaned = text.trim();

  // 1. Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // 2. Try parsing as-is
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to repair
  }

  // 3. Track JSON structure to find where truncation happened
  let inString = false;
  let escape = false;
  let openBrackets = 0;
  let openBraces = 0;
  let lastCloseBrace = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
    if (char === '{') openBraces++;
    if (char === '}') {
      openBraces--;
      if (openBraces === 0) {
        lastCloseBrace = i;
      }
    }
  }

  // 4. Strategy A: close the truncated JSON by removing incomplete tail
  if (inString) cleaned += '"';

  // Remove trailing incomplete key-value pairs
  cleaned = cleaned.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
  cleaned = cleaned.replace(/,\s*$/, '');

  // Close remaining open structures
  for (let i = 0; i < openBraces; i++) cleaned += '}';
  for (let i = 0; i < openBrackets; i++) cleaned += ']';

  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to strategy B
  }

  // 5. Strategy B: truncate to the last complete JSON object in the array
  if (lastCloseBrace > 0) {
    let truncated = text.trim().slice(0, lastCloseBrace + 1);
    truncated = truncated.replace(/,\s*$/, '');
    if (!truncated.trimEnd().endsWith(']')) {
      truncated += ']';
    }
    try {
      return JSON.parse(truncated);
    } catch {
      // give up
    }
  }

  return null;
}

// =============================================================================
// Heuristic Classifier (keyword-based fallback)
// =============================================================================

/**
 * Extracts company/brand names found in text.
 */
function extractCompanyNames(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, name } of COMPANY_PATTERNS) {
    if (pattern.test(text)) {
      found.push(name);
    }
  }
  return found;
}

/**
 * Extracts a numeric stat from text for stat-callout.
 */
function extractStat(text: string): { number: string; label: string; prefix?: string; suffix?: string } {
  // Money
  const moneyMatch = text.match(/([$€£])\s?([\d,.]+)\s*([MBKTmbt](?:illion|rillion)?)?/);
  if (moneyMatch) {
    return {
      number: moneyMatch[2],
      label: text.replace(moneyMatch[0], '').trim().slice(0, 60) || 'value',
      prefix: moneyMatch[1],
      suffix: moneyMatch[3] || undefined,
    };
  }

  // Percentage
  const pctMatch = text.match(/([\d,.]+)\s*%/);
  if (pctMatch) {
    return {
      number: pctMatch[1],
      label: text.replace(pctMatch[0], '').trim().slice(0, 60) || 'percentage',
      suffix: '%',
    };
  }

  // Large number with optional unit
  const numMatch = text.match(/\b([\d,.]+)\s*(million|billion|thousand|[MBKTmbt])?\b/i);
  if (numMatch) {
    return {
      number: numMatch[1],
      label: text.replace(numMatch[0], '').trim().slice(0, 60) || 'value',
      suffix: numMatch[2] || undefined,
    };
  }

  return { number: '0', label: text.slice(0, 40) };
}

/**
 * Extracts a quote and attribution from text.
 */
function extractQuote(text: string): { text: string; attribution: string } {
  const quoteMatch = text.match(/"([^"]{10,})"/);
  const quote = quoteMatch ? quoteMatch[1] : text.slice(0, 100);

  const attrMatch = text.match(
    /(?:said|according to|stated|told|wrote|tweeted by?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/,
  );
  const attribution = attrMatch ? attrMatch[1] : 'Source';

  return { text: quote, attribution };
}

/**
 * Extracts 1-3 key words from text for highlighting.
 */
function extractKeyWords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'that', 'this', 'it',
    'its', 'has', 'have', 'had', 'not', 'from', 'they', 'them', 'their',
    'what', 'when', 'where', 'who', 'will', 'can', 'could', 'would',
    'should', 'does', 'did', 'been', 'being', 'just', 'also', 'than',
    'then', 'into', 'about', 'more', 'most', 'some', 'such', 'only',
    'very', 'much', 'even', 'like', 'over', 'after', 'before', 'between',
  ]);

  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length >= 4 && !stopWords.has(w.toLowerCase()));

  const unique = [...new Set(words)];
  return unique.slice(0, 3);
}

/**
 * Classifies a single segment by analysing its text content.
 */
function classifyByContent(segment: ScriptSegment): ClassifiedSegment {
  const text = segment.text;

  // 1. Stats: numbers >= 100, percentages, money
  if (
    /\b\d{3,}[\d,.]*\b/.test(text) ||
    /\b\d+(\.\d+)?%/.test(text) ||
    /[$€£]\s?\d/.test(text)
  ) {
    const stat = extractStat(text);
    return {
      ...segment,
      sceneType: 'stat-callout',
      visualData: {
        number: stat.number,
        label: stat.label,
        countUp: true,
        ...(stat.prefix ? { prefix: stat.prefix } : {}),
        ...(stat.suffix ? { suffix: stat.suffix } : {}),
      },
      pacing: 'punch',
    };
  }

  // 2. Direct quotes
  if (
    /"[^"]{10,}"/.test(text) ||
    /\b(?:said|according to|stated|told)\b/i.test(text)
  ) {
    const quote = extractQuote(text);
    return {
      ...segment,
      sceneType: 'quote',
      visualData: { text: quote.text, attribution: quote.attribution },
      pacing: 'breathe',
    };
  }

  // 3. Company/brand names (2+ → logo-showcase)
  const companies = extractCompanyNames(text);
  if (companies.length >= 2) {
    return {
      ...segment,
      sceneType: 'logo-showcase',
      visualData: {
        logos: companies.slice(0, 5).map((c) => ({ name: c })),
        layout: 'sequential' as const,
      },
      pacing: 'normal',
    };
  }

  // 4. Comparison language
  if (
    /\bvs\.?\b|\bversus\b|\bcompared\s+to\b|\bbefore\s+and\s+after\b|\bon\s+the\s+other\s+hand\b/i.test(
      text,
    )
  ) {
    // Try to extract the two sides from the text
    const vsMatch = text.match(/(.{5,40}?)\s+(?:vs\.?|versus|compared to)\s+(.{5,40})/i);
    return {
      ...segment,
      sceneType: 'comparison',
      visualData: {
        left: { title: vsMatch ? vsMatch[1].trim() : 'Before', items: ['Traditional approach'] },
        right: { title: vsMatch ? vsMatch[2].trim() : 'After', items: ['New approach'] },
      },
      pacing: 'dense',
    };
  }

  // 5. Lists (3+ comma-separated items or enumeration words)
  if (
    /\bfirst(?:ly)?\b.*\bsecond(?:ly)?\b/i.test(text) ||
    (text.match(/,/g)?.length ?? 0) >= 3
  ) {
    const items = text
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3 && s.length < 80);
    return {
      ...segment,
      sceneType: 'list-reveal',
      visualData: {
        items: items.length >= 3 ? items.slice(0, 6) : [text.slice(0, 60)],
        style: 'bullet' as const,
      },
      pacing: 'dense',
    };
  }

  // 6. Questions → full-screen-text
  if (/\?\s*$/.test(text.trim()) && text.length < 150) {
    return {
      ...segment,
      sceneType: 'full-screen-text',
      visualData: { text: text.trim(), alignment: 'center' as const },
      pacing: 'breathe',
    };
  }

  // 7. Multiple year references → timeline
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches && yearMatches.length >= 2) {
    const uniqueYears = [...new Set(yearMatches)];
    return {
      ...segment,
      sceneType: 'timeline',
      visualData: {
        events: uniqueYears.map((y) => ({ year: y, label: `Event in ${y}` })),
      },
      pacing: 'dense',
    };
  }

  // 8. Single company mention (1 company) → text-emphasis with company focus
  // (not enough for logo-showcase but still notable)

  // 9. Default: text-emphasis (more engaging than narration-default)
  return {
    ...segment,
    sceneType: 'text-emphasis',
    visualData: {
      phrase: text.slice(0, 80),
      highlightWords: extractKeyWords(text),
      style: 'fade' as const,
    },
    pacing: 'normal',
  };
}

/**
 * Heuristic classifier for when LLM fails.
 * Analyzes text content of each segment to assign scene types.
 * Inserts chapter breaks at regular intervals for structure.
 */
function heuristicClassify(
  segments: ScriptSegment[],
  metadata?: { topic?: string; episodeNumber?: number; title?: string },
): ClassifiedSegment[] {
  // Track last scene type to inject narration-default breaks for variety
  let consecutiveSameType = 0;
  let lastType: SceneType | null = null;

  return segments.map((seg, index) => {
    // First segment → intro
    if (index === 0) {
      const visualData: Record<string, unknown> = {};
      if (metadata?.episodeNumber !== undefined) visualData.episodeNumber = metadata.episodeNumber;
      if (metadata?.title) visualData.episodeTitle = metadata.title;
      lastType = 'intro';
      consecutiveSameType = 1;
      return { ...seg, sceneType: 'intro' as const, visualData, pacing: 'normal' as const };
    }

    // Last segment → outro
    if (index === segments.length - 1) {
      return { ...seg, sceneType: 'outro' as const, visualData: {}, pacing: 'breathe' as const };
    }

    // Insert chapter breaks every ~18 segments for structure
    if (index > 1 && index % 18 === 0 && index < segments.length - 2) {
      lastType = 'chapter-break';
      consecutiveSameType = 1;
      return {
        ...seg,
        sceneType: 'chapter-break' as const,
        visualData: { title: seg.text.slice(0, 50) },
        pacing: 'breathe' as const,
      };
    }

    // Classify by content
    const classified = classifyByContent(seg);

    // Prevent 3 consecutive same types
    if (classified.sceneType === lastType) {
      consecutiveSameType++;
      if (consecutiveSameType >= 3) {
        consecutiveSameType = 1;
        const altType: SceneType =
          classified.sceneType === 'narration-default' ? 'text-emphasis' : 'narration-default';
        lastType = altType;
        return {
          ...seg,
          sceneType: altType,
          visualData: defaultVisualData(altType, seg.text),
          pacing: DEFAULT_SCENE_PACING[altType],
        };
      }
    } else {
      lastType = classified.sceneType;
      consecutiveSameType = 1;
    }

    return classified;
  });
}

// =============================================================================
// Batch Prompt Builder
// =============================================================================

function buildBatchPrompt(
  segments: ScriptSegment[],
  batchIndex: number,
  totalBatches: number,
): string {
  const segmentLines = segments
    .map(
      (seg) =>
        `[Segment ${seg.index}] (frames ${seg.startFrame}-${seg.endFrame}):\n"${seg.text}"`,
    )
    .join('\n\n');

  let instructions = `Classify these ${segments.length} script segments into scene types:\n\n${segmentLines}\n\nRespond with a JSON array of exactly ${segments.length} objects.`;

  if (totalBatches > 1) {
    instructions += `\n\nThis is batch ${batchIndex + 1} of ${totalBatches} from the same video.`;
  }

  if (batchIndex === 0) {
    instructions += '\nThe FIRST segment MUST be "intro".';
  }
  if (batchIndex === totalBatches - 1) {
    instructions += '\nThe LAST segment MUST be "outro".';
  }

  instructions +=
    '\nAny numbers/stats MUST use "stat-callout". Any company names MUST use "logo-showcase".';

  return instructions;
}

// =============================================================================
// LLM Call (shared between single and batched)
// =============================================================================

/**
 * Makes a single LLM classification call for a set of segments.
 * Returns classified segments, or null + error message on failure.
 */
async function llmClassifyAttempt(
  segments: ScriptSegment[],
  userPrompt: string,
  apiKey: string,
): Promise<{ classified: ClassifiedSegment[] } | { error: string }> {
  let lastError = '';

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

      // Try JSON.parse, then repair
      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = repairJSON(responseText);
        if (parsed === null) {
          throw new Error(
            `LLM returned invalid JSON (attempt ${attempt + 1}): ${responseText.slice(0, 300)}`,
          );
        }
      }

      // Validate with Zod
      const validated = LLMDirectorResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(
          `LLM response failed schema validation (attempt ${attempt + 1}): ${validated.error.message}`,
        );
      }

      const entries = validated.data;

      // Handle length mismatch gracefully: fill missing with heuristics
      let classified: ClassifiedSegment[];
      if (entries.length < segments.length) {
        classified = entries.map((entry, i) => validateEntry(entry, segments[i]));
        for (let i = entries.length; i < segments.length; i++) {
          classified.push(classifyByContent(segments[i]));
        }
      } else {
        const trimmed = entries.slice(0, segments.length);
        classified = trimmed.map((entry, i) => validateEntry(entry, segments[i]));
      }

      return { classified };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  return { error: lastError };
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Classifies script segments into scene types using Gemini LLM.
 *
 * For scripts with <= 25 segments, classifies in a single LLM call.
 * For larger scripts, splits into batches of 25 and classifies each separately.
 * On LLM failure, falls back to heuristic keyword-based classification.
 *
 * @param segments - Parsed script segments
 * @param metadata - Optional video metadata to inject into intro/outro
 * @returns Array of classified segments with scene types and visualData
 *
 * @throws Never — on complete failure, returns heuristic-classified segments
 */
export async function classifyScenes(
  segments: ScriptSegment[],
  metadata?: { topic?: string; episodeNumber?: number; title?: string },
): Promise<ClassifiedSegment[]> {
  if (segments.length === 0) {
    return [];
  }

  const buildFallback = (warning: string): ClassifiedSegment[] => {
    const fallback = heuristicClassify(segments, metadata);
    (fallback as ClassifiedSegment[] & { _warning?: string })._warning = warning;
    return fallback;
  };

  // Resolve API key
  const apiKey = process.env.NEXUS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallback(
      'GEMINI_API_KEY not set. Using heuristic classification.',
    );
  }

  // Single call for small scripts
  if (segments.length <= BATCH_SIZE) {
    const userPrompt = buildDirectorUserPrompt(segments);
    const result = await llmClassifyAttempt(segments, userPrompt, apiKey);

    if ('classified' in result) {
      injectMetadata(result.classified, metadata);
      return result.classified;
    }

    // LLM failed — heuristic fallback
    return buildFallback(
      `LLM classification failed after ${MAX_RETRIES} attempts: ${result.error}. Using heuristic fallback.`,
    );
  }

  // Batched classification for large scripts
  const batches: ScriptSegment[][] = [];
  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    batches.push(segments.slice(i, i + BATCH_SIZE));
  }

  const allClassified: ClassifiedSegment[] = [];
  const warnings: string[] = [];

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const prompt = buildBatchPrompt(batch, batchIdx, batches.length);
    const result = await llmClassifyAttempt(batch, prompt, apiKey);

    if ('classified' in result) {
      allClassified.push(...result.classified);
    } else {
      // This batch failed — use heuristic for this batch only
      warnings.push(`Batch ${batchIdx + 1}/${batches.length} LLM failed: ${result.error}`);
      const heuristicBatch = batch.map((seg, idx) => {
        if (batchIdx === 0 && idx === 0) {
          const vd: Record<string, unknown> = {};
          if (metadata?.episodeNumber !== undefined) vd.episodeNumber = metadata.episodeNumber;
          if (metadata?.title) vd.episodeTitle = metadata.title;
          return { ...seg, sceneType: 'intro' as const, visualData: vd, pacing: 'normal' as const };
        }
        if (batchIdx === batches.length - 1 && idx === batch.length - 1) {
          return { ...seg, sceneType: 'outro' as const, visualData: {}, pacing: 'breathe' as const };
        }
        return classifyByContent(seg);
      });
      allClassified.push(...heuristicBatch);
    }
  }

  injectMetadata(allClassified, metadata);

  if (warnings.length > 0) {
    (allClassified as ClassifiedSegment[] & { _warning?: string })._warning =
      `Batched classification: ${warnings.join('; ')}`;
  }

  return allClassified;
}

// =============================================================================
// Metadata Injection
// =============================================================================

function injectMetadata(
  classified: ClassifiedSegment[],
  metadata?: { topic?: string; episodeNumber?: number; title?: string },
): void {
  if (!metadata || classified.length === 0) return;

  if (classified[0].sceneType === 'intro') {
    if (metadata.episodeNumber !== undefined) {
      classified[0].visualData.episodeNumber = metadata.episodeNumber;
    }
    if (metadata.title) {
      classified[0].visualData.episodeTitle = metadata.title;
    }
  }
}
