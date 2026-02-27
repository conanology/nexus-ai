/**
 * Asset Fetcher — enriches Director Agent scenes with fetched image and audio assets.
 *
 * Image enrichment: scans for logo-showcase scenes, batch-fetches logos from
 * Clearbit/Google, and injects data URIs into visualData.logos[].src fields.
 *
 * Audio enrichment: sets scene.sfx based on scene type, and scene.musicTrack
 * on the first scene for background music.
 *
 * @module @nexus-ai/visual-gen/asset-fetcher
 */

import {
  fetchLogosForScene,
  logoBufferToDataUri,
  getSfxForSceneType,
  generateSceneImages,
  buildPromptForScene,
} from '@nexus-ai/asset-library';
import type { ImageRequest } from '@nexus-ai/asset-library';
import type { Scene } from '@nexus-ai/director-agent';
import { enrichScenesWithOverlays } from './overlay-enricher.js';
import { enrichScenesWithAnnotations } from './annotation-enricher.js';
import { enrichScenesWithMemes } from './meme-enricher.js';
import { enrichScenesWithScreenshots } from './screenshot-enricher.js';
import { enrichScenesWithSourceScreenshots } from './source-screenshot-enricher.js';
import type { SourceUrl } from './source-screenshot-enricher.js';
import { enrichScenesWithContentScreenshots } from './content-screenshot-enricher.js';
import { enrichScenesWithStock } from './stock-enricher.js';
import { enrichScenesWithGeoData } from './geo-enricher.js';
import { enrichScenesWithConceptFallback } from './concept-fallback-enricher.js';
import { enrichScenesWithCodeSnippets } from './code-snippet-generator.js';

interface LogoShowcaseVisualData {
  logos: Array<{ name: string; src?: string }>;
  layout: 'grid' | 'sequential';
}

function isLogoShowcaseData(data: unknown): data is LogoShowcaseVisualData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'logos' in data &&
    Array.isArray((data as LogoShowcaseVisualData).logos)
  );
}

/**
 * Enrich scenes with fetched image assets.
 *
 * Scans all scenes for asset references (currently logo-showcase),
 * batch-fetches images, and injects data URIs into the scene data.
 * Returns the enriched scene array (mutated in place for efficiency).
 */
export async function enrichScenesWithAssets(
  scenes: Scene[],
  options?: { sourceUrls?: SourceUrl[] },
): Promise<Scene[]> {
  // Collect all unique company names from logo-showcase scenes
  const logoScenes: Array<{ sceneIndex: number; visualData: LogoShowcaseVisualData }> = [];
  const allLogoNames = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.type === 'logo-showcase' && isLogoShowcaseData(scene.visualData)) {
      logoScenes.push({ sceneIndex: i, visualData: scene.visualData });
      for (const logo of scene.visualData.logos) {
        allLogoNames.add(logo.name);
      }
    }
  }

  // --- Logo enrichment ---
  const fetchedLogos = new Map<string, string | null>();
  if (logoScenes.length > 0) {
    const bufferMap = await fetchLogosForScene(Array.from(allLogoNames));

    let enrichedCount = 0;
    for (const { visualData } of logoScenes) {
      for (const logo of visualData.logos) {
        const buffer = bufferMap.get(logo.name);
        if (buffer) {
          const dataUri = logoBufferToDataUri(buffer);
          logo.src = dataUri;
          fetchedLogos.set(logo.name, dataUri);
          enrichedCount++;
        } else {
          fetchedLogos.set(logo.name, null);
        }
      }
    }

    console.log(
      `Asset enrichment: fetched ${enrichedCount} logos for ${logoScenes.length} logo-showcase scenes`,
    );
  }

  // --- Audio enrichment ---
  enrichScenesWithAudio(scenes);

  // --- Code snippet generation (Gemini satirical code for bare narration scenes) ---
  await enrichScenesWithCodeSnippets(scenes);

  // --- Geo enrichment (before images — map scenes should NOT get AI background images) ---
  enrichScenesWithGeoData(scenes);

  // --- Source screenshot enrichment (HIGHEST priority — actual article/repo screenshots) ---
  if (options?.sourceUrls && options.sourceUrls.length > 0) {
    await enrichScenesWithSourceScreenshots(scenes, options.sourceUrls);
  }

  // --- Content screenshot enrichment (scan narration for company/platform mentions) ---
  await enrichScenesWithContentScreenshots(scenes);

  // --- Company screenshot enrichment (known companies with curated URLs) ---
  await enrichScenesWithScreenshots(scenes);

  // --- Stock enrichment (real photos for tangible concepts) ---
  const pexelsApiKey = process.env.PEXELS_API_KEY;
  if (pexelsApiKey) {
    await enrichScenesWithStock(scenes, pexelsApiKey, 'technology');
  }

  // --- Concept fallback enrichment (Wikipedia screenshots for bare scenes) ---
  await enrichScenesWithConceptFallback(scenes);

  // --- T032: Visual layer cascade (evidence → showcase → abstract-concept) ---
  applyVisualLayerCascade(scenes);

  // --- AI Image enrichment (LAST visual source — only for scenes still without visuals, max 4) ---
  await enrichScenesWithImages(scenes, 'technology');

  // --- Overlay enrichment ---
  enrichScenesWithOverlays(scenes, fetchedLogos);

  // --- Annotation enrichment (after overlays — checks overlay count) ---
  enrichScenesWithAnnotations(scenes);

  // --- Meme enrichment (LAST — modifies scene timing and inserts new scenes) ---
  const giphyApiKey = process.env.GIPHY_API_KEY;
  const enrichedScenes = await enrichScenesWithMemes(scenes, giphyApiKey);

  // --- Visual source metrics ---
  logVisualSourceMetrics(enrichedScenes);

  return enrichedScenes;
}

/**
 * Enrich scenes with fetched image assets and a topic extracted from the scenes.
 * Overload that accepts an explicit topic string.
 */
export async function enrichScenesWithAssetsFull(
  scenes: Scene[],
  topic: string,
  options?: { sourceUrls?: SourceUrl[] },
): Promise<Scene[]> {
  // Collect all unique company names from logo-showcase scenes
  const logoScenes: Array<{ sceneIndex: number; visualData: LogoShowcaseVisualData }> = [];
  const allLogoNames = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.type === 'logo-showcase' && isLogoShowcaseData(scene.visualData)) {
      logoScenes.push({ sceneIndex: i, visualData: scene.visualData });
      for (const logo of scene.visualData.logos) {
        allLogoNames.add(logo.name);
      }
    }
  }

  // --- Logo enrichment ---
  const fetchedLogos = new Map<string, string | null>();
  if (logoScenes.length > 0) {
    const bufferMap = await fetchLogosForScene(Array.from(allLogoNames));

    let enrichedCount = 0;
    for (const { visualData } of logoScenes) {
      for (const logo of visualData.logos) {
        const buffer = bufferMap.get(logo.name);
        if (buffer) {
          const dataUri = logoBufferToDataUri(buffer);
          logo.src = dataUri;
          fetchedLogos.set(logo.name, dataUri);
          enrichedCount++;
        } else {
          fetchedLogos.set(logo.name, null);
        }
      }
    }

    console.log(
      `Asset enrichment: fetched ${enrichedCount} logos for ${logoScenes.length} logo-showcase scenes`,
    );
  }

  // --- Audio enrichment ---
  enrichScenesWithAudio(scenes);

  // --- Code snippet generation (Gemini satirical code for bare narration scenes) ---
  await enrichScenesWithCodeSnippets(scenes);

  // --- Geo enrichment (before images — map scenes should NOT get AI background images) ---
  enrichScenesWithGeoData(scenes);

  // --- Source screenshot enrichment (HIGHEST priority — actual article/repo screenshots) ---
  if (options?.sourceUrls && options.sourceUrls.length > 0) {
    await enrichScenesWithSourceScreenshots(scenes, options.sourceUrls);
  }

  // --- Content screenshot enrichment (scan narration for company/platform mentions) ---
  await enrichScenesWithContentScreenshots(scenes);

  // --- Company screenshot enrichment (known companies with curated URLs) ---
  await enrichScenesWithScreenshots(scenes);

  // --- Stock enrichment (real photos for tangible concepts) ---
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    await enrichScenesWithStock(scenes, pexelsKey, topic);
  }

  // --- Concept fallback enrichment (Wikipedia screenshots for bare scenes) ---
  await enrichScenesWithConceptFallback(scenes);

  // --- T032: Visual layer cascade (evidence → showcase → abstract-concept) ---
  applyVisualLayerCascade(scenes);

  // --- AI Image enrichment (LAST visual source — only for scenes still without visuals, max 4) ---
  await enrichScenesWithImages(scenes, topic);

  // --- Overlay enrichment ---
  enrichScenesWithOverlays(scenes, fetchedLogos);

  // --- Annotation enrichment (after overlays — checks overlay count) ---
  enrichScenesWithAnnotations(scenes);

  // --- Meme enrichment (LAST — modifies scene timing and inserts new scenes) ---
  const giphyKey = process.env.GIPHY_API_KEY;
  const enrichedScenes = await enrichScenesWithMemes(scenes, giphyKey);

  // --- Visual source metrics ---
  logVisualSourceMetrics(enrichedScenes);

  return enrichedScenes;
}

// ---------------------------------------------------------------------------
// T032: Visual Layer Cascade Fallback
// ---------------------------------------------------------------------------

/**
 * Visual layer cascade priority:
 *   evidence-screenshot → showcase-scroll → abstract-concept
 *
 * When a scene's assigned visual layer cannot be fulfilled (no visual after
 * all enrichers have run), the cascade downgrades the layer to the next in
 * priority. The Nano Banana AI image (abstract-concept) is always the
 * terminal fallback.
 *
 * This function runs AFTER all screenshot/stock/concept enrichers but BEFORE
 * AI image generation. It ensures that unfulfilled evidence/showcase scenes
 * get downgraded to abstract-concept so the AI image enricher picks them up
 * with the Nano Banana prompt.
 *
 * @param scenes - Scene array to process (mutated in place)
 */
export function applyVisualLayerCascade(scenes: Scene[]): void {
  let cascadeCount = 0;

  for (const scene of scenes) {
    // Only process scenes that have a visual layer AND still lack visuals
    if (!scene.visualLayer) continue;
    if (scene.screenshotImage || scene.backgroundImage) continue;

    const originalLayer = scene.visualLayer;

    // Cascade: evidence-screenshot → showcase-scroll → abstract-concept
    if (scene.visualLayer === 'evidence-screenshot') {
      // Evidence layer expected a screenshot — none found.
      // Downgrade to showcase-scroll first (code/diagram/conceptual).
      // Since showcase-scroll enrichers have already run and also didn't
      // produce a visual, cascade further to abstract-concept.
      scene.visualLayer = 'abstract-concept';
      cascadeCount++;
    } else if (scene.visualLayer === 'showcase-scroll') {
      // Showcase layer expected code/diagram-appropriate visuals — none found.
      // Downgrade to abstract-concept (Nano Banana AI terminal fallback).
      scene.visualLayer = 'abstract-concept';
      cascadeCount++;
    }
    // abstract-concept stays as-is — it's the terminal fallback.

    if (scene.visualLayer !== originalLayer) {
      console.log(
        `  Cascade: scene ${scene.id} (${scene.type}) — ${originalLayer} → ${scene.visualLayer}`,
      );
    }
  }

  if (cascadeCount > 0) {
    console.log(
      `Visual layer cascade: ${cascadeCount} scenes downgraded to abstract-concept (Nano Banana fallback)`,
    );
  }
}

/**
 * Enrich scenes with audio cues (SFX names and background music track).
 *
 * Sets scene.sfx based on scene type and scene.musicTrack on the first scene.
 * Mutates scenes in place.
 */
/** Cycle through different SFX for narration-default to avoid repetition */
const NARRATION_SFX_CYCLE = ['whoosh-in', 'reveal', 'click'];

export function enrichScenesWithAudio(scenes: Scene[]): void {
  let sfxCount = 0;
  let narrationSfxIndex = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    if (scene.type === 'narration-default') {
      // Cycle through SFX variants for variety
      scene.sfx = [NARRATION_SFX_CYCLE[narrationSfxIndex % NARRATION_SFX_CYCLE.length]];
      narrationSfxIndex++;
      sfxCount++;
    } else {
      // Set SFX for this scene type from the standard map
      const sfx = getSfxForSceneType(scene.type);
      if (sfx.length > 0) {
        scene.sfx = sfx;
        sfxCount++;
      }
    }

    // Set background music on the first scene
    if (i === 0) {
      scene.musicTrack = 'background-music-01';
    }
  }

  console.log(
    `Audio enrichment: ${sfxCount}/${scenes.length} scenes have SFX, music track set on first scene`,
  );
}

/**
 * Enrich scenes with AI-generated background images via Gemini 3 Pro Image Preview.
 *
 * Builds prompts for eligible scenes, generates images in batches, and sets
 * scene.backgroundImage to the resulting data URI. Gracefully degrades if
 * GEMINI_API_KEY is not set.
 */
/** Max AI-generated images per video — screenshots and stock are preferred */
const MAX_AI_IMAGES = 2;

// ---------------------------------------------------------------------------
// Nano Banana prompt — deep black + neon green cyberpunk aesthetic
// Used for abstract-concept visual layer scenes
// ---------------------------------------------------------------------------

const NANO_BANANA_POSITIVE =
  'Cyberpunk, minimalist, strictly deep black background with bright neon green glowing accents, no text,';

const NANO_BANANA_NEGATIVE =
  'no text, no words, no letters, no numbers, no watermarks';

/**
 * Build a Nano Banana prompt for abstract-concept scenes.
 * Combines the standard neon-green aesthetic preamble with a scene concept
 * description derived from the scene content.
 */
export function buildNanoBananaPrompt(sceneContent: string): string {
  // Strip any numbers/brands from content to get a clean concept description
  const cleaned = sceneContent
    .replace(/\$[\d,.]+[BMKbmk]?/g, '')
    .replace(/\b\d[\d,.]*%?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const concept = cleaned.length > 10
    ? cleaned.slice(0, 300)
    : 'abstract futuristic technology concept';

  return [
    `[POSITIVE PROMPT]\n${NANO_BANANA_POSITIVE} ${concept}`,
    `[NEGATIVE PROMPT]\n${NANO_BANANA_NEGATIVE}`,
    '[STYLE]\n16:9 landscape, 1920x1080 framing, photorealistic rendering, cinematic volumetric lighting, matte surfaces, depth of field.',
    '[FINAL INSTRUCTION]\nGenerate a single stunning image. The image must contain ZERO readable text, numbers, letters, or words. Pure visual art only.',
  ].join('\n\n');
}

export async function enrichScenesWithImages(
  scenes: Scene[],
  topic: string,
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXUS_GEMINI_API_KEY;
  if (!apiKey) {
    console.log('Image enrichment: skipped (no GEMINI_API_KEY set)');
    return;
  }

  const requests: ImageRequest[] = [];
  let previousPrompt: string | undefined;
  let skippedWithVisuals = 0;

  for (const scene of scenes) {
    // Skip scenes that already have a visual from screenshots or stock
    if (scene.screenshotImage || scene.backgroundImage) {
      skippedWithVisuals++;
      continue;
    }

    let prompt: string | null;

    // T031: Use Nano Banana prompt for abstract-concept visual layer
    if (scene.visualLayer === 'abstract-concept') {
      prompt = buildNanoBananaPrompt(scene.content);
    } else {
      prompt = buildPromptForScene(
        { type: scene.type, content: scene.content, visualData: scene.visualData as Record<string, unknown> },
        topic,
        previousPrompt,
      );
    }

    if (prompt) {
      requests.push({ sceneId: scene.id, prompt });
      previousPrompt = prompt.slice(0, 200); // Keep short summary for continuity
    }
  }

  // Hard cap: only generate for first MAX_AI_IMAGES eligible scenes
  const cappedRequests = requests.slice(0, MAX_AI_IMAGES);

  if (cappedRequests.length === 0) {
    console.log(`Image enrichment: no eligible scenes (${skippedWithVisuals} already have visuals)`);
    return;
  }

  console.log(
    `Image enrichment: generating ${cappedRequests.length} images (${skippedWithVisuals} scenes already have visuals, ${requests.length - cappedRequests.length} capped)`,
  );

  const imageMap = await generateSceneImages(cappedRequests);

  let successCount = 0;
  for (const scene of scenes) {
    const dataUri = imageMap.get(scene.id);
    if (dataUri) {
      scene.backgroundImage = dataUri;
      scene.visualSource = 'ai-generated';
      successCount++;
    }
  }

  console.log(
    `Image enrichment: ${successCount}/${cappedRequests.length} scenes received AI images`,
  );
}

/**
 * Log visual source breakdown for the final enriched scene list.
 */
function logVisualSourceMetrics(scenes: Scene[]): void {
  const counts: Record<string, number> = {};
  let gradientOnly = 0;

  for (const scene of scenes) {
    const source = scene.visualSource ?? (scene.screenshotImage || scene.backgroundImage ? 'unknown' : 'gradient');
    counts[source] = (counts[source] || 0) + 1;
    if (source === 'gradient') gradientOnly++;
  }

  const total = scenes.length;
  const pct = total > 0 ? ((gradientOnly / total) * 100).toFixed(1) : '0';

  console.log('\n=== Visual Source Breakdown ===');
  for (const [source, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count} (${((count / total) * 100).toFixed(1)}%)`);
  }
  console.log(`  gradient-only: ${gradientOnly}/${total} (${pct}%) — target: <15%`);
  console.log('==============================\n');
}
