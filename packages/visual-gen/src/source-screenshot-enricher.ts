/**
 * Source Screenshot Enricher — captures screenshots of actual source URLs
 * referenced in the video content.
 *
 * When the narrator says "According to this Hacker News post..." or
 * "OpenAI's latest paper shows...", this enricher replaces the abstract
 * AI-generated background with a real screenshot of the ACTUAL source.
 *
 * Source screenshots are the highest-priority visual — they override
 * both AI backgrounds and company screenshots.
 *
 * @module @nexus-ai/visual-gen/source-screenshot-enricher
 */

import {
  captureWebsiteScreenshot,
  closeBrowser,
  screenshotToDataUri,
} from '@nexus-ai/asset-library';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max source screenshots per video (generous — these are the most valuable visuals) */
const MAX_SOURCE_SCREENSHOTS = 12;

/** Scene types that should NEVER get source screenshots */
const EXCLUDED_SCENE_TYPES = new Set([
  'intro',
  'outro',
  'chapter-break',
  'code-block',
  'meme-reaction',
  'map-animation',
]);

/** Domains known to block automated screenshots or require login */
const BLOCKED_DOMAINS = new Set([
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'medium.com',       // Paywall
  'nytimes.com',      // Paywall
  'wsj.com',          // Paywall
  'ft.com',           // Paywall
  'bloomberg.com',    // Paywall
]);

/** Domains that need extra wait time for JS rendering */
const SLOW_DOMAINS = new Set([
  'github.com',
  'arxiv.org',
  'huggingface.co',
  'reddit.com',
]);

// ---------------------------------------------------------------------------
// URL Analysis
// ---------------------------------------------------------------------------

/**
 * Check if a URL is suitable for screenshot capture.
 * Returns false for paywalled, login-required, or invalid URLs.
 */
function isScreenshottable(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');

    // Block known problematic domains
    if (BLOCKED_DOMAINS.has(hostname)) return false;

    // Must be http(s)
    if (!parsed.protocol.startsWith('http')) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Get appropriate wait time for a URL based on its domain.
 */
function getWaitMs(url: string): number {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (SLOW_DOMAINS.has(hostname)) return 5000;
    return 3000;
  } catch {
    return 3000;
  }
}

// ---------------------------------------------------------------------------
// Source URL extraction
// ---------------------------------------------------------------------------

export interface SourceUrl {
  url: string;
  title: string;
}

/**
 * Match source URLs to scenes based on content overlap.
 *
 * For each scene, checks if the scene content references any of the provided
 * source URLs (by title match or domain match). Assigns the best-matching
 * source URL to each scene.
 */
function matchSourcesToScenes(
  scenes: Scene[],
  sourceUrls: SourceUrl[],
): Map<number, SourceUrl> {
  const matches = new Map<number, SourceUrl>();
  const usedUrls = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Skip excluded types
    if (EXCLUDED_SCENE_TYPES.has(scene.type)) continue;

    // Already has a source URL assigned directly
    if (scene.sourceUrl) {
      const url = scene.sourceUrl;
      if (isScreenshottable(url) && !usedUrls.has(url)) {
        matches.set(i, { url, title: scene.content.slice(0, 80) });
        usedUrls.add(url);
      }
      continue;
    }

    // Try to match by content similarity
    const contentLower = scene.content.toLowerCase();
    for (const source of sourceUrls) {
      if (usedUrls.has(source.url)) continue;
      if (!isScreenshottable(source.url)) continue;

      // Match by title words (at least 3 significant words must match)
      const titleWords = source.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);

      const matchCount = titleWords.filter((w) => contentLower.includes(w)).length;

      if (matchCount >= Math.min(3, titleWords.length)) {
        matches.set(i, source);
        usedUrls.add(source.url);
        break;
      }
    }

    if (matches.size >= MAX_SOURCE_SCREENSHOTS) break;
  }

  return matches;
}

// ---------------------------------------------------------------------------
// enrichScenesWithSourceScreenshots
// ---------------------------------------------------------------------------

/**
 * Enrich scenes with screenshots of actual source URLs.
 *
 * Captures Playwright screenshots of the articles, repos, and papers
 * that the video discusses. These screenshots replace AI-generated
 * backgrounds for the specific scenes where real source context is
 * more valuable.
 *
 * @param scenes - Scene array to enrich (mutated in place)
 * @param sourceUrls - Source URLs from news-sourcing/research
 */
export async function enrichScenesWithSourceScreenshots(
  scenes: Scene[],
  sourceUrls: SourceUrl[],
): Promise<void> {
  if (sourceUrls.length === 0) {
    console.log('Source screenshot enrichment: no source URLs provided');
    return;
  }

  // Match sources to scenes
  const matches = matchSourcesToScenes(scenes, sourceUrls);

  if (matches.size === 0) {
    console.log('Source screenshot enrichment: no scene/source matches found');
    return;
  }

  console.log(
    `Source screenshot enrichment: capturing ${matches.size} source screenshots`,
  );

  let successCount = 0;
  const CONCURRENCY = 5;
  const matchEntries = Array.from(matches.entries());

  try {
    // Process in parallel batches of CONCURRENCY
    for (let batchStart = 0; batchStart < matchEntries.length; batchStart += CONCURRENCY) {
      const batch = matchEntries.slice(batchStart, batchStart + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async ([sceneIndex, source]) => {
          const waitMs = getWaitMs(source.url);
          console.log(`  Capturing: ${source.url} (wait ${waitMs}ms)`);

          const buffer = await captureWebsiteScreenshot(source.url, {
            darkMode: true,
            waitMs,
            width: 1920,
            height: 1080,
          });

          return { sceneIndex, source, buffer };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.buffer) {
          const { sceneIndex, source, buffer } = result.value;
          const dataUri = screenshotToDataUri(buffer);
          const scene = scenes[sceneIndex];

          scene.screenshotImage = dataUri;
          scene.sourceUrl = source.url;
          scene.visualSource = 'source-screenshot';

          successCount++;
          console.log(`  OK: scene ${sceneIndex} (${scene.type})`);
        } else if (result.status === 'fulfilled') {
          console.log(`  FAILED: ${result.value.source.url} — keeping existing background`);
        } else {
          console.log(`  ERROR: ${result.reason}`);
        }
      }
    }
  } finally {
    await closeBrowser();
  }

  console.log(
    `Source screenshot enrichment: ${successCount}/${matches.size} screenshots captured`,
  );
}

