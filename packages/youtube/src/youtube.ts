/**
 * YouTube upload stage implementation
 * @module @nexus-ai/youtube/youtube
 */

import {
  type StageInput,
  type StageOutput,
  type StageConfig,
  type ArtifactRef,
  executeStage,
  withRetry,
  NexusError,
  CostTracker,
  qualityGate,
} from '@nexus-ai/core';
import type {
  YouTubeUploadInput,
  YouTubeUploadOutput,
} from './types.js';
import { QUOTA_COSTS } from './types.js';
import { ResumableUploader } from './uploader.js';
import { getQuotaTracker, canUploadVideo, recordVideoUpload } from './quota.js';

/**
 * Execute YouTube upload stage
 *
 * Uploads a video to YouTube using the resumable upload protocol.
 * Tracks quota usage and integrates with the NEXUS pipeline framework.
 *
 * @param input - Stage input containing video path and metadata
 * @returns Stage output with upload result and metrics
 *
 * @example
 * ```typescript
 * const result = await executeYouTubeUpload({
 *   pipelineId: '2026-01-18',
 *   previousStage: 'render',
 *   data: {
 *     pipelineId: '2026-01-18',
 *     videoPath: 'gs://nexus-ai-artifacts/2026-01-18/render/video.mp4',
 *     metadata: {
 *       title: 'AI News Today',
 *       description: 'Daily AI news roundup',
 *       tags: ['AI', 'news'],
 *       categoryId: '28', // Science & Technology
 *     },
 *     privacyStatus: 'private',
 *   },
 *   config: { retries: 3, timeout: 600000 },
 * });
 * ```
 */
export async function executeYouTubeUpload(
  input: StageInput<YouTubeUploadInput>
): Promise<StageOutput<YouTubeUploadOutput>> {
  return executeStage(input, 'youtube', async (data: YouTubeUploadInput, config: StageConfig) => {
    const { pipelineId, videoPath, metadata, privacyStatus } = data;

    // Initialize cost tracker
    const tracker = new CostTracker(pipelineId, 'youtube');

    // Check quota before attempting upload
    const canProceed = await canUploadVideo();

    if (!canProceed) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_QUOTA_EXCEEDED',
        `YouTube API quota exceeded. Daily limit: ${QUOTA_COSTS.DAILY_QUOTA} units. ` +
          `Try again tomorrow or request a quota increase from Google.`,
        'youtube',
        { dailyLimit: QUOTA_COSTS.DAILY_QUOTA }
      );
    }

    // Create uploader and perform upload with retry
    const uploader = new ResumableUploader();

    const uploadResult = await withRetry(
      async () => {
        return uploader.upload({
          pipelineId,
          videoPath,
          metadata,
          privacyStatus,
          onProgress: (progress) => {
            // Log progress at 10% intervals
            if (progress.percentage % 10 === 0) {
              // Progress logged inside uploader
            }
          },
        });
      },
      {
        maxRetries: config.retries || 3,
        stage: 'youtube',
        operation: 'upload',
      }
    );

    // Record quota usage after successful upload
    await recordVideoUpload();

    // Track API costs (YouTube API is free but quota-limited)
    tracker.recordApiCall(
      'youtube-data-api',
      { input: 0, output: 0 },
      0 // YouTube API is free (no monetary cost, only quota)
    );

    // Create artifact reference for the uploaded video
    const artifact: ArtifactRef = {
      type: 'video',
      url: uploadResult.uploadUrl,
      size: uploadResult.bytesUploaded,
      contentType: 'video/mp4',
      generatedAt: new Date().toISOString(),
      stage: 'youtube',
    };

    // Prepare output data
    const outputData: YouTubeUploadOutput = {
      videoId: uploadResult.videoId,
      uploadUrl: uploadResult.uploadUrl,
      processingStatus: uploadResult.processingStatus,
      quotaUsed: QUOTA_COSTS.VIDEO_INSERT,
    };

    // Run quality gate check
    const gateResult = await qualityGate.check('youtube', outputData);

    if (gateResult.status === 'FAIL') {
      throw NexusError.degraded(
        'NEXUS_QUALITY_GATE_FAIL',
        gateResult.reason || 'YouTube upload failed quality gate check',
        'youtube',
        { metrics: gateResult.metrics }
      );
    }

    // Build final stage output
    const output: YouTubeUploadOutput & {
      artifacts: ArtifactRef[];
      provider: { name: string; tier: 'primary' | 'fallback'; attempts: number };
      quality: any;
    } = {
      ...outputData,
      artifacts: [artifact],
      provider: {
        name: 'youtube-data-api',
        tier: 'primary', // YouTube is the only upload destination (no fallbacks)
        attempts: 1, // Note: withRetry may have retried, but this is initial attempt count
      },
      quality: {
        metrics: gateResult.metrics,
        warnings: gateResult.warnings,
      },
    };

    return output;
  });
}

/**
 * Check if a video upload can be performed without exceeding quota
 *
 * @returns Promise<boolean> - true if upload is allowed
 */
export async function checkYouTubeQuota(): Promise<boolean> {
  return canUploadVideo();
}

/**
 * Get remaining YouTube API quota for today
 *
 * @returns Promise<number> - remaining quota units
 */
export async function getRemainingYouTubeQuota(): Promise<number> {
  const tracker = getQuotaTracker();
  return tracker.getRemainingQuota();
}
