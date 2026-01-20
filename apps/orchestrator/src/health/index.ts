/**
 * Health check module for NEXUS-AI orchestrator
 *
 * Provides pre-pipeline health verification for all external APIs
 * and GCP services used by the pipeline.
 *
 * @module orchestrator/health
 */

// Individual service health checkers
export { checkGeminiHealth } from './gemini-health.js';
export { checkYouTubeHealth, getQuotaAlertLevel } from './youtube-health.js';
export { checkTwitterHealth } from './twitter-health.js';
export { checkFirestoreHealth } from './firestore-health.js';
export { checkStorageHealth } from './storage-health.js';
export { checkSecretsHealth } from './secrets-health.js';

// Core health check orchestration
export { performHealthCheck, hasCriticalFailures, getHealthCheckSummary } from './perform-health-check.js';

// Failure handling
export { handleHealthCheckFailure, triggerBufferDeployment } from './failure-handler.js';

// Health history
export { getHealthHistory } from './history.js';

// Re-export types from core
export type {
  HealthCheckStatus,
  HealthCheckService,
  ServiceCriticality,
  IndividualHealthCheck,
  HealthCheckResult,
  HealthCheckDocument,
  YouTubeQuotaCheck,
  HealthHistorySummary,
} from '@nexus-ai/core';

export {
  SERVICE_CRITICALITY,
  HEALTH_CHECK_TIMEOUT_MS,
  MAX_HEALTH_CHECK_DURATION_MS,
  YOUTUBE_QUOTA_THRESHOLDS,
} from '@nexus-ai/core';
