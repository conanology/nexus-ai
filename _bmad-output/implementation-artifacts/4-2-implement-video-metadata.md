# Story 4.2: Implement Video Metadata

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to set video metadata automatically,
so that videos are properly titled and discoverable.

## Acceptance Criteria

1. **Given** the YouTube package from Story 4.1
   **When** I implement video metadata generation per FR25
   **Then** `generateMetadata(topic, script)` returns:
   - `title`: Engaging title from topic (max 100 chars, no `<` or `>`)
   - `description`: Structured description with sections (max 5000 bytes UTF-8)
   - `tags`: Relevant keywords (max 500 chars total, commas counted)
   - `categoryId`: "28" (Science & Technology)
   - `defaultLanguage`: "en"
   - `defaultAudioLanguage`: "en"
   - `madeForKids`: false
   - `containsSyntheticMedia`: true (AI-generated content disclosure)

2. **Given** description generation requirements
   **When** the description is generated
   **Then** it follows this template structure:
   ```
   {hook_summary}

   Today's Topics:
   {topic_list}

   Links Mentioned:
   {source_urls}

   Affiliate Links (support the channel):
   {affiliate_links}

   Timestamps:
   {chapter_markers}

   #AI #MachineLearning #TechNews #NEXUSAI
   ```
   **And** total byte length is validated to stay under 5000 bytes

3. **Given** affiliate links requirement
   **When** metadata is generated
   **Then** affiliate links are loaded from config file `data/config/affiliates.json`
   **And** each link includes UTM parameters for tracking
   **And** disclosure text is included ("Some links are affiliate links")

4. **Given** chapter markers requirement
   **When** timestamps are generated from script
   **Then** chapter markers are extracted from script sections (visual cues as section breaks)
   **And** format follows YouTube chapter format: `0:00 Introduction`
   **And** first timestamp must be `0:00` for YouTube to recognize chapters

5. **Given** metadata storage requirement
   **When** metadata is successfully generated
   **Then** it is stored to Firestore at `pipelines/{date}/youtube/metadata`
   **And** includes generation timestamp and version

## Tasks / Subtasks

- [ ] Task 1: Extend VideoMetadata Type (AC: #1)
  - [ ] Add `defaultAudioLanguage` to VideoMetadata interface
  - [ ] Add `madeForKids` boolean to VideoMetadata interface
  - [ ] Add `containsSyntheticMedia` boolean to VideoMetadata interface
  - [ ] Create `AffiliateLink` type with url, name, utmParams
  - [ ] Create `ChapterMarker` type with timestamp, title
  - [ ] Create `MetadataConfig` type for config loading

- [ ] Task 2: Implement Title Generation (AC: #1)
  - [ ] Create `generateTitle(topic: NewsItem, script: string)` function
  - [ ] Implement title templates for different topic types
  - [ ] Add title length validation (max 100 chars)
  - [ ] Sanitize title to remove `<` and `>` characters
  - [ ] Add engaging prefixes/suffixes based on topic category
  - [ ] Unit tests for title generation edge cases

- [ ] Task 3: Implement Description Generation (AC: #2)
  - [ ] Create `generateDescription(topic, script, sourceUrls, affiliates)` function
  - [ ] Implement hook summary extraction from script intro
  - [ ] Implement topic list formatting
  - [ ] Implement source URL formatting
  - [ ] Implement affiliate links section with disclosure
  - [ ] Validate total byte length stays under 5000 bytes
  - [ ] Handle UTF-8 multi-byte characters correctly
  - [ ] Unit tests for description generation

- [ ] Task 4: Implement Tags Generation (AC: #1)
  - [ ] Create `generateTags(topic: NewsItem, script: string)` function
  - [ ] Extract keywords from topic title and script
  - [ ] Include base tags: AI, MachineLearning, TechNews, NEXUSAI
  - [ ] Add source-specific tags (GitHub, HuggingFace, etc.)
  - [ ] Validate total character count (max 500, including commas)
  - [ ] Handle tags with spaces (counted as 2 extra chars for quotes)
  - [ ] Unit tests for tag generation and length validation

- [ ] Task 5: Implement Chapter Markers (AC: #4)
  - [ ] Create `extractChapterMarkers(script: string, audioDuration: number)` function
  - [ ] Parse `[VISUAL: ...]` cues from script as section breaks
  - [ ] Calculate approximate timestamps based on word count and audio duration
  - [ ] Format as YouTube-compatible chapters: `0:00 Title`
  - [ ] Ensure first chapter is `0:00 Introduction`
  - [ ] Validate chapter format meets YouTube requirements
  - [ ] Unit tests for chapter extraction

- [ ] Task 6: Implement Affiliate Links Loading (AC: #3)
  - [ ] Create `data/config/affiliates.json` config file
  - [ ] Create `loadAffiliateLinks()` function
  - [ ] Add UTM parameter generation (utm_source=youtube, utm_medium=video, etc.)
  - [ ] Create affiliate link formatter with disclosure text
  - [ ] Unit tests for affiliate loading

- [ ] Task 7: Main generateMetadata Function (AC: all)
  - [ ] Update `generateMetadata(options: MetadataGenerationOptions)` in metadata.ts
  - [ ] Orchestrate all sub-generators (title, description, tags, chapters)
  - [ ] Add input validation for required fields
  - [ ] Add Firestore persistence at `pipelines/{date}/youtube/metadata`
  - [ ] Return complete VideoMetadata object
  - [ ] Integration test with mock topic and script

- [ ] Task 8: Testing
  - [ ] Unit tests for each generation function
  - [ ] Edge case tests: long titles, special characters, empty scripts
  - [ ] Byte length validation tests for description
  - [ ] Character length validation tests for tags
  - [ ] Integration test with realistic topic and script data

## Dev Notes

### CRITICAL: YouTube API Metadata Constraints (Verified 2026-01-18)

Per official YouTube Data API v3 documentation:

| Field | Constraint | Notes |
|-------|-----------|-------|
| `snippet.title` | Max 100 chars | No `<` or `>` allowed |
| `snippet.description` | Max 5000 **bytes** | UTF-8 encoded, not characters! |
| `snippet.tags[]` | Max 500 chars total | Commas count, spaces add quotes (+2 chars) |
| `snippet.categoryId` | String | "28" = Science & Technology |
| `snippet.defaultLanguage` | Language code | "en" for English |
| `snippet.defaultAudioLanguage` | Language code | "en" for English audio |
| `status.madeForKids` | Boolean | COPPA compliance - set to `false` |
| `status.containsSyntheticMedia` | Boolean | **NEW** - set to `true` for AI-generated content |

**IMPORTANT:** The `containsSyntheticMedia` field is relatively new and indicates AI-generated content. Since NEXUS-AI produces fully automated content, this should be set to `true` for transparency and compliance.

### YouTube Chapter Requirements

For YouTube to recognize chapters:
1. First timestamp **MUST** be `0:00`
2. Minimum 3 chapters required
3. Format: `0:00 Title` (timestamp space title)
4. Chapters must be in description, not separate field
5. Each chapter minimum 10 seconds apart

Example chapters:
```
0:00 Introduction
0:45 Today's Top Story: GPT-5 Release
2:30 GitHub Trending: New AI Framework
4:15 Research Paper Highlight
6:00 Tools & Resources
7:30 Conclusion
```

### Byte vs Character Length Validation

**CRITICAL:** YouTube description is limited to 5000 **bytes**, NOT characters!

```typescript
// WRONG: Counting characters
if (description.length > 5000) { /* ... */ }

// CORRECT: Counting UTF-8 bytes
if (Buffer.byteLength(description, 'utf8') > 5000) { /* ... */ }
```

Multi-byte characters (emojis, non-ASCII) count as 2-4 bytes each.

### Tags Character Counting Rules

```typescript
// Tags array: ["AI", "Machine Learning", "GPT-5"]
// Character counting:
// - "AI" = 2 chars
// - "Machine Learning" = 16 chars + 2 for quotes = 18 chars (spaces = quoted)
// - "GPT-5" = 5 chars
// - Commas between = 2 chars
// Total: 2 + 18 + 5 + 2 = 27 chars

function calculateTagsLength(tags: string[]): number {
  return tags.reduce((total, tag, index) => {
    const tagLength = tag.includes(' ') ? tag.length + 2 : tag.length;
    const comma = index > 0 ? 1 : 0;
    return total + tagLength + comma;
  }, 0);
}
```

### Affiliate Links Configuration

Create `data/config/affiliates.json`:
```json
{
  "links": [
    {
      "name": "Cursor AI",
      "url": "https://cursor.sh",
      "category": "tools"
    },
    {
      "name": "OpenAI API",
      "url": "https://platform.openai.com",
      "category": "api"
    }
  ],
  "utmParams": {
    "utm_source": "youtube",
    "utm_medium": "video",
    "utm_campaign": "nexus-ai"
  },
  "disclosureText": "Some links are affiliate links. I may earn a small commission at no extra cost to you."
}
```

### Project Structure Notes

**Existing Package Files (from Story 4.1):**
```
packages/youtube/
  src/
    index.ts           # Exports (already includes metadata.ts export)
    types.ts           # VideoMetadata type exists, needs extending
    client.ts          # YouTube API client with OAuth
    uploader.ts        # ResumableUploader class
    quota.ts           # QuotaTracker class
    youtube.ts         # Main stage logic
    metadata.ts        # PLACEHOLDER - this is what we implement!
    scheduler.ts       # Placeholder for Story 4.4
    __tests__/
      client.test.ts
      uploader.test.ts
      quota.test.ts
```

**Files to Create/Modify:**
- `packages/youtube/src/metadata.ts` - Replace placeholder with full implementation
- `packages/youtube/src/types.ts` - Extend VideoMetadata interface
- `packages/youtube/src/__tests__/metadata.test.ts` - New test file
- `data/config/affiliates.json` - New config file

### Type Definitions to Add/Update

```typescript
// In types.ts - EXTEND existing VideoMetadata
export interface VideoMetadata {
  title: string;                      // Existing
  description: string;                // Existing
  tags: string[];                     // Existing
  categoryId: string;                 // Existing
  defaultLanguage?: string;           // Existing
  defaultAudioLanguage?: string;      // NEW - add this
  madeForKids?: boolean;              // NEW - add this
  containsSyntheticMedia?: boolean;   // NEW - add this (AI disclosure)
}

// New types for metadata generation
export interface MetadataGenerationOptions {
  topic: NewsItem;                    // From @nexus-ai/news-sourcing
  script: string;                     // Final script content
  sourceUrls: string[];               // URLs mentioned in script
  audioDuration?: number;             // For chapter timestamp calculation
  pipelineId: string;                 // For Firestore storage
}

export interface ChapterMarker {
  timestamp: string;                  // Format: "0:00" or "1:30"
  title: string;                      // Chapter title
}

export interface AffiliateLink {
  name: string;
  url: string;
  category: string;
  fullUrl?: string;                   // With UTM params
}

export interface AffiliateConfig {
  links: AffiliateLink[];
  utmParams: Record<string, string>;
  disclosureText: string;
}
```

### Imports Needed

```typescript
// metadata.ts imports
import type { NewsItem } from '@nexus-ai/news-sourcing';
import type { VideoMetadata, MetadataGenerationOptions, ChapterMarker } from './types.js';
import { FirestoreClient } from '@nexus-ai/core';
import { createLogger } from '@nexus-ai/core';
import { readFile } from 'fs/promises';
import { join } from 'path';

const logger = createLogger('youtube.metadata');
```

### Previous Story Intelligence (Story 4.1)

Key learnings from 4-1 implementation to apply:
- **Quota tracking already implemented** - Videos.update costs 50 units (for metadata updates)
- **NexusError with severity** - Use `NexusError.retryable()` for transient failures
- **Structured logging** - Use `createLogger('youtube.metadata')` pattern
- **Type safety** - All inputs/outputs must be strongly typed
- **Test coverage target** - Aim for 50+ tests covering edge cases
- **No provider abstraction** - YouTube is the only destination, no fallback needed

### Integration with Existing YouTube Package

The metadata generation should integrate with existing upload flow:

```typescript
// In youtube.ts - expected integration point
import { generateMetadata } from './metadata.js';

// During upload stage
const metadata = await generateMetadata({
  topic: input.data.topic,
  script: input.data.script,
  sourceUrls: input.data.sourceUrls,
  audioDuration: input.data.audioDuration,
  pipelineId: input.pipelineId,
});

// Use metadata in upload
await uploader.uploadVideo({
  videoPath: input.data.videoPath,
  metadata,
  privacyStatus: 'private',  // For scheduled publish
});
```

### Error Handling

```typescript
// Error codes to use
'NEXUS_YOUTUBE_TITLE_TOO_LONG'        // Title exceeds 100 chars
'NEXUS_YOUTUBE_DESCRIPTION_TOO_LONG'  // Description exceeds 5000 bytes
'NEXUS_YOUTUBE_TAGS_TOO_LONG'         // Tags exceed 500 chars
'NEXUS_YOUTUBE_INVALID_CHARS'         // Invalid characters in title
'NEXUS_YOUTUBE_METADATA_VALIDATION'   // General validation failure
'NEXUS_YOUTUBE_AFFILIATE_LOAD_ERROR'  // Failed to load affiliate config
```

### References

- [YouTube Data API Videos Resource](https://developers.google.com/youtube/v3/docs/videos#resource) - [Source: verified 2026-01-18]
- [YouTube Chapter Requirements](https://support.google.com/youtube/answer/9884579) - Chapter format rules
- [Architecture Decision: Naming Conventions](/_bmad-output/planning-artifacts/architecture.md#naming-patterns)
- [Project Context: Critical Rules](/_bmad-output/project-context.md#critical-rules-must-follow)
- [Previous Story: 4-1 YouTube Package](/_bmad-output/implementation-artifacts/4-1-create-youtube-package.md)
- [FR25 Requirements](/_bmad-output/planning-artifacts/epics.md#story-42-implement-video-metadata)

### Title Generation Templates

Suggested title patterns for engagement:

```typescript
const titlePatterns = [
  // Breaking news
  "{topic_title} - What You Need to Know",
  "BREAKING: {topic_title}",
  
  // Curiosity-driven
  "This Changes Everything: {topic_title}",
  "Why {topic_title} Matters",
  
  // How-to/educational
  "Understanding {topic_title}",
  "{topic_title} Explained in 8 Minutes",
  
  // List-based
  "AI News: {topic_count} Things You Missed Today",
  "Top AI Developments: {date}",
];

// Select pattern based on topic metadata and source
function selectTitlePattern(topic: NewsItem): string {
  if (topic.source === 'huggingface' || topic.source === 'arxiv') {
    return "{topic_title} Explained";  // Research-focused
  }
  if (topic.viralityScore > 100) {
    return "BREAKING: {topic_title}";  // High virality = breaking
  }
  return "{topic_title} - Daily AI Briefing";  // Default
}
```

### Quality Validation Checklist

Before returning metadata, validate:
- [ ] Title length <= 100 characters
- [ ] Title contains no `<` or `>` characters
- [ ] Description byte length <= 5000 bytes (UTF-8)
- [ ] Tags total characters <= 500
- [ ] At least 3 chapters if audioDuration > 60 seconds
- [ ] First chapter timestamp is `0:00`
- [ ] CategoryId is "28"
- [ ] madeForKids is `false`
- [ ] containsSyntheticMedia is `true`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

