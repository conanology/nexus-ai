/**
 * Gemini Image Provider implementation
 * Primary image generation provider for NEXUS-AI pipeline
 *
 * @module @nexus-ai/core/providers/image/gemini-image-provider
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ImageProvider, ImageOptions, ImageResult } from '../../types/providers.js';
import { withRetry } from '../../utils/with-retry.js';
import { NexusError } from '../../errors/index.js';
import { getSecret } from '../../secrets/index.js';
import { CloudStorageClient } from '../../storage/cloud-storage-client.js';
import { Readable } from 'stream';

// =============================================================================
// Constants
// =============================================================================

/** Default model for image generation - Gemini 3 Pro Image */
const DEFAULT_MODEL = 'gemini-3-pro-image-preview';

/** NFR22: Default number of A/B variants */
const DEFAULT_COUNT = 3;

/** Default image dimensions for YouTube thumbnails (16:9) */
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

/**
 * Pricing per image (Gemini image generation)
 */
const COST_PER_IMAGE = 0.04; // ~$0.04 per image

// =============================================================================
// GeminiImageProvider
// =============================================================================

/**
 * Gemini Image Provider
 *
 * Implements the ImageProvider interface using Google's Gemini image generation.
 * Generates AI thumbnails for YouTube videos with A/B variant support.
 *
 * @example
 * ```typescript
 * const provider = new GeminiImageProvider();
 * const result = await provider.generate('AI robot reading news', { count: 3 });
 * console.log(result.imageUrls); // Array of 3 image URLs
 * ```
 */
export class GeminiImageProvider implements ImageProvider {
  /** Provider name for withFallback tracking */
  readonly name: string;

  /** Model identifier */
  private readonly model: string;

  /** Storage client for uploading images */
  private storageClient: CloudStorageClient | null = null;

  /**
   * Create a new Gemini Image provider
   * @param model - Model name (default: 'gemini-2.0-flash-exp')
   */
  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
    this.name = model;
  }

  /**
   * Get or create storage client
   */
  private getStorageClient(): CloudStorageClient {
    if (!this.storageClient) {
      const bucketName = process.env.NEXUS_BUCKET_NAME || 'nexus-ai-artifacts';
      this.storageClient = new CloudStorageClient(bucketName);
    }
    return this.storageClient;
  }

  /**
   * Generate images from a text prompt
   *
   * Uses withRetry internally for resilience against transient failures.
   *
   * @param prompt - Text description of the image to generate
   * @param options - Generation options including count, dimensions
   * @returns ImageResult with array of image URLs and metadata
   */
  async generate(prompt: string, options: ImageOptions = {}): Promise<ImageResult> {
    // Validate input
    if (!prompt || prompt.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_IMAGE_INVALID_INPUT',
        'Image generation prompt cannot be empty',
        'image',
        { promptLength: prompt?.length ?? 0 }
      );
    }

    const apiKey = await getSecret('nexus-gemini-api-key');
    if (!apiKey) {
      throw NexusError.critical(
        'NEXUS_IMAGE_NOT_CONFIGURED',
        'Gemini API key not found. Set nexus-gemini-api-key in Secret Manager.',
        'image',
        { model: this.model }
      );
    }

    const count = options.count ?? DEFAULT_COUNT;
    const width = options.width ?? DEFAULT_WIDTH;
    const height = options.height ?? DEFAULT_HEIGHT;
    const style = options.style || 'modern, professional, tech-focused';

    const retryResult = await withRetry(
      async () => {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: this.model,
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'] as any,
            },
          } as any);

          const imageUrls: string[] = [];
          const storage = this.getStorageClient();
          const timestamp = Date.now();

          // Generate multiple variants
          for (let i = 0; i < count; i++) {
            const variantPrompt = `Create a YouTube thumbnail image (${width}x${height} pixels, 16:9 aspect ratio).
Style: ${style}
Variant ${i + 1} of ${count} - make each variant visually distinct.

Subject: ${prompt}

Requirements:
- Bold, eye-catching design
- High contrast colors
- Clear focal point
- Professional quality
- No text overlays (text will be added separately)`;

            const result = await model.generateContent(variantPrompt);
            const response = result.response;

            // Extract image from response
            const parts = response.candidates?.[0]?.content?.parts || [];
            let imageData: string | null = null;
            let mimeType = 'image/png';

            for (const part of parts) {
              if ((part as any).inlineData) {
                imageData = (part as any).inlineData.data;
                mimeType = (part as any).inlineData.mimeType || 'image/png';
                break;
              }
            }

            if (!imageData) {
              throw NexusError.retryable(
                'NEXUS_IMAGE_GENERATION_FAILED',
                `Failed to generate image variant ${i + 1}: No image data in response`,
                'image',
                { variant: i + 1, count }
              );
            }

            // Upload to GCS
            const buffer = Buffer.from(imageData, 'base64');
            const extension = mimeType.includes('jpeg') ? 'jpg' : 'png';
            const path = `thumbnails/${timestamp}/variant-${i + 1}.${extension}`;

            const stream = Readable.from(buffer);
            const gcsUrl = await storage.uploadStream(path, stream, mimeType);
            imageUrls.push(gcsUrl);
          }

          const result: ImageResult = {
            imageUrls,
            cost: count * COST_PER_IMAGE,
            model: this.model,
            quality: 'primary',
            generatedAt: new Date().toISOString(),
          };

          return result;
        } catch (error) {
          if (error instanceof NexusError) {
            throw error;
          }
          throw NexusError.fromError(error, 'image');
        }
      },
      {
        maxRetries: 3,
        stage: 'image',
        baseDelay: 1000,
        maxDelay: 30000,
      }
    );

    return retryResult.result;
  }

  /**
   * Estimate cost before generation
   *
   * @param prompt - Text description (not used in cost calculation)
   * @param options - Generation options (count affects total cost)
   * @returns Estimated cost in USD
   */
  estimateCost(_prompt: string, options?: ImageOptions): number {
    const count = options?.count ?? DEFAULT_COUNT;
    return Number((count * COST_PER_IMAGE).toFixed(2));
  }
}
