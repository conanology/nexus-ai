/**
 * Twitter package types for NEXUS-AI pipeline
 */

import type { StageInput, StageOutput } from '@nexus-ai/core';

/**
 * Input data for Twitter stage execution
 */
export interface TwitterInput {
  /** Published YouTube video URL */
  videoUrl: string;
  /** Video title (may be truncated to fit tweet) */
  title: string;
}

/**
 * Output data from Twitter stage execution
 */
export interface TwitterOutput {
  /** Full Twitter URL of posted tweet */
  tweetUrl?: string;
  /** Whether tweet was successfully posted */
  posted: boolean;
}

/**
 * Twitter API credentials from Secret Manager
 */
export interface TwitterCredentials {
  /** OAuth 2.0 App Key */
  appKey: string;
  /** OAuth 2.0 App Secret */
  appSecret: string;
  /** OAuth 2.0 Access Token */
  accessToken: string;
  /** OAuth 2.0 Access Secret */
  accessSecret: string;
}

/**
 * Result from posting a tweet
 */
export interface TweetResult {
  /** Tweet ID from Twitter API */
  tweetId: string;
  /** Full URL to the tweet */
  tweetUrl: string;
}

// Re-export stage types with Twitter-specific generics
export type TwitterStageInput = StageInput<TwitterInput>;
export type TwitterStageOutput = StageOutput<TwitterOutput>;
