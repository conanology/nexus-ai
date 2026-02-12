/**
 * Content Screenshot Enricher — captures screenshots of websites mentioned
 * in scene narration text.
 *
 * Scans narrator text for company/product/platform mentions and screenshots
 * their websites. This is a broad-coverage enricher that goes beyond the
 * company screenshot enricher by mapping 100+ known tech names to URLs.
 *
 * @module @nexus-ai/visual-gen/content-screenshot-enricher
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

/** Max content screenshots per video */
const MAX_CONTENT_SCREENSHOTS = 20;

/** Scene types that should NEVER get content screenshots */
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
  'medium.com',
  'nytimes.com',
  'wsj.com',
  'ft.com',
  'bloomberg.com',
]);

// ---------------------------------------------------------------------------
// Known URL Map — 100+ tech companies/platforms/products
// ---------------------------------------------------------------------------

const CONTENT_URL_MAP: Record<string, string> = {
  // Major tech companies
  'openai': 'https://openai.com',
  'anthropic': 'https://anthropic.com',
  'google': 'https://google.com',
  'microsoft': 'https://microsoft.com',
  'meta': 'https://about.meta.com',
  'apple': 'https://apple.com',
  'amazon': 'https://aws.amazon.com',
  'nvidia': 'https://nvidia.com',
  'intel': 'https://intel.com',
  'amd': 'https://amd.com',
  'ibm': 'https://ibm.com',
  'oracle': 'https://oracle.com',
  'salesforce': 'https://salesforce.com',
  'adobe': 'https://adobe.com',
  'tesla': 'https://tesla.com',
  'samsung': 'https://samsung.com',
  'sony': 'https://sony.com',

  // AI platforms and products
  'chatgpt': 'https://chat.openai.com',
  'claude': 'https://claude.ai',
  'gemini': 'https://gemini.google.com',
  'midjourney': 'https://midjourney.com',
  'stable diffusion': 'https://stability.ai',
  'stability ai': 'https://stability.ai',
  'dall-e': 'https://openai.com/dall-e-3',
  'perplexity': 'https://perplexity.ai',
  'copilot': 'https://copilot.microsoft.com',
  'hugging face': 'https://huggingface.co',
  'huggingface': 'https://huggingface.co',
  'replicate': 'https://replicate.com',
  'together ai': 'https://together.ai',
  'groq': 'https://groq.com',
  'mistral': 'https://mistral.ai',
  'cohere': 'https://cohere.com',
  'deepmind': 'https://deepmind.google',

  // Developer tools and platforms
  'github': 'https://github.com',
  'gitlab': 'https://gitlab.com',
  'bitbucket': 'https://bitbucket.org',
  'stack overflow': 'https://stackoverflow.com',
  'stackoverflow': 'https://stackoverflow.com',
  'vercel': 'https://vercel.com',
  'netlify': 'https://netlify.com',
  'supabase': 'https://supabase.com',
  'firebase': 'https://firebase.google.com',
  'docker': 'https://docker.com',
  'kubernetes': 'https://kubernetes.io',
  'terraform': 'https://terraform.io',
  'cloudflare': 'https://cloudflare.com',
  'railway': 'https://railway.app',
  'render': 'https://render.com',
  'fly.io': 'https://fly.io',
  'deno': 'https://deno.com',
  'bun': 'https://bun.sh',
  'npm': 'https://npmjs.com',
  'rust': 'https://rust-lang.org',
  'golang': 'https://go.dev',
  'python': 'https://python.org',
  'typescript': 'https://typescriptlang.org',
  'react': 'https://react.dev',
  'nextjs': 'https://nextjs.org',
  'next.js': 'https://nextjs.org',
  'svelte': 'https://svelte.dev',
  'vue': 'https://vuejs.org',
  'angular': 'https://angular.dev',
  'tailwind': 'https://tailwindcss.com',
  'prisma': 'https://prisma.io',
  'drizzle': 'https://orm.drizzle.team',

  // Data / Infrastructure
  'databricks': 'https://databricks.com',
  'snowflake': 'https://snowflake.com',
  'mongodb': 'https://mongodb.com',
  'postgresql': 'https://postgresql.org',
  'redis': 'https://redis.io',
  'elastic': 'https://elastic.co',
  'kafka': 'https://kafka.apache.org',
  'datadog': 'https://datadoghq.com',
  'grafana': 'https://grafana.com',
  'splunk': 'https://splunk.com',
  'confluent': 'https://confluent.io',
  'pinecone': 'https://pinecone.io',
  'weaviate': 'https://weaviate.io',
  'chromadb': 'https://trychroma.com',

  // SaaS / Business
  'stripe': 'https://stripe.com',
  'shopify': 'https://shopify.com',
  'twilio': 'https://twilio.com',
  'slack': 'https://slack.com',
  'notion': 'https://notion.so',
  'figma': 'https://figma.com',
  'canva': 'https://canva.com',
  'atlassian': 'https://atlassian.com',
  'jira': 'https://atlassian.com/software/jira',
  'confluence': 'https://atlassian.com/software/confluence',
  'hubspot': 'https://hubspot.com',
  'zendesk': 'https://zendesk.com',
  'intercom': 'https://intercom.com',
  'linear': 'https://linear.app',
  'asana': 'https://asana.com',
  'monday.com': 'https://monday.com',
  'airtable': 'https://airtable.com',
  'retool': 'https://retool.com',
  'zapier': 'https://zapier.com',
  'plaid': 'https://plaid.com',
  'klarna': 'https://klarna.com',

  // Cloud providers
  'aws': 'https://aws.amazon.com',
  'azure': 'https://azure.microsoft.com',
  'gcp': 'https://cloud.google.com',
  'google cloud': 'https://cloud.google.com',
  'digitalocean': 'https://digitalocean.com',
  'linode': 'https://linode.com',
  'hetzner': 'https://hetzner.com',

  // Security
  'crowdstrike': 'https://crowdstrike.com',
  'palo alto': 'https://paloaltonetworks.com',
  'fortinet': 'https://fortinet.com',
  'okta': 'https://okta.com',
  'auth0': 'https://auth0.com',
  'cloudflare zero trust': 'https://cloudflare.com/zero-trust',
  '1password': 'https://1password.com',

  // Social / Media
  'discord': 'https://discord.com',
  'reddit': 'https://reddit.com',
  'twitch': 'https://twitch.tv',
  'youtube': 'https://youtube.com',
  'spotify': 'https://spotify.com',
  'tiktok': 'https://tiktok.com',

  // Crypto / Blockchain
  'bitcoin': 'https://bitcoin.org',
  'ethereum': 'https://ethereum.org',
  'solana': 'https://solana.com',
  'coinbase': 'https://coinbase.com',

  // Research / Education
  'arxiv': 'https://arxiv.org',
  'wikipedia': 'https://wikipedia.org',
  'hacker news': 'https://news.ycombinator.com',
  'techcrunch': 'https://techcrunch.com',
  'the verge': 'https://theverge.com',
  'ars technica': 'https://arstechnica.com',
  'wired': 'https://wired.com',
};

// Sort keys longest-first to match "hugging face" before "face"
const SORTED_CONTENT_KEYS = Object.keys(CONTENT_URL_MAP).sort(
  (a, b) => b.length - a.length,
);

// ---------------------------------------------------------------------------
// URL matching
// ---------------------------------------------------------------------------

function isScreenshottable(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    if (BLOCKED_DOMAINS.has(hostname)) return false;
    if (!parsed.protocol.startsWith('http')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the most relevant content URL mention from scene text.
 * Returns the first match found (longest-first matching).
 */
function extractContentUrl(text: string): { name: string; url: string } | null {
  const lower = text.toLowerCase();

  for (const key of SORTED_CONTENT_KEYS) {
    // Word-boundary-ish matching: check the character before and after
    const idx = lower.indexOf(key);
    if (idx === -1) continue;

    const before = idx === 0 ? ' ' : lower[idx - 1];
    const after = idx + key.length >= lower.length ? ' ' : lower[idx + key.length];

    // Ensure it's a word boundary (not part of a larger word)
    if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;

    const url = CONTENT_URL_MAP[key];
    if (isScreenshottable(url)) {
      return { name: key, url };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// enrichScenesWithContentScreenshots
// ---------------------------------------------------------------------------

/**
 * Enrich scenes with screenshots of websites mentioned in narrator text.
 *
 * Scans each scene's content for known company/platform mentions,
 * deduplicates URLs, and captures Playwright screenshots.
 * Skips scenes that already have source screenshots.
 *
 * @param scenes - Scene array to enrich (mutated in place)
 */
export async function enrichScenesWithContentScreenshots(
  scenes: Scene[],
): Promise<void> {
  // Build list of candidates: scene index + URL to capture
  const candidates: Array<{ index: number; name: string; url: string }> = [];
  const usedUrls = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Skip excluded types
    if (EXCLUDED_SCENE_TYPES.has(scene.type)) continue;

    // Skip scenes that already have screenshots (source screenshots have priority)
    if (scene.screenshotImage) continue;

    const match = extractContentUrl(scene.content);
    if (!match) continue;

    // Deduplicate: one screenshot per URL across entire video
    if (usedUrls.has(match.url)) continue;
    usedUrls.add(match.url);

    candidates.push({ index: i, name: match.name, url: match.url });

    if (candidates.length >= MAX_CONTENT_SCREENSHOTS) break;
  }

  if (candidates.length === 0) {
    console.log('Content screenshot enrichment: no content URL mentions found');
    return;
  }

  console.log(
    `Content screenshot enrichment: capturing ${candidates.length} screenshots`,
  );

  let successCount = 0;
  const CONCURRENCY = 5;

  try {
    // Process in parallel batches of CONCURRENCY
    for (let batchStart = 0; batchStart < candidates.length; batchStart += CONCURRENCY) {
      const batch = candidates.slice(batchStart, batchStart + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async ({ index, name, url }) => {
          console.log(`  Capturing: ${name} (${url})`);

          const buffer = await captureWebsiteScreenshot(url, {
            darkMode: true,
            waitMs: 3000,
            width: 1920,
            height: 1080,
          });

          return { index, name, url, buffer };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.buffer) {
          const { index, name, buffer } = result.value;
          const dataUri = screenshotToDataUri(buffer);
          const scene = scenes[index];

          scene.screenshotImage = dataUri;
          scene.visualSource = 'content-screenshot';

          successCount++;
          console.log(`  OK: scene ${index} (${scene.type}) — ${name}`);
        } else if (result.status === 'fulfilled') {
          console.log(`  FAILED: ${result.value.url} — keeping existing background`);
        } else {
          console.log(`  ERROR: ${result.reason}`);
        }
      }
    }
  } finally {
    await closeBrowser();
  }

  console.log(
    `Content screenshot enrichment: ${successCount}/${candidates.length} screenshots captured`,
  );
}

