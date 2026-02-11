/**
 * Meme Fetcher — Giphy API integration for reaction GIF search and download.
 *
 * Uses Giphy's API to search for reaction memes,
 * download GIF files, and convert them to data URIs for embedding.
 *
 * @module @nexus-ai/asset-library/meme/meme-fetcher
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemeResult {
  id: string;
  gifUrl: string;
  description: string;
  previewUrl: string;
}

interface GiphyImage {
  url: string;
  width: string;
  height: string;
  size?: string;
}

interface GiphyResult {
  id: string;
  title: string;
  images: {
    original?: GiphyImage;
    downsized?: GiphyImage;
    downsized_medium?: GiphyImage;
    fixed_height?: GiphyImage;
    preview_gif?: GiphyImage;
  };
}

interface GiphyResponse {
  data: GiphyResult[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GIPHY_API_BASE = 'https://api.giphy.com/v1/gifs/search';
const SEARCH_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_GIF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Curated map of reaction types to high-quality Giphy search queries.
 * Each category has 3 alternatives — if the first returns no results, try the next.
 */
export const MEME_SEARCH_QUERIES: Record<string, string[]> = {
  shocked: ['shocked face reaction', 'jaw drop reaction', 'surprised pikachu'],
  mind_blown: ['mind blown explosion', 'brain explode reaction', 'galaxy brain'],
  this_is_fine: ['this is fine fire dog', 'everything is fine fire', 'this is fine meme'],
  impressed: ['slow clap reaction', 'impressed nodding', 'respect salute'],
  skeptical: ['doubt press x', 'suspicious squint', 'not sure if'],
  rip: ['press f respect', 'funeral coffin dance', 'oof size large'],
  money: ['money printer go brr', 'shut up take my money', 'raining money'],
  speed: ['fast typing hacker', 'speed running', 'gotta go fast'],
  comparison: ['corporate needs difference', 'theyre the same picture', 'same thing meme'],
  dramatic: ['dramatic chipmunk', 'plot twist', 'dun dun dun'],
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Get the search query for a reaction type, with fallback alternatives.
 * Uses scene index for deterministic selection from the alternatives.
 */
export function getReactionQuery(reactionType: string, sceneIndex: number = 0): string {
  const queries = MEME_SEARCH_QUERIES[reactionType];
  if (!queries || queries.length === 0) {
    return reactionType; // Use the type itself as the query
  }
  return queries[sceneIndex % queries.length];
}

/**
 * Search Giphy for a reaction GIF.
 *
 * @param query  Search query string
 * @param apiKey Giphy API key (GIPHY_API_KEY env var)
 * @returns MemeResult or null if no results / API failure
 */
export async function searchMeme(query: string, apiKey: string): Promise<MemeResult | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      limit: '5',
      rating: 'pg-13',
      lang: 'en',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const response = await fetch(`${GIPHY_API_BASE}?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`Giphy: API error ${response.status} for '${query}'`);
      return null;
    }

    const data = (await response.json()) as GiphyResponse;

    if (!data.data || data.data.length === 0) {
      console.log(`Giphy: no results for '${query}'`);
      return null;
    }

    const first = data.data[0];
    // Prefer downsized (smaller file) over original for embedding
    const gifFormat = first.images.downsized_medium ?? first.images.downsized ?? first.images.original;
    const previewFormat = first.images.preview_gif ?? first.images.fixed_height;

    if (!gifFormat?.url) {
      console.log(`Giphy: no GIF format available for '${query}'`);
      return null;
    }

    console.log(`Giphy: found meme for '${query}': ${first.title || first.id}`);

    return {
      id: first.id,
      gifUrl: gifFormat.url,
      description: first.title || query,
      previewUrl: previewFormat?.url ?? gifFormat.url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Giphy: search failed for '${query}': ${message}`);
    return null;
  }
}

/**
 * Download the actual GIF file from a URL.
 *
 * @param gifUrl URL to the GIF file
 * @returns Raw buffer or null if too large / download fails
 */
export async function fetchMemeGifBuffer(gifUrl: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    const response = await fetch(gifUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`Giphy: download failed (${response.status}) for ${gifUrl}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_GIF_SIZE_BYTES) {
      console.log(`Giphy: GIF too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 5MB), skipping`);
      return null;
    }

    return buffer;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Giphy: download failed for ${gifUrl}: ${message}`);
    return null;
  }
}

/**
 * Convert a GIF buffer to a data URI.
 */
export function memeToDataUri(buffer: Buffer): string {
  return `data:image/gif;base64,${buffer.toString('base64')}`;
}
