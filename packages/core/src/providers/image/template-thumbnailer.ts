/**
 * Template Thumbnailer implementation
 * Fallback image provider using pre-designed templates
 *
 * @module @nexus-ai/core/providers/image/template-thumbnailer
 */

import type { ImageProvider, ImageOptions, ImageResult } from '../../types/providers.js';
import { NexusError } from '../../errors/index.js';

// =============================================================================
// Constants
// =============================================================================

/** Provider name for tracking */
const PROVIDER_NAME = 'template-thumbnailer';

/** NFR22: Number of variants to produce */
const VARIANT_COUNT = 3;

/** Available template styles */
const TEMPLATE_STYLES = ['tech-blue', 'news-red', 'ai-gradient'] as const;

// =============================================================================
// TemplateThumbnailer
// =============================================================================

/**
 * Template Thumbnailer
 *
 * Fallback image provider that uses pre-designed template images
 * with text overlays instead of AI generation.
 *
 * Unlike other providers, this doesn't call external APIs - it uses
 * local template images from data/templates/thumbnails/.
 *
 * Features:
 * - Uses pre-designed template backgrounds
 * - Overlays topic title text programmatically
 * - Always produces 3 A/B variants
 * - Cost: $0 (no API calls)
 *
 * @example
 * ```typescript
 * const provider = new TemplateThumbnailer();
 * const result = await provider.generate('AI News Update', { count: 3 });
 * console.log(result.imageUrls); // Array of 3 template-based thumbnails
 * ```
 */
export class TemplateThumbnailer implements ImageProvider {
  /** Provider name for withFallback tracking */
  readonly name: string = PROVIDER_NAME;

  /**
   * Generate thumbnail images using templates
   *
   * This method uses pre-designed templates instead of AI generation.
   * It's intended as a fallback when Gemini Image generation fails.
   *
   * @param prompt - Topic title to overlay on template
   * @param options - Generation options (count is fixed at 3)
   * @returns ImageResult with array of template image URLs
   */
  async generate(prompt: string, _options: ImageOptions = {}): Promise<ImageResult> {
    // Validate input - even templates need a title to overlay
    if (!prompt || prompt.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_IMAGE_INVALID_INPUT',
        'Template title prompt cannot be empty',
        'image',
        { promptLength: prompt?.length ?? 0, provider: this.name }
      );
    }

    try {
      // TODO: Story 3.7/3.8 - Implement actual template rendering
      // For now, this returns placeholder paths that would be replaced with:
      //
      // 1. Load template images from data/templates/thumbnails/
      // 2. Use sharp or canvas to overlay title text
      // 3. Save rendered images to GCS
      // 4. Return GCS URLs

      // For placeholder, generate GCS-style paths
      const timestamp = new Date().toISOString().split('T')[0];
      const imageUrls = TEMPLATE_STYLES.slice(0, VARIANT_COUNT).map(
        (style, index) =>
          `gs://nexus-ai-artifacts/${timestamp}/thumbnails/template-${style}-${index + 1}.png`
      );

      return {
        imageUrls,
        cost: 0, // Templates are free (no API calls)
        model: PROVIDER_NAME,
        quality: 'fallback',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw NexusError.fromError(error, 'image');
    }
  }

  /**
   * Estimate cost before generation
   *
   * Templates are free - no API calls needed.
   *
   * @param prompt - Not used
   * @param options - Not used
   * @returns 0 (templates are free)
   */
  estimateCost(_prompt: string, _options?: ImageOptions): number {
    return 0;
  }
}
