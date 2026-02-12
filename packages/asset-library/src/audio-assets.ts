/**
 * Audio Asset Library — SFX and music path registry + scene-type mapping.
 *
 * Provides constants mapping SFX/music names to file paths, and a function
 * that returns which SFX to play for each scene type.
 *
 * @module @nexus-ai/asset-library/audio-assets
 */

import pathModule from 'path';
import { fileURLToPath } from 'url';

// Browser-safe: webpack stubs 'path' with false — guard all usage
const safeJoin = typeof pathModule?.join === 'function'
  ? pathModule.join
  : (...parts: string[]) => parts.filter(Boolean).join('/');

const safeDirname = typeof pathModule?.dirname === 'function'
  ? pathModule.dirname
  : (p: string) => p;

let __dirname_resolved = '';
if (typeof fileURLToPath === 'function') {
  try {
    __dirname_resolved = safeDirname(fileURLToPath(import.meta.url));
  } catch { /* browser — import.meta.url not a file:// URL */ }
}

// ---------------------------------------------------------------------------
// SFX Library
// ---------------------------------------------------------------------------

/** Maps SFX names to their file paths within the asset-library package. */
export const SFX_LIBRARY: Record<string, string> = {
  'whoosh-in': safeJoin(__dirname_resolved, '../sfx/whoosh-in.wav'),
  'whoosh-out': safeJoin(__dirname_resolved, '../sfx/whoosh-out.wav'),
  'impact-soft': safeJoin(__dirname_resolved, '../sfx/impact-soft.wav'),
  'impact-hard': safeJoin(__dirname_resolved, '../sfx/impact-hard.wav'),
  'click': safeJoin(__dirname_resolved, '../sfx/click.wav'),
  'reveal': safeJoin(__dirname_resolved, '../sfx/reveal.wav'),
  'transition': safeJoin(__dirname_resolved, '../sfx/transition.wav'),
};

/** All valid SFX names. */
export const SFX_NAMES = Object.keys(SFX_LIBRARY);

// ---------------------------------------------------------------------------
// Music Library
// ---------------------------------------------------------------------------

/** Maps music track names to their file paths within the asset-library package. */
export const MUSIC_LIBRARY: Record<string, string> = {
  'ambient-tech-01': safeJoin(__dirname_resolved, '../music/ambient-tech-01.wav'),
};

/** All valid music track names. */
export const MUSIC_NAMES = Object.keys(MUSIC_LIBRARY);

// ---------------------------------------------------------------------------
// Scene Type → SFX Mapping
// ---------------------------------------------------------------------------

/**
 * SFX mapping per scene type.
 *
 * Returns an array of SFX names to play at the start of a scene.
 * Components that need repetition (e.g. list-reveal playing a click per item)
 * should handle that themselves — this returns the base SFX set.
 */
const SCENE_SFX_MAP: Record<string, string[]> = {
  'intro': ['whoosh-in'],
  'outro': ['whoosh-out'],
  'chapter-break': ['transition'],
  'stat-callout': ['impact-hard'],
  'text-emphasis': ['reveal'],
  'full-screen-text': ['reveal'],
  'comparison': ['whoosh-in'],
  'list-reveal': ['click'],
  'logo-showcase': ['whoosh-in'],
  'diagram': ['reveal'],
  'code-block': ['click'],
  'timeline': ['click'],
  'quote': ['impact-soft'],
  'meme-reaction': ['whoosh-in'],
  'map-animation': ['reveal'],
  'narration-default': ['whoosh-in'],
};

/**
 * Get the SFX names to play for a given scene type.
 *
 * @param sceneType  Scene type string (e.g. 'intro', 'stat-callout')
 * @returns Array of SFX names (e.g. ['whoosh-in']). Empty array if none.
 */
export function getSfxForSceneType(sceneType: string): string[] {
  return SCENE_SFX_MAP[sceneType] ?? [];
}
