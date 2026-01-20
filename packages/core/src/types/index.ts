/**
 * Core types for NEXUS-AI pipeline
 * Re-exports all type definitions
 */

// Pipeline types
export type {
  StageConfig,
  ArtifactRef,
  QualityContext,
  StageInput,
  ProviderInfo,
  StageOutput,
  PipelineState,
} from './pipeline.js';

// Provider types
export type {
  CostBreakdown,
  LLMOptions,
  LLMResult,
  LLMProvider,
  Voice,
  TTSOptions,
  TTSResult,
  TTSProvider,
  ImageOptions,
  ImageResult,
  ImageProvider,
} from './providers.js';

// Quality types
export type {
  QualityMetrics,
  ScriptQualityMetrics,
  TTSQualityMetrics,
  RenderQualityMetrics,
  ThumbnailQualityMetrics,
  PronunciationQualityMetrics,
  PrePublishResult,
  QualityGateResult,
  QualityGate
} from '../quality/types.js';

export {
  QualityStatus,
  PublishDecision
} from '../quality/types.js';

export { ErrorSeverity } from './errors.js';

// Health check types
export type {
  HealthCheckStatus,
  HealthCheckService,
  ServiceCriticality,
  IndividualHealthCheck,
  HealthCheckResult,
  HealthCheckDocument,
  YouTubeQuotaCheck,
  ServiceHealthStats,
  RecurringIssue,
  HealthHistorySummary,
} from './health.js';

export {
  SERVICE_CRITICALITY,
  HEALTH_CHECK_TIMEOUT_MS,
  MAX_HEALTH_CHECK_DURATION_MS,
  YOUTUBE_QUOTA_THRESHOLDS,
} from './health.js';
