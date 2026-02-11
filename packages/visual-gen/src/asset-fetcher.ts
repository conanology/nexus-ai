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

  // --- Image enrichment ---
  await enrichScenesWithImages(scenes, 'technology');

  // --- Source screenshot enrichment (HIGHEST priority — actual article/repo screenshots) ---
  if (options?.sourceUrls && options.sourceUrls.length > 0) {
    await enrichScenesWithSourceScreenshots(scenes, options.sourceUrls);
  }

  // --- Company screenshot enrichment (after source screenshots — lower priority) ---
  await enrichScenesWithScreenshots(scenes);

  // --- Stock enrichment (after all screenshots — real photos for tangible concepts) ---
  const pexelsApiKey = process.env.PEXELS_API_KEY;
  if (pexelsApiKey) {
    await enrichScenesWithStock(scenes, pexelsApiKey, 'technology');
  }

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

  // --- Image enrichment ---
  await enrichScenesWithImages(scenes, topic);

  // --- Source screenshot enrichment (HIGHEST priority — actual article/repo screenshots) ---
  if (options?.sourceUrls && options.sourceUrls.length > 0) {
    await enrichScenesWithSourceScreenshots(scenes, options.sourceUrls);
  }

  // --- Company screenshot enrichment (after source screenshots — lower priority) ---
  await enrichScenesWithScreenshots(scenes);

  // --- Stock enrichment (after all screenshots — real photos for tangible concepts) ---
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    await enrichScenesWithStock(scenes, pexelsKey, topic);
  }

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
export function enrichScenesWithAudio(scenes: Scene[]): void {
  let sfxCount = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Set SFX for this scene type
    const sfx = getSfxForSceneType(scene.type);
    if (sfx.length > 0) {
      scene.sfx = sfx;
      sfxCount++;
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

  for (const scene of scenes) {
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

  if (requests.length === 0) {
    console.log('Image enrichment: no eligible scenes');
    return;
  }

  console.log(`Image enrichment: generating images for ${requests.length} eligible scenes...`);

  const imageMap = await generateSceneImages(requests);

  let successCount = 0;
  for (const scene of scenes) {
    const dataUri = imageMap.get(scene.id);
    if (dataUri) {
      scene.backgroundImage = dataUri;
      successCount++;
    }
  }

  console.log(
    `Image enrichment: ${successCount}/${requests.length} scenes received images`,
  );
}
