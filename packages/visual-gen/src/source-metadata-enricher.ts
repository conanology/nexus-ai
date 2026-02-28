import type { Scene, SceneSourceMetadata } from '@nexus-ai/director-agent';
import { buildAssetCaptureStrategy, type AssetSourceKind } from './asset-intelligence.js';

interface GithubRepoResponse {
  full_name?: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
  updated_at?: string;
}

const CACHE = new Map<string, SceneSourceMetadata>();

function iconFor(kind: AssetSourceKind): string {
  switch (kind) {
    case 'tweet': return '𝕏';
    case 'repository': return '⌘';
    case 'article': return '📰';
    case 'paper': return '📄';
    case 'app': return '◧';
    case 'video': return '▶';
    case 'website': return '🌐';
    default: return '•';
  }
}

function authorityScore(kind: AssetSourceKind): number {
  switch (kind) {
    case 'paper': return 0.93;
    case 'repository': return 0.88;
    case 'article': return 0.82;
    case 'app': return 0.76;
    case 'tweet': return 0.7;
    case 'video': return 0.7;
    case 'website': return 0.65;
    default: return 0.5;
  }
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function parseRepoSlug(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]}/${parts[1]}`;
}

function parseTweetHandle(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 3 && parts[1] === 'status') return `@${parts[0]}`;
  return null;
}

async function fetchGithubMetadata(slug: string): Promise<GithubRepoResponse | null> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as GithubRepoResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function deriveMetadataFromUrl(sourceUrl: string): Promise<SceneSourceMetadata | null> {
  const strategy = buildAssetCaptureStrategy(sourceUrl);
  if (!strategy.isScreenshottable) return null;

  let parsed: URL;
  try {
    parsed = new URL(strategy.normalizedUrl);
  } catch {
    return null;
  }

  const kind = strategy.sourceKind;
  const host = parsed.hostname.replace(/^www\./, '');

  if (kind === 'repository') {
    const slug = parseRepoSlug(parsed);
    if (slug) {
      const gh = host === 'github.com' ? await fetchGithubMetadata(slug) : null;
      const stars = typeof gh?.stargazers_count === 'number' ? formatCompactNumber(gh.stargazers_count) : null;
      const forks = typeof gh?.forks_count === 'number' ? formatCompactNumber(gh.forks_count) : null;
      const language = gh?.language ?? null;
      const detailParts = [
        stars ? `⭐ ${stars}` : null,
        forks ? `Forks ${forks}` : null,
        language ? `${language}` : null,
      ].filter(Boolean);

      return {
        sourceKind: kind,
        sourceName: gh?.full_name || slug,
        detail: detailParts.length > 0 ? detailParts.join(' • ') : host,
        icon: iconFor(kind),
        verified: true,
        authorityScore: authorityScore(kind),
        stats: {
          ...(gh?.stargazers_count ? { stars: gh.stargazers_count } : {}),
          ...(gh?.forks_count ? { forks: gh.forks_count } : {}),
          ...(gh?.language ? { language: gh.language } : {}),
        },
      };
    }
  }

  if (kind === 'tweet') {
    const handle = parseTweetHandle(parsed);
    return {
      sourceKind: kind,
      sourceName: handle || host,
      detail: 'social source',
      icon: iconFor(kind),
      verified: true,
      authorityScore: authorityScore(kind),
    };
  }

  if (kind === 'paper') {
    const id = parsed.pathname.split('/').filter(Boolean).pop();
    return {
      sourceKind: kind,
      sourceName: id ? `paper:${id}` : host,
      detail: host,
      icon: iconFor(kind),
      verified: true,
      authorityScore: authorityScore(kind),
    };
  }

  return {
    sourceKind: kind,
    sourceName: host,
    detail:
      kind === 'article' ? 'publisher source' :
      kind === 'app' ? 'product source' :
      kind === 'video' ? 'video source' :
      'web source',
    icon: iconFor(kind),
    verified: ['article', 'app', 'video', 'website'].includes(kind),
    authorityScore: authorityScore(kind),
  };
}

export async function enrichScenesWithSourceMetadata(scenes: Scene[]): Promise<void> {
  const targets = scenes.filter((s) => Boolean(s.sourceUrl));
  if (targets.length === 0) return;

  const uniqueUrls = Array.from(new Set(targets.map((s) => s.sourceUrl!).filter(Boolean)));

  for (const url of uniqueUrls) {
    if (CACHE.has(url)) continue;
    const meta = await deriveMetadataFromUrl(url);
    if (meta) CACHE.set(url, meta);
  }

  for (const scene of targets) {
    const url = scene.sourceUrl!;
    const meta = CACHE.get(url);
    if (meta) scene.sourceMetadata = meta;
  }
}
