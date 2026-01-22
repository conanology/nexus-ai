/**
 * YouTube scheduled publishing (Story 4.4)
 * @module @nexus-ai/youtube/scheduler
 */

import { createLogger, withRetry, type Logger } from '@nexus-ai/core';
import { getYouTubeClient } from './client.js';
import { getQuotaTracker } from './quota.js';

const logger: Logger = createLogger('youtube.scheduler');

/**
 * Scheduling result with video details
 */
export interface ScheduleResult {
  videoId: string;
  scheduledFor: string;
  videoUrl: string;
}

/**
 * Calculate the publish time for a video
 * 
 * Defaults to 2:00 PM UTC on the current date.
 * If current time is >= 1:00 PM UTC (less than 1 hour before slot),
 * schedules for tomorrow at 2:00 PM UTC.
 * 
 * @param now - Current time (defaults to new Date())
 * @returns Date object set to the calculated publish time
 */
export function calculatePublishTime(now: Date = new Date()): Date {
  const currentHour = now.getUTCHours();
  
  // Create a new date for the publish time
  const publishTime = new Date(now);
  
  // Set to 2:00 PM UTC (14:00)
  publishTime.setUTCHours(14, 0, 0, 0);
  
  // If current time is >= 1:00 PM UTC (13:00), schedule for tomorrow
  // This ensures at least 1 hour before the scheduled time
  if (currentHour >= 13) {
    publishTime.setUTCDate(publishTime.getUTCDate() + 1);
  }
  
  return publishTime;
}

/**
 * Schedule a video for publication at a specific time
 * 
 * Sets the video to private and schedules it for publication.
 * Tracks quota usage (50 units per update).
 * 
 * @param videoId - YouTube video ID
 * @param publishTime - When to publish (defaults to calculatePublishTime())
 * @returns Scheduling result with video details
 */
export async function scheduleVideo(
  videoId: string,
  publishTime?: Date
): Promise<ScheduleResult> {
  const scheduledTime = publishTime ?? calculatePublishTime();
  
  logger.info({
    videoId,
    scheduledTime: scheduledTime.toISOString(),
  }, 'Scheduling video for publication');
  
  try {
    // Get YouTube client
    const client = await getYouTubeClient();
    const youtube = client.getYouTubeApi();
    
    //Call YouTube API with retry wrapper
    const retryResult = await withRetry(
      async () => {
        return youtube.videos.update({
          part: ['status'],
          requestBody: {
            id: videoId,
            status: {
              privacyStatus: 'private',
              publishAt: scheduledTime.toISOString(),
            },
          },
        });
      },
      {
        maxRetries: 3,
        stage: 'youtube',
      }
    );
    
    // Extract actual response from retry result
    const response = retryResult.result;
    
    // Verify the scheduled time is reflected in the API response (AC#1)
    const responsePublishAt = response.data.status?.publishAt;
    if (!responsePublishAt || responsePublishAt !== scheduledTime.toISOString()) {
      throw new Error(
        `Scheduled time verification failed. Expected: ${scheduledTime.toISOString()}, Got: ${responsePublishAt || 'undefined'}`
      );
    }
    
    // Record quota usage (50 units for video update)
    // NOTE: This only tracks successful requests. If withRetry made multiple attempts,
    // only the final success is tracked. This is acceptable as quota exhaustion protection
    // happens at the upload stage level (canUploadVideo check).
    const quotaTracker = getQuotaTracker();
    await quotaTracker.recordUsage('video_update', 50);
    
    logger.info({
      videoId,
      scheduledTime: scheduledTime.toISOString(),
      responseData: response.data,
    }, 'Video scheduled successfully');
    
    // Return scheduling details
    return {
      videoId,
      scheduledFor: scheduledTime.toISOString(),
      videoUrl: `https://youtu.be/${videoId}`,
    };
  } catch (error) {
    logger.error({
      videoId,
      scheduledTime: scheduledTime.toISOString(),
      error,
    }, 'Failed to schedule video');
    throw error;
  }
}
