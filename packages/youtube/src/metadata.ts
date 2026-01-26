/**
 * YouTube metadata generation
 * @module @nexus-ai/youtube/metadata
 */

import type { NewsItem } from '@nexus-ai/news-sourcing';
import type { VideoMetadata, MetadataGenerationOptions, AffiliateLink, ChapterMarker, AffiliateConfig } from './types.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createLogger, FirestoreClient, NexusError } from '@nexus-ai/core';

const logger = createLogger('youtube.metadata');

/**
 * Load affiliate links from configuration file
 */
export async function loadAffiliateLinks(): Promise<AffiliateConfig> {
  try {
    const configPath = join(process.cwd(), 'data', 'config', 'affiliates.json');
    const content = await readFile(configPath, 'utf-8');
    const config: AffiliateConfig = JSON.parse(content);

    // Generate full URLs with UTM parameters
    config.links = config.links.map(link => ({
      ...link,
      fullUrl: buildAffiliateUrl(link.url, config.utmParams)
    }));

    return config;
  } catch (error) {
    throw NexusError.degraded(
      'NEXUS_YOUTUBE_AFFILIATE_LOAD_ERROR',
      'Failed to load affiliate configuration',
      'metadata',
      { error }
    );
  }
}

/**
 * Build affiliate URL with UTM parameters
 */
function buildAffiliateUrl(baseUrl: string, utmParams: Record<string, string>): string {
  const url = new URL(baseUrl);
  Object.entries(utmParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

/**
 * Generate engaging title from topic and script
 */
export function generateTitle(topic: NewsItem, _script: string): string {
  let title = topic.title;

  // Select pattern based on topic metadata
  if (topic.viralityScore > 100) {
    title = `BREAKING: ${topic.title}`;
  } else if (topic.source === 'arxiv' || topic.source === 'huggingface') {
    title = `${topic.title} Explained`;
  } else {
    title = `${topic.title} - Daily AI Briefing`;
  }

  // Sanitize: remove < and > characters
  title = title.replace(/[<>]/g, '');

  // Truncate to 100 characters max
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }

  return title;
}

/**
 * Generate structured description with all required sections
 */
export function generateDescription(
  topic: NewsItem,
  script: string,
  sourceUrls: string[],
  affiliates: AffiliateLink[]
): string {
  const sections: string[] = [];

  // 1. Hook/Summary (first 2-3 sentences from script)
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const hook = sentences.slice(0, 2).join('. ').trim() + '.';
  sections.push(hook);
  sections.push('');

  // 2. Today's Topics
  sections.push("Today's Topics:");
  sections.push(`• ${topic.title}`);
  sections.push('');

  // 3. Links Mentioned
  if (sourceUrls.length > 0) {
    sections.push('Links Mentioned:');
    sourceUrls.forEach(url => sections.push(`• ${url}`));
    sections.push('');
  }

  // 4. Affiliate Links (only if provided)
  if (affiliates.length > 0) {
    sections.push('Affiliate Links (support the channel):');
    affiliates.forEach(link => {
      sections.push(`• ${link.name}: ${link.fullUrl || link.url}`);
    });
    sections.push('');
    sections.push('Some links are affiliate links. I may earn a small commission at no extra cost to you.');
    sections.push('');
  }

  // 5. Hashtags
  sections.push('#AI #MachineLearning #TechNews #NEXUSAI');

  let description = sections.join('\n');

  // Validate byte length (max 5000 bytes UTF-8)
  while (Buffer.byteLength(description, 'utf8') > 5000) {
    // Trim hook if too long
    const lines = description.split('\n');
    if (lines[0].length > 100) {
      lines[0] = lines[0].substring(0, 97) + '...';
      description = lines.join('\n');
    } else {
      // Remove last URL if still too long
      const urlIndex = description.lastIndexOf('• http');
      if (urlIndex > 0) {
        description = description.substring(0, urlIndex).trim();
      } else {
        break;
      }
    }
  }

  return description;
}

/**
 * Generate tags array with character count validation
 */
export function generateTags(topic: NewsItem, _script: string): string[] {
  const tags: string[] = [];

  // Base tags (always include)
  tags.push('AI', 'MachineLearning', 'TechNews', 'NEXUSAI');

  // Source-specific tags
  const sourceTagMap: Record<string, string> = {
    'github': 'GitHub',
    'huggingface': 'HuggingFace',
    'hackernews': 'HackerNews',
    'reddit': 'Reddit',
    'arxiv': 'ArXiv'
  };

  if (sourceTagMap[topic.source]) {
    tags.push(sourceTagMap[topic.source]);
  }

  // Extract keywords from title (simple approach: significant words)
  const titleWords = topic.title
    .split(/\s+/)
    .filter((w: string) => w.length > 3 && !/^(the|and|for|with|from)$/i.test(w))
    .slice(0, 3);

  titleWords.forEach((word: string) => {
    // Remove special characters
    const cleaned = word.replace(/[^a-zA-Z0-9]/g, '');
    if (cleaned.length > 0 && !tags.includes(cleaned)) {
      tags.push(cleaned);
    }
  });

  // Validate total character count (max 500 chars including commas and quotes)
  let totalLength = 0;
  const validatedTags: string[] = [];

  for (const tag of tags) {
    const hasSpace = tag.includes(' ');
    const tagLength = tag.length + (hasSpace ? 2 : 0); // +2 for quotes if space
    const commaLength = validatedTags.length > 0 ? 1 : 0;

    if (totalLength + tagLength + commaLength <= 500) {
      validatedTags.push(tag);
      totalLength += tagLength + commaLength;
    } else {
      break; // Stop adding tags if we'd exceed limit
    }
  }

  return validatedTags;
}

/**
 * Extract chapter markers from script visual cues
 */
export function extractChapterMarkers(script: string, audioDuration: number): ChapterMarker[] {
  const markers: ChapterMarker[] = [];

  // Always start with 0:00 Introduction
  markers.push({ timestamp: '0:00', title: 'Introduction' });

  // Extract visual cues as section breaks
  const visualCueRegex = /\[VISUAL:\s*([^\]]+)\]/gi;
  const matches = Array.from(script.matchAll(visualCueRegex));

  if (matches.length === 0) {
    return markers; // Only introduction if no visual cues
  }

  // Calculate approximate word positions for each visual cue
  const totalWords = script.split(/\s+/).length;
  const wordsPerSecond = totalWords / audioDuration;

  matches.forEach((match, _index) => {
    const position = match.index || 0;
    const wordsBefore = script.substring(0, position).split(/\s+/).length;
    const secondsElapsed = Math.floor(wordsBefore / wordsPerSecond);

    // Format timestamp as M:SS or H:MM:SS
    const timestamp = formatTimestamp(secondsElapsed);

    // Clean up visual cue text to make chapter title
    let title = match[1].trim();
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    markers.push({ timestamp, title });
  });

  return markers;
}

/**
 * Format seconds as timestamp (M:SS or H:MM:SS)
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}

/**
 * Orchestrates metadata generation for a video
 */
export async function generateMetadata(
  options: MetadataGenerationOptions
): Promise<VideoMetadata> {
  const { topic, script, sourceUrls, pipelineId, audioDuration } = options;

  logger.info({
    pipelineId,
    stage: 'metadata',
    topicTitle: topic.title
  }, 'Generating metadata');

  try {
    // 1. Load configuration
    const affiliateConfig = await loadAffiliateLinks();

    // 2. Generate components
    const title = generateTitle(topic, script);
    let description = generateDescription(topic, script, sourceUrls, affiliateConfig.links);
    const tags = generateTags(topic, script);

    // 3. Add chapters to description if audio is long enough
    if (audioDuration && audioDuration > 60) {
      const chapters = extractChapterMarkers(script, audioDuration);

      if (chapters.length > 0) {
        const chapterText = chapters.map(c => `${c.timestamp} ${c.title}`).join('\n');

        // Insert before hashtags
        const tagStart = description.indexOf('#AI');
        if (tagStart > 0) {
          const before = description.substring(0, tagStart);
          const after = description.substring(tagStart);
          description = `${before}Timestamps:\n${chapterText}\n\n${after}`;
        } else {
          description += `\n\nTimestamps:\n${chapterText}`;
        }

        // Re-validate byte length after adding chapters and truncate if needed
        if (Buffer.byteLength(description, 'utf8') > 5000) {
          const lines = description.split('\n');

          // Find key sections
          const timestampsIndex = lines.findIndex(l => l === 'Timestamps:');
          const hashtagsIndex = lines.findIndex(l => l.startsWith('#AI'));

          // Strategy 1: Shorten the hook (first line) to make room
          const excess = Buffer.byteLength(description, 'utf8') - 4800; // Leave 200 byte buffer
          if (lines[0].length > excess + 50) {
            lines[0] = lines[0].substring(0, lines[0].length - excess - 3) + '...';
            description = lines.join('\n');
          }

          // Strategy 2: Reduce chapters if still too long
          if (Buffer.byteLength(description, 'utf8') > 5000 && timestampsIndex >= 0) {
            // Find chapter lines (between Timestamps: and hashtags or end)
            const endIndex = hashtagsIndex >= 0 ? hashtagsIndex : lines.length;
            const chapterStartIndex = timestampsIndex + 1;

            // Keep only first 5 chapters
            const chapterLines = lines.slice(chapterStartIndex, endIndex).filter(l => l.trim().length > 0);
            const keptChapters = chapterLines.slice(0, 5);

            // Rebuild description
            const beforeTimestamps = lines.slice(0, timestampsIndex + 1);
            const afterChapters = hashtagsIndex >= 0 ? lines.slice(hashtagsIndex) : [];

            description = [...beforeTimestamps, ...keptChapters, '', ...afterChapters].join('\n');
          }

          // Strategy 3: Final safety truncation if still over
          while (Buffer.byteLength(description, 'utf8') > 5000) {
            description = description.substring(0, description.length - 100) + '...';
          }

          logger.info({
            pipelineId,
            stage: 'metadata',
            originalExcess: excess,
            finalBytes: Buffer.byteLength(description, 'utf8')
          }, 'Description truncated after adding chapters');
        }
      }
    }

    // 4. Validate constraints
    if (title.length > 100) {
      throw NexusError.degraded(
        'NEXUS_YOUTUBE_TITLE_TOO_LONG',
        'Title exceeds 100 characters',
        'metadata',
        { length: title.length }
      );
    }

    if (title.includes('<') || title.includes('>')) {
      throw NexusError.degraded(
        'NEXUS_YOUTUBE_INVALID_CHARS',
        'Title contains invalid characters',
        'metadata',
        { title }
      );
    }

    // 5. Construct metadata object
    const metadata: VideoMetadata = {
      title,
      description,
      tags,
      categoryId: '28', // Science & Technology
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en',
      madeForKids: false,
      containsSyntheticMedia: true
    };

    // 6. Persist to Firestore
    const firestore = new FirestoreClient();
    const collection = `pipelines/${pipelineId}/youtube`;
    const docId = 'metadata';
    await firestore.setDocument(collection, docId, {
      ...metadata,
      generatedAt: new Date().toISOString(),
      version: '1.0'
    });

    logger.info({
      pipelineId,
      stage: 'metadata',
      path: `${collection}/${docId}`,
      titleLength: title.length,
      descriptionBytes: Buffer.byteLength(description, 'utf8'),
      tagCount: tags.length
    }, 'Metadata generated and stored');

    return metadata;

  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }

    logger.error({
      error,
      pipelineId,
      stage: 'metadata'
    }, 'Failed to generate metadata');

    throw NexusError.critical(
      'NEXUS_YOUTUBE_METADATA_GENERATION_FAILED',
      'Metadata generation failed',
      'metadata',
      { error, pipelineId }
    );
  }
}
