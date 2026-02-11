/**
 * Screenshot Enricher — adds real website screenshots as scene backgrounds.
 *
 * Scans scenes for company/product mentions that have URL_MAP entries,
 * captures screenshots using Playwright, and sets screenshotImage on
 * eligible scenes. Screenshots complement AI-generated images by providing
 * real visual context for specific companies discussed in the video.
 *
 * @module @nexus-ai/visual-gen/screenshot-enricher
 */

import {
  resolveScreenshotUrl,
  captureWebsiteScreenshot,
  closeBrowser,
  screenshotToDataUri,
} from '@nexus-ai/asset-library';
import type { UrlEntry } from '@nexus-ai/asset-library';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max screenshots per video — screenshots are for variety, not the primary visual */
const MAX_SCREENSHOTS_PER_VIDEO = 5;

/** Scene types eligible for screenshots */
const ELIGIBLE_SCENE_TYPES = new Set([
  'logo-showcase',
  'stat-callout',
  'narration-default',
]);

/** Scene types that should NEVER get screenshots */
const EXCLUDED_SCENE_TYPES = new Set([
  'intro',
  'outro',
  'chapter-break',
  'code-block',
  'meme-reaction',
  'comparison',
  'diagram',
  'timeline',
  'list-reveal',
  'quote',
  'text-emphasis',
  'full-screen-text',
]);

// ---------------------------------------------------------------------------
// Company name extraction
// ---------------------------------------------------------------------------

/** Known company/product names to search for in scene content */
const KNOWN_NAMES = [
  'Klarna', 'Salesforce', 'Slack', 'OpenAI', 'GitHub', 'Notion', 'Figma',
  'Stripe', 'Shopify', 'NVIDIA', 'Google', 'Microsoft', 'Meta', 'Amazon',
  'Apple', 'Atlassian', 'HubSpot', 'Zendesk', 'ServiceNow', 'Workday',
  'ChatGPT', 'Anthropic', 'Midjourney', 'Vercel', 'Supabase',
  'Databricks', 'Snowflake', 'Twilio', 'Datadog', 'MongoDB',
  'AWS', 'Azure', 'Facebook', 'Instagram', 'WhatsApp', 'Claude',
  'Copilot', 'GPT-4', 'DALL-E',
];

interface CompanyMatch {
  name: string;
  urlEntry: UrlEntry;
}

/**
 * Extract company/product names from scene content and visualData.
 */
function extractCompanyMentions(scene: Scene): CompanyMatch | null {
  // Build search text from content + relevant visualData fields
  let searchText = scene.content || '';

  const vd = scene.visualData as Record<string, unknown>;
  if (vd) {
    if (typeof vd.label === 'string') searchText += ' ' + vd.label;
    if (typeof vd.phrase === 'string') searchText += ' ' + vd.phrase;
    if (typeof vd.text === 'string') searchText += ' ' + vd.text;

    // Logo-showcase: extract logo names
    if (Array.isArray(vd.logos)) {
      for (const logo of vd.logos) {
        if (typeof (logo as { name?: string }).name === 'string') {
          searchText += ' ' + (logo as { name: string }).name;
        }
      }
    }
  }

  const textLower = searchText.toLowerCase();

  for (const name of KNOWN_NAMES) {
    if (textLower.includes(name.toLowerCase())) {
      const urlEntry = resolveScreenshotUrl(name);
      if (urlEntry) {
        return { name, urlEntry };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// enrichScenesWithScreenshots
// ---------------------------------------------------------------------------

/**
 * Enrich scenes with real website screenshots.
 *
 * Scans scenes for company/product mentions, captures screenshots using
 * Playwright, and sets scene.screenshotImage. Screenshots replace the
 * AI-generated backgroundImage for the specific scene where a real screenshot
 * provides more context.
 *
 * Mutates scenes in place.
 */
export async function enrichScenesWithScreenshots(
  scenes: Scene[],
): Promise<void> {
  // Collect eligible scenes with company matches
  const candidates: Array<{ sceneIndex: number; match: CompanyMatch }> = [];
  const capturedCompanies = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Skip ineligible scene types
    if (!ELIGIBLE_SCENE_TYPES.has(scene.type)) continue;
    if (EXCLUDED_SCENE_TYPES.has(scene.type)) continue;

    const match = extractCompanyMentions(scene);
    if (!match) continue;

    // Only one screenshot per company (avoid duplicates)
    const companyKey = match.name.toLowerCase();
    if (capturedCompanies.has(companyKey)) continue;

    candidates.push({ sceneIndex: i, match });
    capturedCompanies.add(companyKey);

    // Stop if we've reached the max
    if (candidates.length >= MAX_SCREENSHOTS_PER_VIDEO) break;
  }

  if (candidates.length === 0) {
    console.log('Screenshot enrichment: no eligible scenes with company mentions');
    return;
  }

  console.log(
    `Screenshot enrichment: capturing ${candidates.length} screenshots for [${
      candidates.map((c) => c.match.name).join(', ')
    }]`,
  );

  let successCount = 0;

  try {
    for (const { sceneIndex, match } of candidates) {
      const { urlEntry } = match;
      const url = urlEntry.darkModeUrl ?? urlEntry.url;

      const buffer = await captureWebsiteScreenshot(url, {
        darkMode: true,
        waitForSelector: urlEntry.waitForSelector,
        ...(urlEntry.clip ? { clip: urlEntry.clip } : {}),
      });

      if (buffer) {
        const dataUri = screenshotToDataUri(buffer);
        const scene = scenes[sceneIndex];

        // Screenshot takes priority — set as screenshotImage
        scene.screenshotImage = dataUri;

        successCount++;
      }

      // Brief delay between captures
      if (successCount < candidates.length) {
        await sleep(1000);
      }
    }
  } finally {
    await closeBrowser();
  }

  console.log(
    `Screenshot enrichment: ${successCount}/${candidates.length} screenshots captured successfully`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
