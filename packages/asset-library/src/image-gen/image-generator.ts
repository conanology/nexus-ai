/**
 * Image Generator — calls Gemini 3 Pro Image Preview to generate scene backgrounds.
 *
 * Uses responseModalities: ["TEXT", "IMAGE"] to produce high-quality concept art
 * images that serve as atmospheric backgrounds behind scene text overlays.
 *
 * @module @nexus-ai/asset-library/image-gen/image-generator
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { IMAGE_STYLE_GUIDE } from './prompt-engine.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_NAME = 'gemini-3-pro-image-preview';
const REQUEST_TIMEOUT_MS = 45_000;
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageRequest {
  sceneId: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// generateSceneImage
// ---------------------------------------------------------------------------

/**
 * Generate a single scene image using Gemini 3 Pro Image Preview.
 *
 * Returns a data URI string (data:{mimeType};base64,{data}) or null on failure.
 * On first failure, retries once with a simplified prompt.
 */
export async function generateSceneImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXUS_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Image generation skipped: no GEMINI_API_KEY or NEXUS_GEMINI_API_KEY set');
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    } as Record<string, unknown>,
  });

  // First attempt
  const result = await attemptGeneration(model, prompt);
  if (result) return result;

  // Retry with simplified prompt: first 2 sentences + style guide only
  const simplified = simplifyPrompt(prompt);
  console.log('Image generation: retrying with simplified prompt...');
  const retryResult = await attemptGeneration(model, simplified);
  return retryResult;
}

/**
 * Attempt a single image generation call with timeout.
 */
async function attemptGeneration(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  prompt: string,
): Promise<string | null> {
  try {
    const result = await withTimeout(
      model.generateContent(prompt),
      REQUEST_TIMEOUT_MS,
    );

    const candidates = result.response?.candidates;
    if (!candidates || candidates.length === 0) return null;

    const parts = candidates[0].content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      const inlineData = (part as { inlineData?: { mimeType: string; data: string } }).inlineData;
      if (inlineData?.mimeType && inlineData?.data) {
        const dataUri = `data:${inlineData.mimeType};base64,${inlineData.data}`;
        const sizeBytes = Math.round((inlineData.data.length * 3) / 4);
        console.log(
          `Generated image (${formatBytes(sizeBytes)}) for scene: ${prompt.slice(0, 80)}...`,
        );
        return dataUri;
      }
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Image generation failed: ${message}`);
    return null;
  }
}

/**
 * Simplify a prompt to just the first 2 sentences of scene context + style guide.
 */
function simplifyPrompt(prompt: string): string {
  const sentences = prompt.split(/(?<=[.!?])\s+/);
  const shortContext = sentences.slice(0, 2).join(' ');
  return `CRITICAL: Generate an image with ZERO text, numbers, letters, or words of any kind. Pure visual art only.\n\n${shortContext}\n\n${IMAGE_STYLE_GUIDE}\n\nREMINDER: No text, no numbers, no letters in the image.\n\nGenerate a single stunning image.`;
}

// ---------------------------------------------------------------------------
// generateSceneImages (batched)
// ---------------------------------------------------------------------------

/**
 * Generate images for multiple scenes with controlled concurrency.
 *
 * Processes requests in batches of 2 with a 2-second delay between batches.
 * Returns a Map of sceneId -> data URI (or null for failures).
 */
export async function generateSceneImages(
  requests: ImageRequest[],
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  if (requests.length === 0) return results;

  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (req) => {
        const dataUri = await generateSceneImage(req.prompt);
        return { sceneId: req.sceneId, dataUri };
      }),
    );

    for (const { sceneId, dataUri } of batchResults) {
      results.set(sceneId, dataUri);
      completed++;
      if (dataUri) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(
      `Image generation: ${completed}/${requests.length} (${successCount} successful, ${failCount} failed)`,
    );

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < requests.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
