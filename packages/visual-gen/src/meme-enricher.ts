/**
 * Meme Enricher — inserts reaction GIF scenes between content scenes.
 *
 * Analyzes scene content and inserts short meme-reaction scenes at key
 * moments for humor, engagement, and pacing variety. Meme scenes borrow
 * time from the next scene to keep total video duration unchanged.
 *
 * @module @nexus-ai/visual-gen/meme-enricher
 */

import {
  selectMemeReaction,
  searchMeme,
  fetchMemeGifBuffer,
  memeToDataUri,
  getReactionQuery,
} from '@nexus-ai/asset-library';
import type { MemeContext } from '@nexus-ai/asset-library';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Duration of a meme reaction scene in frames (1.2 seconds at 30fps) */
const MEME_DURATION_FRAMES = 36;

/** Minimum remaining frames for the next scene after borrowing time */
const MIN_NEXT_SCENE_FRAMES = 120;

/** Maximum memes per video */
const MAX_MEMES = 5;

/** Maximum query retries per reaction type (try alternative queries) */
const MAX_QUERY_RETRIES = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract stat data from a stat-callout scene's visualData.
 */
function extractStat(scene: Scene): { number: string; label: string } | undefined {
  if (scene.type !== 'stat-callout') return undefined;
  const vd = scene.visualData as Record<string, unknown>;
  const number = vd.number as string | undefined;
  const label = vd.label as string | undefined;
  if (number && label) return { number, label };
  return undefined;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Enrich scenes by inserting meme reaction GIFs between content scenes.
 *
 * Analyzes each scene's content to determine if a reaction meme should follow it.
 * When a meme is inserted, it borrows frames from the next scene to maintain
 * total video duration. Returns a new array with meme scenes spliced in.
 *
 * @param scenes   Scene array (not mutated — returns a new array)
 * @param apiKey   Giphy API key (GIPHY_API_KEY)
 * @returns Enriched scene array with meme-reaction scenes inserted
 */
export async function enrichScenesWithMemes(
  scenes: Scene[],
  apiKey: string | undefined,
): Promise<Scene[]> {
  if (!apiKey) {
    console.log('Meme enrichment: skipped (no Giphy API key)');
    return scenes;
  }

  if (scenes.length < 3) {
    console.log('Meme enrichment: skipped (fewer than 3 scenes)');
    return scenes;
  }

  const result: Scene[] = [];
  let memeCount = 0;
  let previousWasMeme = false;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    result.push(scene);

    // Don't insert memes after the last scene
    if (i >= scenes.length - 1) {
      previousWasMeme = false;
      continue;
    }

    // Check if we should insert a meme after this scene
    const nextScene = scenes[i + 1];
    const nextDuration = nextScene.endFrame - nextScene.startFrame;

    // Can't borrow time if next scene is too short
    if (nextDuration < MIN_NEXT_SCENE_FRAMES + MEME_DURATION_FRAMES) {
      previousWasMeme = false;
      continue;
    }

    const sceneDuration = scene.endFrame - scene.startFrame;
    const context: MemeContext = {
      previousWasMeme,
      totalMemeCount: memeCount,
      sceneIndex: i,
    };

    const stat = extractStat(scene);
    const selection = selectMemeReaction(
      scene.content,
      scene.type,
      sceneDuration,
      context,
      stat,
    );

    if (!selection) {
      previousWasMeme = false;
      continue;
    }

    // Try to fetch the meme GIF, with query fallbacks
    let gifDataUri: string | null = null;
    let description = '';

    for (let attempt = 0; attempt < MAX_QUERY_RETRIES; attempt++) {
      const query = attempt === 0
        ? selection.searchQuery
        : getReactionQuery(selection.reactionType, i + attempt);

      const memeResult = await searchMeme(query, apiKey);
      if (!memeResult) continue;

      const buffer = await fetchMemeGifBuffer(memeResult.gifUrl);
      if (!buffer) continue;

      gifDataUri = memeToDataUri(buffer);
      description = memeResult.description;
      break;
    }

    if (!gifDataUri) {
      previousWasMeme = false;
      continue;
    }

    // Create the meme scene, borrowing time from the next scene
    const memeStartFrame = scene.endFrame;
    const memeEndFrame = memeStartFrame + MEME_DURATION_FRAMES;

    const memeScene: Scene = {
      id: `meme-${i}`,
      type: 'meme-reaction' as Scene['type'],
      startFrame: memeStartFrame,
      endFrame: memeEndFrame,
      content: '',
      visualData: {
        gifSrc: gifDataUri,
        reactionType: selection.reactionType,
        description,
      } as Scene['visualData'],
      transition: 'cut',
      sfx: ['whoosh-in'],
    };

    result.push(memeScene);

    // Shift the next scene's startFrame forward to compensate
    nextScene.startFrame += MEME_DURATION_FRAMES;

    memeCount++;
    previousWasMeme = true;

    if (memeCount >= MAX_MEMES) {
      // Push remaining scenes without checking for memes
      for (let j = i + 1; j < scenes.length; j++) {
        result.push(scenes[j]);
      }
      // Skip the outer loop for the rest
      i = scenes.length;
      break;
    }
  }

  console.log(`Meme enrichment: inserted ${memeCount} reaction memes`);
  return result;
}
