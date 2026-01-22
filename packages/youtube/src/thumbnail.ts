/**
 * Thumbnail upload functionality for YouTube videos
 * @module @nexus-ai/youtube/thumbnail
 */

import { Readable } from 'stream';
import { imageSize } from 'image-size';
import { CloudStorageClient, createLogger, NexusError, withRetry } from '@nexus-ai/core';
import { getYouTubeClient } from './client.js';
import { recordThumbnailSet } from './quota.js';
import { QUOTA_COSTS } from './types.js';

const logger = createLogger('youtube.thumbnail');

/**
 * Maximum file size for YouTube thumbnails (2MB)
 */
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024;

/**
 * Download thumbnail from Cloud Storage
 *
 * @param url - GCS URL (gs://bucket/path)
 * @returns Thumbnail buffer
 * @throws NexusError if URL is invalid or download fails
 */
export async function downloadThumbnail(url: string): Promise<Buffer> {
  logger.info({ url }, 'Downloading thumbnail');

  // Validate URL format
  if (!url.startsWith('gs://')) {
    throw NexusError.retryable(
      'NEXUS_YOUTUBE_INVALID_THUMBNAIL_URL',
      `Thumbnail URL must be a gs:// URL. Got: ${url}`,
      'thumbnail',
      { url }
    );
  }

  try {
    // Parse gs://bucket/path format
    const urlWithoutProtocol = url.replace('gs://', '');
    const firstSlashIndex = urlWithoutProtocol.indexOf('/');

    if (firstSlashIndex === -1) {
      throw NexusError.retryable(
        'NEXUS_YOUTUBE_INVALID_THUMBNAIL_URL',
        `Invalid gs:// URL format: ${url}`,
        'thumbnail',
        { url }
      );
    }

    const path = urlWithoutProtocol.substring(firstSlashIndex + 1);

    // Download from Cloud Storage
    const client = new CloudStorageClient();
    const buffer = await client.downloadFile(path);

    logger.info({
      url,
      size: buffer.byteLength,
    }, 'Thumbnail downloaded successfully');

    return buffer;
  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }

    logger.error({ error, url }, 'Failed to download thumbnail');
    throw NexusError.fromError(error, 'thumbnail');
  }
}

/**
 * Validate thumbnail meets YouTube requirements
 *
 * Requirements:
 * - Format: PNG or JPG
 * - File size: < 2MB
 * - Dimensions: 1280x720 (strictly enforced)
 *
 * @param buffer - Thumbnail buffer
 * @throws NexusError if validation fails
 */
export function validateThumbnail(buffer: Buffer): void {
  logger.debug({ size: buffer.byteLength }, 'Validating thumbnail');

  // Check file size
  if (buffer.byteLength > MAX_THUMBNAIL_SIZE) {
    throw NexusError.degraded(
      'NEXUS_YOUTUBE_THUMBNAIL_TOO_LARGE',
      `Thumbnail size ${buffer.byteLength} bytes exceeds 2MB limit (${MAX_THUMBNAIL_SIZE} bytes)`,
      'thumbnail',
      { size: buffer.byteLength, limit: MAX_THUMBNAIL_SIZE }
    );
  }

  // Check format and dimensions using image-size
  try {
    const dimensions = imageSize(buffer);

    if (!dimensions || !dimensions.type) {
      throw new Error('Could not determine image type');
    }

    // Check format
    if (dimensions.type !== 'png' && dimensions.type !== 'jpg' && dimensions.type !== 'jpeg') {
      throw NexusError.degraded(
        'NEXUS_YOUTUBE_INVALID_THUMBNAIL_FORMAT',
        `Invalid thumbnail format: ${dimensions.type}. Must be PNG or JPEG.`,
        'thumbnail',
        { format: dimensions.type }
      );
    }

    // Check dimensions
    if (dimensions.width !== 1280 || dimensions.height !== 720) {
      throw NexusError.degraded(
        'NEXUS_YOUTUBE_INVALID_THUMBNAIL_DIMENSIONS',
        `Invalid thumbnail dimensions: ${dimensions.width}x${dimensions.height}. Must be exactly 1280x720.`,
        'thumbnail',
        { width: dimensions.width, height: dimensions.height }
      );
    }

    logger.debug({
      size: buffer.byteLength,
      format: dimensions.type,
      width: dimensions.width,
      height: dimensions.height,
    }, 'Thumbnail validation passed');
  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }

    // Handle image-size errors or custom errors
    throw NexusError.degraded(
      'NEXUS_YOUTUBE_THUMBNAIL_VALIDATION_FAILED',
      `Thumbnail validation failed: ${error instanceof Error ? error.message : String(error)}`,
      'thumbnail',
      { error }
    );
  }
}

/**
 * Detect MIME type from buffer signature
 *
 * @param buffer - Image buffer
 * @returns MIME type string
 */
function detectMimeType(buffer: Buffer): string {
  const isPNG =
    buffer.byteLength >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  return isPNG ? 'image/png' : 'image/jpeg';
}

/**
 * Upload thumbnail to YouTube using Thumbnails API
 *
 * @param videoId - YouTube video ID
 * @param buffer - Thumbnail buffer
 * @throws NexusError if upload fails
 */
export async function uploadThumbnailToYouTube(
  videoId: string,
  buffer: Buffer
): Promise<void> {
  logger.info({
    videoId,
    size: buffer.byteLength,
  }, 'Uploading thumbnail to YouTube');

  try {
    const client = await getYouTubeClient();
    const youtube = client.getYouTubeApi();

    // Detect MIME type
    const mimeType = detectMimeType(buffer);

    // Create readable stream from buffer
    const stream = Readable.from(buffer);

    // Upload thumbnail using YouTube API
    const response = await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType,
        body: stream,
      },
    });

    // Record quota usage
    await recordThumbnailSet();

    logger.info({
      videoId,
      quotaUsed: QUOTA_COSTS.THUMBNAIL_SET,
      mimeType,
    }, 'Thumbnail uploaded successfully');

    // Verify response
    if (!response.data || !response.data.items || response.data.items.length === 0) {
      throw NexusError.retryable(
        'NEXUS_YOUTUBE_THUMBNAIL_UPLOAD_FAILED',
        'Thumbnail upload response was empty',
        'thumbnail',
        { videoId }
      );
    }
  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }

    logger.error({
      error,
      videoId,
    }, 'Failed to upload thumbnail to YouTube');
    throw NexusError.fromError(error, 'thumbnail');
  }
}

/**
 * Set thumbnail for a YouTube video with retry and warn-on-fail logic
 *
 * This is the main entry point for thumbnail upload with:
 * - Download from Cloud Storage
 * - Validation
 * - Upload to YouTube with retry
 * - Warn-only failure mode (does not throw on failure)
 *
 * @param videoId - YouTube video ID
 * @param thumbnailUrl - Cloud Storage URL (gs://)
 * @returns true if successful, false if failed (with warning logged)
 */
export async function setThumbnail(
  videoId: string,
  thumbnailUrl: string
): Promise<boolean> {
  logger.info({ videoId, thumbnailUrl }, 'Setting thumbnail');

  try {
    // Download thumbnail
    const buffer = await downloadThumbnail(thumbnailUrl);

    // Validate thumbnail
    validateThumbnail(buffer);

    // Upload with retry
    await withRetry(
      () => uploadThumbnailToYouTube(videoId, buffer),
      {
        maxRetries: 3,
        stage: 'thumbnail',
      }
    );

    logger.info({ videoId, thumbnailUrl }, 'Thumbnail set successfully');
    return true;
  } catch (error) {
    // CRITICAL: Thumbnail failure is RECOVERABLE/DEGRADED
    // Log warning and return false instead of throwing
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      videoId,
      thumbnailUrl,
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Thumbnail upload failed, video will use auto-generated thumbnail');

    return false;
  }
}
