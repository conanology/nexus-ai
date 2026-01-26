import { StageInput, StageOutput } from '@nexus-ai/core';

/**
 * Topic data structure for metadata generation
 * Matches NewsItem from @nexus-ai/news-sourcing
 */
export interface TopicData {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  viralityScore: number;
  metadata?: Record<string, unknown>;
}

export interface ThumbnailInput {
  topic: string;
  visualConcept: string;
  // Pass-through fields from previous stages for YouTube
  videoPath?: string;           // GCS path to rendered video from visual-gen
  topicData?: TopicData;        // Full topic data for metadata generation
  script?: string;              // Script for metadata generation
  audioDurationSec?: number;    // Audio duration for chapter markers
}

export interface ThumbnailVariant {
  type: 'bold' | 'visual' | 'mixed';
  url: string;
  prompt: string;
}

export interface ThumbnailOutput {
  variants: ThumbnailVariant[];
  selectedVariant?: ThumbnailVariant; // Optional, if one is picked later
  // Pass-through fields for YouTube stage
  videoPath?: string;           // GCS path to rendered video
  topicData?: TopicData;        // Full topic data for metadata generation
  script?: string;              // Script for metadata generation
  audioDurationSec?: number;    // Audio duration for chapter markers
  privacyStatus?: 'private' | 'unlisted' | 'public';  // Default to private
  thumbnailUrl?: string;        // URL of first thumbnail variant for YouTube
}

export type ThumbnailStageInput = StageInput<ThumbnailInput>;
export type ThumbnailStageOutput = StageOutput<ThumbnailOutput>;
