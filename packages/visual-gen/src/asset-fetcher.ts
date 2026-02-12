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

  // --- AI Image enrichment (LAST visual source — only for scenes still without visuals, max 4) ---
  await enrichScenesWithImages(scenes, 'technology');

  // --- Overlay enrichment ---
  enrichScenesWithOverlays(scenes, fetchedLogos);

  // --- Annotation enrichment (after overlays — checks overlay count) ---
  enrichScenesWithAnnotations(scenes);

  // --- Meme enrichment (LAST — modifies scene timing and inserts new scenes) ---
  const giphyApiKey = process.env.GIPHY_API_KEY;
  const enrichedScenes = await enrichScenesWithMemes(scenes, giphyApiKey);

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

  // --- AI Image enrichment (LAST visual source — only for scenes still without visuals, max 4) ---
  await enrichScenesWithImages(scenes, topic);

  // --- Overlay enrichment ---
  enrichScenesWithOverlays(scenes, fetchedLogos);

  // --- Annotation enrichment (after overlays — checks overlay count) ---
  enrichScenesWithAnnotations(scenes);

  // --- Meme enrichment (LAST — modifies scene timing and inserts new scenes) ---
  const giphyKey = process.env.GIPHY_API_KEY;
  const enrichedScenes = await enrichScenesWithMemes(scenes, giphyKey);

  return enrichedScenes;
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
      scene.musicTrack = 'ambient-tech-01';
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
const MAX_AI_IMAGES = 4;

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

    const prompt = buildPromptForScene(
      { type: scene.type, content: scene.content, visualData: scene.visualData as Record<string, unknown> },
      topic,
      previousPrompt,
    );

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
