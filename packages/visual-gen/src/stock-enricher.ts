/**
 * Stock Enricher — replaces AI-generated backgrounds with real stock
 * photos/videos from Pexels for scenes depicting tangible real-world concepts.
 *
 * Visual priority (highest → lowest):
 * 1. Source screenshot (actual article/repo being discussed)
 * 2. Company screenshot (homepage of mentioned company)
 * 3. Stock video/photo (real-world footage for tangible concepts) ← THIS
 * 4. AI-generated background (abstract/metaphorical scenes)
 * 5. Plain gradient (fallback)
 *
 * @module @nexus-ai/visual-gen/stock-enricher
 */

import { searchStockMedia, buildStockQuery } from '@nexus-ai/asset-library';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max stock assets per video — real photos over AI art */
const MAX_STOCK_PER_VIDEO = 10;

/** Scene types that should NEVER get stock backgrounds */
const EXCLUDED_SCENE_TYPES = new Set([
  'intro',
  'outro',
  'chapter-break',
  'code-block',
  'meme-reaction',
  'map-animation',
]);

// ---------------------------------------------------------------------------
// enrichScenesWithStock
// ---------------------------------------------------------------------------

/**
 * Enrich scenes with stock photos/videos from Pexels.
 *
 * Only applies to scenes that:
 * - Don't already have a screenshotImage (source/company screenshots take priority)
 * - Have content that maps to a tangible real-world concept
 * - Are not in the excluded scene types list
 *
 * Mutates scenes in place.
 *
 * @param scenes - Scene array to enrich
 * @param apiKey - Pexels API key
 * @param videoTopic - Overall video topic for relevance filtering
 */
export async function enrichScenesWithStock(
  scenes: Scene[],
  apiKey: string,
  videoTopic?: string,
): Promise<void> {
  if (!apiKey) {
    console.log('Stock enrichment: skipped (no PEXELS_API_KEY)');
    return;
  }

  // Find eligible scenes
  const candidates: Array<{ index: number; query: string }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Skip excluded types
    if (EXCLUDED_SCENE_TYPES.has(scene.type)) continue;

    // Skip scenes that already have screenshots (higher priority)
    if (scene.screenshotImage) continue;

    // Build a stock query from the scene content (with topic relevance filter)
    const query = buildStockQuery(scene.content, scene.type, videoTopic);
    if (!query) continue;

    candidates.push({ index: i, query });

    if (candidates.length >= MAX_STOCK_PER_VIDEO) break;
  }

  if (candidates.length === 0) {
    console.log('Stock enrichment: no eligible scenes (all abstract or already have screenshots)');
    return;
  }

  console.log(`Stock enrichment: searching Pexels for ${candidates.length} scenes`);

  const usedQueries = new Set<string>();
  let successCount = 0;

  for (const { index, query } of candidates) {
    // Avoid duplicate queries (different scenes with same concept)
    if (usedQueries.has(query)) continue;
    usedQueries.add(query);

    console.log(`  Searching: "${query}" for scene ${index} (${scenes[index].type})`);

    const result = await searchStockMedia(query, apiKey);

    if (result) {
      const scene = scenes[index];
      scene.backgroundImage = result.dataUri;
      scene.visualSource = 'stock';
      successCount++;
      console.log(`  OK: ${result.type} (${result.attribution})`);
    } else {
      console.log(`  No results for: "${query}"`);
    }

    // Brief delay to respect rate limits (200 req/hour = ~1 every 18s)
    await sleep(500);
  }

  console.log(
    `Stock enrichment: ${successCount}/${candidates.length} scenes received stock backgrounds`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
