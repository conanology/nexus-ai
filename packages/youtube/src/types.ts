/**
 * YouTube-specific type definitions for NEXUS-AI
 * @module @nexus-ai/youtube/types
 */

import type { StageInput, StageOutput } from '@nexus-ai/core';
import type { NewsItem } from '@nexus-ai/news-sourcing';

/**
 * Video metadata for YouTube upload
 */
export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  madeForKids?: boolean;
  containsSyntheticMedia?: boolean;
}

/**
 * Options for metadata generation
 */
export interface MetadataGenerationOptions {
  topic: NewsItem;
  script: string;
  sourceUrls: string[];
  audioDuration?: number;
  pipelineId: string;
}

/**
 * Chapter marker for YouTube video
 */
export interface ChapterMarker {
  timestamp: string;  // Format: "0:00"
  title: string;
}

/**
 * Affiliate link definition
 */
export interface AffiliateLink {
  name: string;
  url: string;
  category: string;
  fullUrl?: string; // With UTM params
}

/**
 * Configuration for affiliate links
 */
export interface AffiliateConfig {
  links: AffiliateLink[];
  utmParams: Record<string, string>;
  disclosureText: string;
}

/**
 * Privacy status for YouTube videos
 */
export type PrivacyStatus = 'private' | 'unlisted' | 'public';

/**
 * Input for YouTube upload stage
 */
export interface YouTubeUploadInput {
  pipelineId: string;
  videoPath: string;         // GCS path to rendered video
  metadata: VideoMetadata;   // Title, description, tags (Story 4.2)
  privacyStatus: PrivacyStatus;
  thumbnailUrl?: string;     // Optional GCS path to thumbnail (Story 4.3)
  thumbnailVariant?: number; // Optional variant ID (1, 2, or 3) for A/B testing
}

/**
 * Processing status of an uploaded video
 */
export type ProcessingStatus = 'processing' | 'processed' | 'failed';

/**
 * Output from YouTube upload stage
 */
export interface YouTubeUploadOutput {
  videoId: string;           // YouTube video ID
  uploadUrl: string;         // Full YouTube URL
  publishedAt?: string;      // ISO timestamp if public
  processingStatus: ProcessingStatus;
  quotaUsed: number;         // Units consumed
  thumbnailSet?: boolean;    // Whether thumbnail was successfully set (Story 4.3)
  thumbnailVariant?: number; // Which thumbnail variant was used (1, 2, or 3)
}

/**
 * Status of an upload session
 */
export type UploadSessionStatus = 'active' | 'completed' | 'failed';

/**
 * Persisted upload session for resumable uploads
 */
export interface UploadSession {
  sessionUri: string;        // Resumable upload URI
  pipelineId: string;
  videoPath: string;
  fileSize: number;
  bytesUploaded: number;
  status: UploadSessionStatus;
  createdAt: string;
  lastUpdatedAt: string;
}

/**
 * Breakdown of quota usage by operation type
 */
export interface QuotaBreakdown {
  videoInserts: number;    // 100 units each
  thumbnailSets: number;   // 50 units each
  videoUpdates: number;    // 50 units each
  other: number;
}

/**
 * Daily quota usage tracking
 */
export interface QuotaUsage {
  date: string;              // YYYY-MM-DD
  totalUsed: number;
  breakdown: QuotaBreakdown;
  alertSent: boolean;
}

/**
 * Quota cost constants per YouTube API operation
 * Per official Google documentation (verified 2026-01-18)
 */
export const QUOTA_COSTS = {
  VIDEO_INSERT: 100,        // videos.insert
  THUMBNAIL_SET: 50,        // thumbnails.set
  VIDEO_UPDATE: 50,         // videos.update
  VIDEO_LIST: 1,            // videos.list
  DAILY_QUOTA: 10000,       // Default daily quota
  ALERT_THRESHOLD: 8000,    // 80% of daily quota
} as const;

/**
 * OAuth 2.0 credentials stored in Secret Manager
 */
export interface YouTubeOAuthCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  access_token: string;
  token_type: 'Bearer';
  expiry_date: number;
}

/**
 * Progress callback for upload operations
 */
export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

export type ProgressCallback = (progress: UploadProgress) => void;

/**
 * Stage input/output type aliases
 */
export type YouTubeStageInput = StageInput<YouTubeUploadInput>;
export type YouTubeStageOutput = StageOutput<YouTubeUploadOutput>;
