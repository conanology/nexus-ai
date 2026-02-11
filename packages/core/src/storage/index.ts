/**
 * Storage module for NEXUS-AI
 *
 * Provides Firestore and Cloud Storage clients with consistent error handling,
 * plus path helper functions for Firestore documents and GCS files.
 *
 * @module @nexus-ai/core/storage
 */

// Firestore client
export { FirestoreClient } from './firestore-client.js';
export type { FirestoreQueryFilter, FirestoreWhereFilterOp } from './firestore-client.js';

// Cloud Storage client
export { CloudStorageClient } from './cloud-storage-client.js';

// Local Storage client (for local development mode)
export { LocalStorageClient } from './local-storage-client.js';

// Storage factory (auto-selects Cloud or Local based on environment)
export {
  getStorageClient,
  isLocalStorageMode,
  resetStorageClient,
} from './storage-factory.js';
export type { StorageClient } from './storage-factory.js';

// Path helpers
export {
  // Firestore document paths
  getPipelineDocPath,
  getPipelineStatePath,
  getPipelineArtifactsPath,
  getPipelineCostsPath,
  getPipelineQualityPath,
  getPipelineYouTubePath,
  getPronunciationPath,
  getTopicPath,
  getBufferVideoPath,
  getIncidentPath,
  getReviewQueuePath,
  getQueuedTopicPath,
  // Cloud Storage paths
  buildStoragePath,
  parseStoragePath,
  isValidDateFormat,
  STORAGE_STAGES,
  // Convenience helpers
  getResearchPath,
  getScriptPath,
  getScriptDraftPath,
  getAudioPath,
  getAudioSegmentPath,
  getScenesPath,
  getThumbnailPath,
  getVideoPath,
} from './paths.js';

export type { StorageStage, ParsedStoragePath } from './paths.js';
