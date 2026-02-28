/**
 * Source Screenshot Enricher — captures screenshots of actual source URLs
 * referenced in the video content.
 *
 * Source screenshots are highest-priority visuals and should represent
 * real evidence (articles, repos, tweets, papers, product pages).
 *
 * @module @nexus-ai/visual-gen/source-screenshot-enricher
 */

import {
  captureWebsiteScreenshot,
  closeBrowser,
  screenshotToDataUri,
} from '@nexus-ai/asset-library';
import type { Scene } from '@nexus-ai/director-agent';
import { captureWithAgenticBrowser } from './agentic-browser.js';
import { buildAssetCaptureStrategy } from './asset-intelligence.js';

const MAX_SOURCE_SCREENSHOTS = 20;

const EXCLUDED_SCENE_TYPES = new Set([
  'intro',
  'outro',
  'chapter-break',
  'code-block',
  'meme-reaction',
  'map-animation',
]);

export interface SourceUrl {
  url: string;
  title: string;
}

interface MatchedSource {
  source: SourceUrl;
  strategy: ReturnType<typeof buildAssetCaptureStrategy>;
}

function contentMentionsDomain(content: string, url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const base = host.split('.').slice(0, -1).join(' ');
    const normalized = content.toLowerCase();
    return normalized.includes(base) || normalized.includes(host);
  } catch {
    return false;
  }
}

function matchSourcesToScenes(
  scenes: Scene[],
  sourceUrls: SourceUrl[],
): Map<number, MatchedSource> {
  const matches = new Map<number, MatchedSource>();
  const usedNormalizedUrls = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    if (EXCLUDED_SCENE_TYPES.has(scene.type)) continue;

    // Prefer explicit sourceUrl pinned on scene
    if (scene.sourceUrl) {
      const strategy = buildAssetCaptureStrategy(scene.sourceUrl, scene.content);
      if (strategy.isScreenshottable && !usedNormalizedUrls.has(strategy.normalizedUrl)) {
        const source: SourceUrl = { url: scene.sourceUrl, title: scene.content.slice(0, 100) };
        matches.set(i, { source, strategy });
        usedNormalizedUrls.add(strategy.normalizedUrl);
      }
      continue;
    }

    const contentLower = scene.content.toLowerCase();

    for (const source of sourceUrls) {
      const strategy = buildAssetCaptureStrategy(source.url, scene.content);
      if (!strategy.isScreenshottable) continue;
      if (usedNormalizedUrls.has(strategy.normalizedUrl)) continue;

      const titleWords = source.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);

      const titleMatchCount = titleWords.filter((w) => contentLower.includes(w)).length;
      const domainMatch = contentMentionsDomain(scene.content, source.url);
      const tweetMention = strategy.sourceKind === 'tweet' && /(tweet|post|x.com|twitter)/i.test(contentLower);

      if (titleMatchCount >= Math.min(2, titleWords.length) || domainMatch || tweetMention) {
        matches.set(i, { source, strategy });
        usedNormalizedUrls.add(strategy.normalizedUrl);
        break;
      }
    }

    if (matches.size >= MAX_SOURCE_SCREENSHOTS) break;
  }

  return matches;
}

export async function enrichScenesWithSourceScreenshots(
  scenes: Scene[],
  sourceUrls: SourceUrl[],
): Promise<void> {
  if (sourceUrls.length === 0) {
    console.log('Source screenshot enrichment: no source URLs provided');
    return;
  }

  const matches = matchSourcesToScenes(scenes, sourceUrls);

  if (matches.size === 0) {
    console.log('Source screenshot enrichment: no scene/source matches found');
    return;
  }

  console.log(`Source screenshot enrichment: capturing ${matches.size} source screenshots`);

  let successCount = 0;
  const CONCURRENCY = 5;
  const matchEntries = Array.from(matches.entries());

  try {
    for (let batchStart = 0; batchStart < matchEntries.length; batchStart += CONCURRENCY) {
      const batch = matchEntries.slice(batchStart, batchStart + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async ([sceneIndex, matched]) => {
          const { source, strategy } = matched;
          const scene = scenes[sceneIndex];

          console.log(`  Capturing: ${strategy.normalizedUrl} (${strategy.sourceKind}, wait ${strategy.waitMs}ms)`);

          const buffer = await captureWebsiteScreenshot(strategy.normalizedUrl, {
            darkMode: true,
            waitMs: strategy.waitMs,
            width: 1920,
            height: 1080,
            cssSelector: scene.cssSelector ?? strategy.cssSelector,
            highlightText: scene.highlightText,
            searchObjective: scene.content?.slice(0, 200),
            agenticCaptureFn: captureWithAgenticBrowser,
          });

          return { sceneIndex, source, strategy, buffer };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.buffer) {
          const { sceneIndex, source, strategy, buffer } = result.value;
          const dataUri = screenshotToDataUri(buffer);
          const scene = scenes[sceneIndex];

          scene.screenshotImage = dataUri;
          scene.sourceUrl = source.url;
          scene.visualSource = 'source-screenshot';
          scene.screenshotDisplayMode = strategy.displayMode;

          successCount++;
          console.log(`  OK: scene ${sceneIndex} (${scene.type}) <- ${strategy.sourceKind}`);
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

  console.log(`Source screenshot enrichment: ${successCount}/${matches.size} screenshots captured`);
}
