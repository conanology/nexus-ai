/**
 * Path helper functions for Firestore documents and Cloud Storage files
 *
 * Provides consistent path generation following the architecture specifications:
 * - Firestore: pipelines/{date}/*, pronunciation/{term}, topics/{date}, etc.
 * - Cloud Storage: {date}/{stage}/{filename}
 *
 * @module @nexus-ai/core/storage/paths
 */

// ============================================================================
// Firestore Document Paths
// ============================================================================

/**
 * Build a pipeline subdocument path
 * @param date - Pipeline date in YYYY-MM-DD format
 * @param subDoc - Subdocument name (state, artifacts, costs, quality, youtube)
 * @returns Firestore document path
 */
export function getPipelineDocPath(date: string, subDoc: string): string {
  return `pipelines/${date}/${subDoc}`;
}

/**
 * Get pipeline state document path
 * @param date - Pipeline date in YYYY-MM-DD format
 * @returns Path: pipelines/{date}/state
 */
export function getPipelineStatePath(date: string): string {
  return getPipelineDocPath(date, 'state');
}

/**
 * Get pipeline artifacts document path
 * @param date - Pipeline date in YYYY-MM-DD format
 * @returns Path: pipelines/{date}/artifacts
 */
export function getPipelineArtifactsPath(date: string): string {
  return getPipelineDocPath(date, 'artifacts');
}

/**
 * Get pipeline costs document path
 * @param date - Pipeline date in YYYY-MM-DD format
 * @returns Path: pipelines/{date}/costs
 */
export function getPipelineCostsPath(date: string): string {
  return getPipelineDocPath(date, 'costs');
}

/**
 * Get pipeline quality document path
 * @param date - Pipeline date in YYYY-MM-DD format
 * @returns Path: pipelines/{date}/quality
 */
export function getPipelineQualityPath(date: string): string {
  return getPipelineDocPath(date, 'quality');
}

/**
 * Get pipeline YouTube document path
 * @param date - Pipeline date in YYYY-MM-DD format
 * @returns Path: pipelines/{date}/youtube
 */
export function getPipelineYouTubePath(date: string): string {
  return getPipelineDocPath(date, 'youtube');
}

/**
 * Get pronunciation entry document path
 * @param term - The term to look up pronunciation for
 * @returns Path: pronunciation/{term}
 */
export function getPronunciationPath(term: string): string {
  return `pronunciation/${term}`;
}

/**
 * Get topic selection document path
 * @param date - Topic selection date in YYYY-MM-DD format
 * @returns Path: topics/{date}
 */
export function getTopicPath(date: string): string {
  return `topics/${date}`;
}

/**
 * Get buffer video document path
 * @param id - Buffer video ID
 * @returns Path: buffer-videos/{id}
 */
export function getBufferVideoPath(id: string): string {
  return `buffer-videos/${id}`;
}

/**
 * Get incident document path
 * @param id - Incident ID
 * @returns Path: incidents/{id}
 */
export function getIncidentPath(id: string): string {
  return `incidents/${id}`;
}

/**
 * Get review queue item document path
 * @param id - Review queue item ID
 * @returns Path: review-queue/{id}
 */
export function getReviewQueuePath(id: string): string {
  return `review-queue/${id}`;
}

/**
 * Get queued topic document path
 * @param date - Target retry date in YYYY-MM-DD format
 * @returns Path: queued-topics/{date}
 */
export function getQueuedTopicPath(date: string): string {
  return `queued-topics/${date}`;
}

// ============================================================================
// Cloud Storage Paths
// ============================================================================

/**
 * Regular expression for validating YYYY-MM-DD date format
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check if a string is a valid YYYY-MM-DD date format
 * @param date - String to validate
 * @returns true if valid date format
 */
export function isValidDateFormat(date: string): boolean {
  return DATE_REGEX.test(date);
}

/**
 * Valid storage stages for artifact organization
 */
export type StorageStage =
  | 'research'
  | 'script-drafts'
  | 'script-gen'
  | 'tts'
  | 'audio-segments'
  | 'visual-gen'
  | 'thumbnails'
  | 'render';

/**
 * All valid storage stages
 */
export const STORAGE_STAGES: StorageStage[] = [
  'research',
  'script-drafts',
  'script-gen',
  'tts',
  'audio-segments',
  'visual-gen',
  'thumbnails',
  'render',
];

/**
 * Build a Cloud Storage path
 * @param date - Pipeline date in YYYY-MM-DD format
 * @param stage - Pipeline stage
 * @param filename - File name
 * @returns Storage path: {date}/{stage}/{filename}
 */
export function buildStoragePath(
  date: string,
  stage: StorageStage,
  filename: string
): string {
  return `${date}/${stage}/${filename}`;
}

/**
 * Parsed storage path components
 */
export interface ParsedStoragePath {
  date: string;
  stage: StorageStage;
  filename: string;
}

/**
 * Parse a Cloud Storage path into its components
 * @param path - Storage path to parse
 * @param validateDate - Whether to validate date format (default: true)
 * @returns Parsed path components
 * @throws Error if path format is invalid
 */
export function parseStoragePath(path: string, validateDate: boolean = true): ParsedStoragePath {
  const parts = path.split('/');
  if (parts.length < 3) {
    throw new Error(`Invalid storage path format: ${path}. Expected: {date}/{stage}/{filename}`);
  }

  const date = parts[0];
  if (validateDate && !isValidDateFormat(date)) {
    throw new Error(
      `Invalid date format: ${date}. Expected: YYYY-MM-DD (e.g., 2026-01-08)`
    );
  }

  const stage = parts[1] as StorageStage;
  if (!STORAGE_STAGES.includes(stage)) {
    throw new Error(
      `Invalid storage stage: ${stage}. Valid stages: ${STORAGE_STAGES.join(', ')}`
    );
  }

  return {
    date,
    stage,
    filename: parts.slice(2).join('/'),
  };
}

// ============================================================================
// Convenience Helpers for Common Files
// ============================================================================

/**
 * Get research brief storage path
 * @param date - Pipeline date
 * @returns Path: {date}/research/research.md
 */
export function getResearchPath(date: string): string {
  return buildStoragePath(date, 'research', 'research.md');
}

/**
 * Get final script storage path
 * @param date - Pipeline date
 * @returns Path: {date}/script-gen/script.md
 */
export function getScriptPath(date: string): string {
  return buildStoragePath(date, 'script-gen', 'script.md');
}

/**
 * Get script draft storage path
 * @param date - Pipeline date
 * @param version - Draft version (e.g., 'v1-writer', 'v2-critic', 'v3-optimizer')
 * @returns Path: {date}/script-drafts/{version}.md
 */
export function getScriptDraftPath(date: string, version: string): string {
  return buildStoragePath(date, 'script-drafts', `${version}.md`);
}

/**
 * Get final audio storage path
 * @param date - Pipeline date
 * @returns Path: {date}/tts/audio.wav
 */
export function getAudioPath(date: string): string {
  return buildStoragePath(date, 'tts', 'audio.wav');
}

/**
 * Get audio segment storage path
 * @param date - Pipeline date
 * @param index - Segment index
 * @returns Path: {date}/audio-segments/{index}.wav
 */
export function getAudioSegmentPath(date: string, index: number): string {
  return buildStoragePath(date, 'audio-segments', `${index}.wav`);
}

/**
 * Get scenes JSON storage path
 * @param date - Pipeline date
 * @returns Path: {date}/visual-gen/scenes.json
 */
export function getScenesPath(date: string): string {
  return buildStoragePath(date, 'visual-gen', 'scenes.json');
}

/**
 * Get thumbnail storage path
 * @param date - Pipeline date
 * @param variant - Thumbnail variant number (1, 2, or 3)
 * @returns Path: {date}/thumbnails/{variant}.png
 */
export function getThumbnailPath(date: string, variant: number): string {
  return buildStoragePath(date, 'thumbnails', `${variant}.png`);
}

/**
 * Get final video storage path
 * @param date - Pipeline date
 * @returns Path: {date}/render/video.mp4
 */
export function getVideoPath(date: string): string {
  return buildStoragePath(date, 'render', 'video.mp4');
}
