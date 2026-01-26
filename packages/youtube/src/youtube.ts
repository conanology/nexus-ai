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
  createLogger,
} from '@nexus-ai/core';
import type {
  YouTubeUploadInput,
  YouTubeUploadOutput,
  VideoMetadata,
} from './types.js';
import { QUOTA_COSTS } from './types.js';
import { ResumableUploader } from './uploader.js';
import { getQuotaTracker, canUploadVideo, recordVideoUpload } from './quota.js';
import { setThumbnail } from './thumbnail.js';
import { scheduleVideo } from './scheduler.js';
import { generateMetadata } from './metadata.js';
import { FirestoreClient } from '@nexus-ai/core';

const logger = createLogger('youtube.stage');

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
    // Use input.pipelineId (from orchestrator) as authoritative source
    const pipelineId = input.pipelineId;
    const { videoPath, privacyStatus, thumbnailUrl, topicData, script, audioDurationSec } = data || {};

    // Validate required fields (videoPath and privacyStatus are always required)
    const missingFields: string[] = [];
    if (!videoPath) missingFields.push('videoPath');
    if (!privacyStatus) missingFields.push('privacyStatus');

    if (missingFields.length > 0) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_MISSING_INPUT',
        `YouTube stage missing required fields: ${missingFields.join(', ')}. ` +
          `This typically means the render stage did not complete or data flow is misconfigured.`,
        'youtube',
        { missingFields, receivedFields: Object.keys(data || {}) }
      );
    }

    // Generate metadata if not provided but topic and script are available
    let metadata: VideoMetadata | undefined = data?.metadata;

    if (!metadata) {
      if (topicData && script) {
        logger.info({
          pipelineId,
          stage: 'youtube',
          msg: 'Generating metadata from topic and script',
        });

        metadata = await generateMetadata({
          topic: topicData,
          script,
          sourceUrls: topicData.url ? [topicData.url] : [],
          audioDuration: audioDurationSec,
          pipelineId,
        });

        logger.info({
          pipelineId,
          stage: 'youtube',
          msg: 'Metadata generated successfully',
          title: metadata.title,
          tagCount: metadata.tags.length,
        });
      } else {
        throw NexusError.critical(
          'NEXUS_YOUTUBE_MISSING_METADATA',
          `YouTube stage missing metadata and cannot generate it. ` +
            `Either provide metadata directly or include topicData and script for generation.`,
          'youtube',
          { hasMetadata: !!data?.metadata, hasTopicData: !!topicData, hasScript: !!script }
        );
      }
    }

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

    const retryResult = await withRetry(
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
      }
    );

    // Extract the actual upload result from the retry wrapper
    const uploadResult = retryResult.result;

    // Record quota usage after successful upload
    await recordVideoUpload();

    // Set thumbnail if provided (Story 4.3)
    let thumbnailSet = false;
    let thumbnailVariant: number | undefined;

    if (thumbnailUrl) {
      // Select thumbnail variant (default to 1, supports future A/B testing)
      // If variant is provided in input, use it; otherwise default to 1
      thumbnailVariant = data.thumbnailVariant ?? 1;

      // Attempt to set thumbnail (warn-on-fail, does not throw)
      thumbnailSet = await setThumbnail(uploadResult.videoId, thumbnailUrl);

      // Store thumbnail details in Firestore
      const firestore = new FirestoreClient();
      const collection = `pipelines/${pipelineId}`;
      const docId = 'youtube';
      await firestore.updateDocument(collection, docId, {
        thumbnail: {
          thumbnailVariant,
          thumbnailUrl,
          thumbnailSet,
          videoId: uploadResult.videoId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Schedule video for publication (Story 4.4)
    // Only schedule if video was uploaded as private
    let scheduledFor: string | undefined;
    let videoUrl: string = uploadResult.uploadUrl;
    
    if (privacyStatus === 'private') {
      const scheduleResult = await scheduleVideo(uploadResult.videoId);
      scheduledFor = scheduleResult.scheduledFor;
      videoUrl = scheduleResult.videoUrl;

      // Store scheduling details in Firestore (with error handling)
      try {
        const firestoreSchedule = new FirestoreClient();
        const scheduleCollection = `pipelines/${pipelineId}`;
        const scheduleDocId = 'youtube';
        await firestoreSchedule.updateDocument(scheduleCollection, scheduleDocId, {
          scheduledFor: scheduledFor,
          videoId: uploadResult.videoId,
          videoUrl: videoUrl,
          timestamp: new Date().toISOString(),
        });
      } catch (firestoreError) {
        // Log warning but don't fail - video is already scheduled on YouTube
        // Firestore is for state tracking only
        logger.warn({
          pipelineId,
          videoId: uploadResult.videoId,
          error: firestoreError,
        }, 'Failed to persist scheduling details to Firestore');
      }
    }

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
      thumbnailSet: thumbnailUrl ? thumbnailSet : undefined,
      thumbnailVariant: thumbnailUrl ? thumbnailVariant : undefined,
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
