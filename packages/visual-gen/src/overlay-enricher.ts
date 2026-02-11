/**
 * Overlay Enricher — automatically adds contextual overlays to scenes.
 *
 * Analyzes scene content and adds:
 * - Corner logo overlays when companies are mentioned
 * - Source citation overlays for stats and cited claims
 * - Info badge overlays for contextual metadata
 * - Floating label overlays for comparison column headers
 *
 * @module @nexus-ai/visual-gen/overlay-enricher
 */

import { LOGOS, getLogoEntry } from '@nexus-ai/asset-library';
import type { Scene, SceneOverlay, CornerLogoOverlay, SourceCitationOverlay, InfoBadgeOverlay, FloatingLabelOverlay } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_OVERLAYS_PER_SCENE = 3;

/** Scene types that never get overlays */
const EXCLUDED_SCENE_TYPES = new Set(['intro', 'outro', 'code-block']);

/** Default delay frames for each overlay type */
const DELAY = {
  'corner-logo': 15,
  'info-badge': 20,
  'source-citation': 30,
  'floating-label': 15,
} as const;

// ---------------------------------------------------------------------------
// Company name detection
// ---------------------------------------------------------------------------

/** All known company names from the LOGOS registry, sorted longest first */
const COMPANY_NAMES = Object.values(LOGOS)
  .map((entry) => entry.name)
  .sort((a, b) => b.length - a.length);

/**
 * Find company names mentioned in text. Returns unique matches.
 */
function findCompanyMentions(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();

  for (const name of COMPANY_NAMES) {
    if (lowerText.includes(name.toLowerCase())) {
      found.push(name);
    }
  }

  return found;
}

/**
 * Extract all text from a scene: content + visualData string fields.
 */
function extractAllText(scene: Scene): string {
  const parts: string[] = [scene.content];
  const vd = scene.visualData as Record<string, unknown>;

  for (const value of Object.values(vd)) {
    if (typeof value === 'string') {
      parts.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          parts.push(item);
        } else if (typeof item === 'object' && item !== null) {
          for (const v of Object.values(item as Record<string, unknown>)) {
            if (typeof v === 'string') parts.push(v);
          }
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const v of Object.values(value as Record<string, unknown>)) {
        if (typeof v === 'string') parts.push(v);
      }
    }
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Source citation detection
// ---------------------------------------------------------------------------

const CITATION_PATTERNS: RegExp[] = [
  /according to ([A-Z][A-Za-z\s]+?)(?:,|\.|$)/i,
  /reported by ([A-Z][A-Za-z\s]+?)(?:,|\.|$)/i,
  /([A-Z][A-Za-z\s]+?) found that/i,
  /([A-Z][A-Za-z\s]+?) reported/i,
  /source:\s*(.+?)(?:\.|$)/i,
];

/**
 * Try to extract a source citation from scene text.
 */
function extractSourceCitation(text: string): string | null {
  for (const pattern of CITATION_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

/**
 * Enrich scenes with contextual overlay data.
 *
 * Analyzes scene content and automatically adds overlays for:
 * - Company logos when companies are mentioned (not on logo-showcase scenes)
 * - Source citations for stats and attributed claims
 * - Info badges with contextual metadata
 * - Floating labels on comparison scenes
 *
 * @param scenes - Scene array to enrich (mutated in place)
 * @param fetchedLogos - Map of company name → logo data URI (from logo enrichment)
 * @returns The enriched scene array
 */
export function enrichScenesWithOverlays(
  scenes: Scene[],
  fetchedLogos: Map<string, string | null>,
): Scene[] {
  let totalOverlays = 0;
  let scenesWithOverlays = 0;

  for (const scene of scenes) {
    if (EXCLUDED_SCENE_TYPES.has(scene.type)) continue;

    const overlays: SceneOverlay[] = [];
    const allText = extractAllText(scene);

    // A. Company logo overlays
    if (scene.type !== 'logo-showcase') {
      const companies = findCompanyMentions(allText);
      if (companies.length > 0) {
        const company = companies[0]; // pick the most prominent (longest match first)
        const entry = getLogoEntry(company);
        if (entry) {
          const logoUri = fetchedLogos.get(company) ?? undefined;
          const overlay: CornerLogoOverlay = {
            type: 'corner-logo',
            position: 'top-right',
            companyName: entry.name,
            logoSrc: logoUri ?? undefined,
            brandColor: entry.color,
            delayFrames: DELAY['corner-logo'],
          };
          overlays.push(overlay);
        }
      }
    }

    // B. Source citation overlays
    if (scene.type === 'stat-callout') {
      const citation = extractSourceCitation(allText);
      if (citation) {
        const overlay: SourceCitationOverlay = {
          type: 'source-citation',
          position: 'bottom-left',
          source: `Source: ${citation}`,
          delayFrames: DELAY['source-citation'],
        };
        overlays.push(overlay);
      } else {
        // Generic citation for stats
        const vd = scene.visualData as Record<string, unknown>;
        const label = (vd.label as string) ?? '';
        if (label) {
          const overlay: SourceCitationOverlay = {
            type: 'source-citation',
            position: 'bottom-left',
            source: `Source: Industry data`,
            delayFrames: DELAY['source-citation'],
          };
          overlays.push(overlay);
        }
      }
    } else {
      // Non-stat scenes: only add citation if explicit pattern found
      const citation = extractSourceCitation(allText);
      if (citation) {
        const overlay: SourceCitationOverlay = {
          type: 'source-citation',
          position: 'bottom-left',
          source: `Source: ${citation}`,
          delayFrames: DELAY['source-citation'],
        };
        overlays.push(overlay);
      }
    }

    // C. Info badge overlays
    if (scene.type === 'chapter-break') {
      const vd = scene.visualData as Record<string, unknown>;
      const chapterNumber = vd.chapterNumber as number | undefined;
      if (chapterNumber != null) {
        const overlay: InfoBadgeOverlay = {
          type: 'info-badge',
          position: 'top-right',
          label: `Chapter ${chapterNumber}`,
          icon: '📖',
          delayFrames: DELAY['info-badge'],
        };
        overlays.push(overlay);
      }
    }

    // D. Floating label overlays for comparison scenes
    if (scene.type === 'comparison') {
      const leftLabel: FloatingLabelOverlay = {
        type: 'floating-label',
        position: 'top-left',
        text: 'THE OLD WAY',
        delayFrames: DELAY['floating-label'],
      };
      const rightLabel: FloatingLabelOverlay = {
        type: 'floating-label',
        position: 'top-right',
        text: 'THE NEW WAY',
        delayFrames: DELAY['floating-label'],
      };
      overlays.push(leftLabel, rightLabel);
    }

    // Enforce max overlays per scene
    const trimmed = overlays.slice(0, MAX_OVERLAYS_PER_SCENE);

    if (trimmed.length > 0) {
      scene.overlays = trimmed;
      totalOverlays += trimmed.length;
      scenesWithOverlays++;
    }
  }

  console.log(
    `Overlay enrichment: added ${totalOverlays} overlays across ${scenesWithOverlays} scenes`,
  );

  return scenes;
}
