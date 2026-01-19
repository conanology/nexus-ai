/**
 * Twitter stage execution for NEXUS-AI pipeline
 */

import { withRetry, logger, FirestoreClient, NexusError } from '@nexus-ai/core';
import { createTwitterClient } from './client.js';
import type { TwitterStageInput, TwitterStageOutput } from './types.js';

/**
 * Execute Twitter posting stage
 * Posts video link to Twitter/X when video is published
 * 
 * @param input - Stage input with videoUrl and title
 * @returns Stage output with tweet URL and quality metrics
 */
export async function executeTwitter(
  input: TwitterStageInput
): Promise<TwitterStageOutput> {
  const startTime = Date.now();
  const { pipelineId, data } = input;
  const { videoUrl, title } = data;

  // Validate pipelineId format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pipelineId)) {
    throw NexusError.critical(
      'NEXUS_INVALID_PIPELINE_ID',
      `Invalid pipelineId format: ${pipelineId}. Expected YYYY-MM-DD`,
      'twitter'
    );
  }

  logger.info({ pipelineId, stage: 'twitter' }, 'Twitter stage started');

  try {
    // Post tweet with retry wrapper
    const result = await postTweet(videoUrl, title);

    // Store tweet data to Firestore
    try {
      const firestore = new FirestoreClient();
      await firestore.updateDocument(`pipelines/${pipelineId}`, 'twitter', {
        tweetUrl: result.tweetUrl,
        postedAt: new Date().toISOString(),
        videoUrl,
      });
    } catch (firestoreError) {
      // Log Firestore failure but don't fail the stage
      // Tweet was successfully posted, which is the primary goal
      logger.warn({
        pipelineId,
        stage: 'twitter',
        error: firestoreError,
      }, 'Failed to store tweet data to Firestore');
    }

    logger.info({
      pipelineId,
      stage: 'twitter',
      durationMs: Date.now() - startTime,
      tweetUrl: result.tweetUrl,
    }, 'Twitter stage complete');

    return {
      success: true,
      data: {
        tweetUrl: result.tweetUrl,
        posted: true,
      },
      quality: {
        stage: 'twitter',
        timestamp: new Date().toISOString(),
        measurements: {
          twitterPosted: true,
          tweetUrl: result.tweetUrl,
        },
      },
      cost: {
        stage: 'twitter',
        totalCost: 0, // Twitter API is free (within rate limits)
        breakdown: [],
        timestamp: new Date().toISOString(),
      },
      durationMs: Date.now() - startTime,
      provider: {
        name: 'twitter-api-v2',
        tier: 'primary',
        attempts: 1,
      },
    };
  } catch (error) {
    // Twitter is RECOVERABLE - log warning but don't throw
    logger.warn({
      pipelineId,
      stage: 'twitter',
      error,
    }, 'Twitter stage failed - continuing pipeline');

    return {
      success: false,
      data: {
        posted: false,
      },
      quality: {
        stage: 'twitter',
        timestamp: new Date().toISOString(),
        measurements: {
          twitterPosted: false,
        },
      },
      cost: {
        stage: 'twitter',
        totalCost: 0,
        breakdown: [],
        timestamp: new Date().toISOString(),
      },
      durationMs: Date.now() - startTime,
      provider: {
        name: 'twitter-api-v2',
        tier: 'primary',
        attempts: 1,
      },
      warnings: [(error as Error).message],
    };
  }
}

/**
 * Post a tweet with video link
 * 
 * @param videoUrl - YouTube video URL
 * @param title - Video title (will be truncated if needed)
 * @returns Tweet result with URL
 */
export async function postTweet(
  videoUrl: string,
  title: string
): Promise<{ tweetId: string; tweetUrl: string }> {
  // Format tweet text
  const tweetText = formatTweetText(title, videoUrl);

  logger.debug({ tweetText }, 'Posting tweet');

  // Post tweet with retry wrapper for transient failures
  const retryResult = await withRetry(
    async () => {
      const client = await createTwitterClient();
      
      // Post tweet using Twitter API v2
      try {
        const response = await client.v2.tweet(tweetText);
        
        if (!response.data || !response.data.id) {
          throw NexusError.retryable(
            'NEXUS_TWITTER_INVALID_RESPONSE',
            'Twitter API returned invalid response',
            'twitter'
          );
        }
        
        return response;
      } catch (error: any) {
        // Handle rate limiting with exponential backoff
        if (error.code === 429 || error.rateLimit) {
          const resetTime = error.rateLimit?.reset || Date.now() / 1000 + 900; // 15 min default
          const waitMs = Math.max(0, resetTime * 1000 - Date.now());
          
          logger.warn({
            stage: 'twitter',
            waitMs,
            resetTime: new Date(resetTime * 1000).toISOString(),
          }, 'Twitter rate limit hit, will retry after reset');
          
          throw NexusError.retryable(
            'NEXUS_TWITTER_RATE_LIMIT',
            `Rate limited. Reset at ${new Date(resetTime * 1000).toISOString()}`,
            'twitter',
            { waitMs, resetTime }
          );
        }
        
        throw error;
      }
    },
    { maxRetries: 3, stage: 'twitter' }
  );

  const tweetId = retryResult.result.data.id;
  // Use correct Twitter URL format (works for both twitter.com and x.com)
  const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;

  logger.info({ tweetId, tweetUrl }, 'Tweet posted successfully');

  return { tweetId, tweetUrl };
}

/**
 * Format tweet text from video details
 * Ensures <= 280 characters by truncating title if needed
 * 
 * @param title - Video title
 * @param videoUrl - YouTube URL
 * @returns Formatted tweet text
 */
export function formatTweetText(title: string, videoUrl: string): string {
  // Tweet format: "{title} 🎬\n\nWatch now: {videoUrl}\n\n#AI #MachineLearning"
  const EMOJI = '🎬';
  const TITLE_EMOJI_SEPARATOR = ' ';
  const MIDDLE = '\n\nWatch now: ';
  const SUFFIX = '\n\n#AI #MachineLearning';
  const MAX_LENGTH = 280;

  // Calculate fixed parts length
  // Note: emoji counts as 2 characters
  const fixedPartsLength = 
    TITLE_EMOJI_SEPARATOR.length + 
    2 + // 🎬 emoji is 2 chars
    MIDDLE.length + 
    videoUrl.length + 
    SUFFIX.length;

  // Calculate available space for title
  const maxTitleLength = MAX_LENGTH - fixedPartsLength;

  // Truncate title if needed
  let finalTitle = title;
  if (title.length > maxTitleLength) {
    // Reserve 3 chars for "..."
    finalTitle = title.substring(0, maxTitleLength - 3) + '...';
  }

  // Construct tweet
  return `${finalTitle}${TITLE_EMOJI_SEPARATOR}${EMOJI}${MIDDLE}${videoUrl}${SUFFIX}`;
}
