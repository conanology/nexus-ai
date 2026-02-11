/**
 * Logo Fetcher — downloads company logos via Clearbit / Logo.dev / Google Favicon APIs.
 *
 * Fallback chain: Clearbit (256px) -> Logo.dev (128px) -> Google Favicon (128px) -> null
 *
 * @module @nexus-ai/asset-library/logo-fetcher
 */

import { getLogoEntry, getLogoDomain } from './logos.js';
import type { FetchedLogo } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 1_000;
const MAX_RETRIES = 1;
const MAX_LOGO_SIZE_BYTES = 200 * 1024; // 200KB cap to prevent JSON prop bloat

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'image/png' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (response.ok) return response;
    } catch {
      // Timeout or network error
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  return null;
}

async function fetchImageBuffer(url: string, sourceName: string, domain: string): Promise<Buffer | null> {
  const response = await fetchWithRetry(url);
  if (!response) return null;

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_LOGO_SIZE_BYTES) {
    console.log(
      `Logo for ${domain} from ${sourceName} exceeds 200KB (${buffer.length} bytes) — skipping`,
    );
    return null;
  }

  console.log(`Fetched logo for ${domain} via ${sourceName}: ${buffer.length} bytes`);
  return buffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a company logo by domain.
 *
 * Fallback chain: Clearbit (256px) -> Logo.dev (128px) -> Google Favicon (128px) -> null
 * Returns a PNG image as a Buffer, or null if all sources fail or exceed 200KB.
 */
export async function fetchLogo(domain: string): Promise<Buffer | null> {
  // Primary: Clearbit (256px)
  const clearbitUrl = `https://logo.clearbit.com/${domain}?size=256`;
  const clearbitBuffer = await fetchImageBuffer(clearbitUrl, 'Clearbit', domain);
  if (clearbitBuffer) return clearbitBuffer;

  // Second fallback: Logo.dev (128px)
  const logoDevUrl = `https://img.logo.dev/${domain}?token=pk_anonymous&size=128&format=png`;
  const logoDevBuffer = await fetchImageBuffer(logoDevUrl, 'Logo.dev', domain);
  if (logoDevBuffer) return logoDevBuffer;

  // Third fallback: Google Favicon (128px)
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  const faviconBuffer = await fetchImageBuffer(faviconUrl, 'Google Favicon', domain);
  if (faviconBuffer) return faviconBuffer;

  console.log(`Failed to fetch logo for ${domain}: all sources exhausted`);
  return null;
}

/**
 * Batch-fetch logos for an array of company names.
 *
 * Looks up domains via getLogoDomain(), fetches all in parallel,
 * and returns a Map of companyName -> image Buffer (or null).
 */
export async function fetchLogosForScene(
  logoNames: string[],
): Promise<Map<string, Buffer | null>> {
  const results = new Map<string, Buffer | null>();

  const tasks = logoNames.map(async (name) => {
    const domain = getLogoDomain(name);
    if (!domain) {
      console.log(`No domain found for company: ${name}`);
      results.set(name, null);
      return;
    }
    const buffer = await fetchLogo(domain);
    results.set(name, buffer);
  });

  await Promise.all(tasks);
  return results;
}

/**
 * Convert a PNG image buffer to a base64 data URI.
 */
export function logoBufferToDataUri(buffer: Buffer): string {
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * Fetch logos for a list of company names and return enriched FetchedLogo objects.
 *
 * Convenience wrapper that combines fetchLogosForScene + logoBufferToDataUri
 * with logo entry metadata.
 */
export async function fetchLogosEnriched(
  logoNames: string[],
): Promise<FetchedLogo[]> {
  const bufferMap = await fetchLogosForScene(logoNames);

  return logoNames.map((name) => {
    const entry = getLogoEntry(name);
    const buffer = bufferMap.get(name) ?? null;

    return {
      name: entry?.name ?? name,
      abbreviation: entry?.abbreviation ?? name.charAt(0).toUpperCase(),
      color: entry?.color ?? '#ffffff',
      dataUri: buffer ? logoBufferToDataUri(buffer) : null,
    };
  });
}
