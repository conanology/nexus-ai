import type { SceneSourceMetadata, SourceBadgeOverlay } from '@nexus-ai/director-agent';
import type { AssetSourceKind } from './asset-intelligence.js';
import { buildAssetCaptureStrategy } from './asset-intelligence.js';

function extractRepoSlug(url: URL): string | undefined {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return undefined;
}

function extractTweetHandle(url: URL): string | undefined {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 3 && parts[1] === 'status') return `@${parts[0]}`;
  return undefined;
}

function kindIcon(kind: AssetSourceKind): string {
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

function kindLabel(kind: AssetSourceKind): string {
  switch (kind) {
    case 'tweet': return 'POST';
    case 'repository': return 'REPO';
    case 'article': return 'ARTICLE';
    case 'paper': return 'PAPER';
    case 'app': return 'APP';
    case 'video': return 'VIDEO';
    case 'website': return 'WEB';
    default: return 'SOURCE';
  }
}

export function deriveSourceBadgeOverlay(sourceUrl: string, metadata?: SceneSourceMetadata): SourceBadgeOverlay | null {
  const strategy = buildAssetCaptureStrategy(sourceUrl);
  if (!strategy.isScreenshottable) return null;

  let parsed: URL;
  try {
    parsed = new URL(strategy.normalizedUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  let sourceName = metadata?.sourceName || host;
  let detail: string | undefined = metadata?.detail;

  if (!metadata) {
    if (strategy.sourceKind === 'repository') {
      const slug = extractRepoSlug(parsed);
      if (slug) {
        sourceName = slug;
        detail = host;
      }
    } else if (strategy.sourceKind === 'tweet') {
      const handle = extractTweetHandle(parsed);
      if (handle) sourceName = handle;
      detail = 'social source';
    } else if (strategy.sourceKind === 'article') {
      detail = 'publisher source';
    } else if (strategy.sourceKind === 'paper') {
      detail = 'research source';
    } else if (strategy.sourceKind === 'app') {
      detail = 'product source';
    }
  }

  return {
    type: 'source-badge',
    position: 'bottom-left',
    sourceName,
    sourceKind: metadata?.sourceKind || strategy.sourceKind,
    detail,
    icon: metadata?.icon || kindIcon(strategy.sourceKind),
    verified: metadata?.verified ?? ['repository', 'article', 'paper', 'app', 'tweet'].includes(strategy.sourceKind),
    delayFrames: 10,
  };
}

export function sourceKindDisplayLabel(sourceKind?: AssetSourceKind): string {
  return kindLabel(sourceKind ?? 'unknown');
}
