/**
 * Asset Intelligence
 *
 * Classifies source URLs (tweet/repo/article/app/etc.) and generates
 * capture strategies used by visual enrichers.
 *
 * @module @nexus-ai/visual-gen/asset-intelligence
 */

export type AssetSourceKind =
  | 'tweet'
  | 'repository'
  | 'article'
  | 'paper'
  | 'app'
  | 'website'
  | 'video'
  | 'unknown';

export interface AssetCaptureStrategy {
  originalUrl: string;
  normalizedUrl: string;
  sourceKind: AssetSourceKind;
  hostname: string;
  waitMs: number;
  cssSelector?: string;
  displayMode: 'foreground' | 'background';
  isScreenshottable: boolean;
  blockedReason?: string;
}

const BLOCKED_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'nytimes.com',
  'wsj.com',
  'ft.com',
  'bloomberg.com',
]);

const ARTICLE_DOMAINS = new Set([
  'techcrunch.com',
  'theverge.com',
  'arstechnica.com',
  'wired.com',
  'news.ycombinator.com',
  'reddit.com',
  'dev.to',
  'substack.com',
]);

const APP_DOMAINS = new Set([
  'vercel.com',
  'supabase.com',
  'stripe.com',
  'linear.app',
  'notion.so',
  'figma.com',
  'cursor.com',
  'replit.com',
]);

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
}

function normalizeTwitterUrl(parsed: URL): string {
  const path = parsed.pathname;
  const search = parsed.search || '';

  // Prefer vxtwitter for public rendering/capture stability.
  // Keep path/search to preserve thread/locale context when present.
  return `https://vxtwitter.com${path}${search}`;
}

function classifyByUrl(parsed: URL): AssetSourceKind {
  const host = normalizeHost(parsed.hostname);
  const path = parsed.pathname.toLowerCase();

  if ((host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') && path.includes('/status/')) {
    return 'tweet';
  }

  if (host === 'github.com' || host === 'gitlab.com') {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) return 'repository';
    return 'website';
  }

  if (host === 'arxiv.org' || host === 'doi.org' || host === 'semanticscholar.org') {
    return 'paper';
  }

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'vimeo.com') {
    return 'video';
  }

  if (ARTICLE_DOMAINS.has(host)) {
    return 'article';
  }

  if (APP_DOMAINS.has(host)) {
    return 'app';
  }

  if (path.includes('/blog') || path.includes('/news') || path.includes('/article')) {
    return 'article';
  }

  return 'website';
}

function getDefaultWaitMs(kind: AssetSourceKind, host: string): number {
  if (kind === 'repository') return 5000;
  if (kind === 'tweet') return 2500;
  if (kind === 'article' || kind === 'paper') return 4000;
  if (host === 'huggingface.co' || host === 'reddit.com') return 5000;
  return 3000;
}

function getDefaultSelector(kind: AssetSourceKind): string | undefined {
  switch (kind) {
    case 'tweet':
      return 'article, main';
    case 'repository':
      return 'main';
    case 'article':
    case 'paper':
      return 'article, main';
    default:
      return undefined;
  }
}

function computeDisplayMode(kind: AssetSourceKind, content?: string): 'foreground' | 'background' {
  if (kind === 'tweet' || kind === 'repository' || kind === 'article' || kind === 'paper') {
    return 'foreground';
  }

  const text = (content || '').toLowerCase().slice(0, 80);
  if (text.includes('according to') || text.includes('source') || text.includes('official')) {
    return 'foreground';
  }

  return 'background';
}

export function buildAssetCaptureStrategy(url: string, sceneContent?: string): AssetCaptureStrategy {
  const originalUrl = (url || '').trim();

  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return {
      originalUrl,
      normalizedUrl: originalUrl,
      sourceKind: 'unknown',
      hostname: '',
      waitMs: 3000,
      displayMode: 'background',
      isScreenshottable: false,
      blockedReason: 'invalid-url',
    };
  }

  const hostname = normalizeHost(parsed.hostname);

  if (!parsed.protocol.startsWith('http')) {
    return {
      originalUrl,
      normalizedUrl: originalUrl,
      sourceKind: 'unknown',
      hostname,
      waitMs: 3000,
      displayMode: 'background',
      isScreenshottable: false,
      blockedReason: 'unsupported-protocol',
    };
  }

  if (BLOCKED_DOMAINS.has(hostname)) {
    return {
      originalUrl,
      normalizedUrl: originalUrl,
      sourceKind: 'unknown',
      hostname,
      waitMs: 3000,
      displayMode: 'background',
      isScreenshottable: false,
      blockedReason: 'blocked-domain',
    };
  }

  const sourceKind = classifyByUrl(parsed);
  const normalizedUrl =
    sourceKind === 'tweet' ? normalizeTwitterUrl(parsed) : parsed.toString();

  return {
    originalUrl,
    normalizedUrl,
    sourceKind,
    hostname,
    waitMs: getDefaultWaitMs(sourceKind, hostname),
    cssSelector: getDefaultSelector(sourceKind),
    displayMode: computeDisplayMode(sourceKind, sceneContent),
    isScreenshottable: true,
  };
}
