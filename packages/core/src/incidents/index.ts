/**
 * Incident logging and management for NEXUS-AI pipeline
 *
 * Provides comprehensive incident tracking following FR34 requirements:
 * - Incident creation with auto-generated IDs
 * - Severity mapping from NexusError
 * - Query functions with caching
 * - Resolution workflow
 * - Digest integration for daily summaries
 * - Post-mortem template generation for CRITICAL incidents
 *
 * @module @nexus-ai/core/incidents
 */

// Export all types
export type {
  IncidentSeverity,
  ResolutionType,
  RootCauseType,
  IncidentErrorDetails,
  ResolutionDetails,
  IncidentContext,
  Incident,
  IncidentRecord,
  PostMortemTimeline,
  PostMortemImpact,
  PostMortemTemplate,
  IncidentDigestEntry,
  IncidentSummary,
  IncidentIdCacheOptions,
  IncidentQueryCacheEntry,
} from './types.js';

// Export logger functions
export {
  logIncident,
  generateIncidentId,
  generatePostMortemTemplate,
  mapSeverity,
  inferRootCause,
  isCriticalStage,
} from './logger.js';

// Export query functions
export {
  getIncidentById,
  getIncidentsByDate,
  getIncidentsByStage,
  getOpenIncidents,
  clearQueryCache,
  type IncidentQueryOptions,
} from './queries.js';

// Export resolution functions
export { resolveIncident } from './resolution.js';

// Export digest functions
export { getIncidentSummaryForDigest } from './digest.js';
