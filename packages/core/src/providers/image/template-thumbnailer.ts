/**
 * Template Thumbnailer implementation
 * Fallback image provider using pre-designed templates
 *
 * @module @nexus-ai/core/providers/image/template-thumbnailer
 */

import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ImageProvider, ImageOptions, ImageResult } from '../../types/providers.js';
import { NexusError } from '../../errors/index.js';
import { logger } from '../../observability/logger.js';
import { CloudStorageClient, getThumbnailPath } from '../../storage/index.js';

// =============================================================================
// Constants
// =============================================================================

/** Provider name for tracking */
const PROVIDER_NAME = 'template-thumbnailer';

/** NFR22: Number of variants to produce */
const VARIANT_COUNT = 3;

/** Available template styles */
const TEMPLATE_STYLES = ['variant-1-bold', 'variant-2-visual', 'variant-3-mixed'] as const;

/** Template dimensions */
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

/** Text rendering configuration */
const TEXT_CONFIG = {
  fontSize: 64,
  fontFamily: 'Roboto-Bold',
  color: '#FFFFFF',
  maxWidth: 1100, // Safe area for text
  lineHeight: 80,
  y: 300, // Vertical position to start text
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Wrap text to fit within a maximum width
 *
 * Splits text into lines that fit within the specified character limit.
 * Attempts to break at word boundaries when possible.
 *
 * @param text - Text to wrap
 * @param maxCharsPerLine - Maximum characters per line (approximate)
 * @returns Array of text lines
 */
function wrapText(text: string, maxCharsPerLine: number = 30): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Create SVG text overlay for thumbnail
 *
 * @param lines - Text lines to render
 * @param fontSize - Font size in pixels
 * @param lineHeight - Line height in pixels
 * @param startY - Starting Y position
 * @returns SVG text element as string
 */
function createTextSVG(
  lines: string[],
  fontSize: number,
  lineHeight: number,
  startY: number
): string {
      const textElements = lines
        .map((line, index) => {
          const y = startY + (index * lineHeight);
          // Escape XML special characters
          const escapedLine = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

          return `<text
        x="50%"
        y="${y}"
        font-family="${TEXT_CONFIG.fontFamily}, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        stroke="black"
        stroke-width="2"
        paint-order="stroke fill"
      >${escapedLine}</text>`;
        })
        .join('\n');

  return `
    <svg width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}">
      ${textElements}
    </svg>
  `;
}

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

    const storage = new CloudStorageClient();
    const pipelineId = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const imageUrls: string[] = [];

    logger.info({
      provider: this.name,
      prompt,
      variantCount: VARIANT_COUNT,
    }, 'Generating template thumbnails');

    try {
      // Wrap text to fit within safe area
      const lines = wrapText(prompt, 30);

      // Generate each variant
      for (let i = 0; i < VARIANT_COUNT; i++) {
        const templateName = TEMPLATE_STYLES[i];
        const variantNum = i + 1;

        // Load template image
        const templatePath = join(process.cwd(), 'data', 'templates', 'thumbnails', `${templateName}.png`);

        logger.debug({ templatePath, variant: variantNum }, 'Loading template');

        const templateBuffer = await readFile(templatePath);

        // Create text overlay SVG
        const textSVG = createTextSVG(
          lines,
          TEXT_CONFIG.fontSize,
          TEXT_CONFIG.lineHeight,
          TEXT_CONFIG.y
        );

        // Composite text over template
        const outputBuffer = await sharp(templateBuffer)
          .composite([
            {
              input: Buffer.from(textSVG),
              top: 0,
              left: 0,
            },
          ])
          .png()
          .toBuffer();

        // Upload to Cloud Storage
        const targetPath = getThumbnailPath(pipelineId, variantNum);
        const gsUrl = await storage.uploadFile(targetPath, outputBuffer, 'image/png');

        logger.debug({
          variant: variantNum,
          gsUrl,
          textLines: lines.length,
        }, 'Generated template thumbnail');

        imageUrls.push(gsUrl);
      }

      logger.info({
        provider: this.name,
        variantCount: imageUrls.length,
      }, 'Template thumbnails generated successfully');

      return {
        imageUrls,
        cost: 0, // Templates are free (no API calls)
        model: PROVIDER_NAME,
        quality: 'fallback',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({
        provider: this.name,
        error,
      }, 'Template thumbnail generation failed');
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
