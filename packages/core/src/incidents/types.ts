/**
 * Incident types and interfaces for NEXUS-AI pipeline incident logging
 *
 * Provides strongly-typed incident management following FR34 requirements:
 * - Incident records with timestamps, duration, root cause, resolution
 * - Severity levels: CRITICAL, WARNING, RECOVERABLE
 * - Post-mortem templates for CRITICAL incidents
 * - Digest integration for daily summaries
 *
 * @module @nexus-ai/core/incidents/types
 */

// =============================================================================
// Severity Types
// =============================================================================

/**
 * Incident severity level
 * Maps from NexusError ErrorSeverity to incident-specific severity
 */
export type IncidentSeverity = 'CRITICAL' | 'WARNING' | 'RECOVERABLE';

/**
 * Resolution type for how an incident was resolved
 */
export type ResolutionType =
  | 'retry'
  | 'fallback'
  | 'skip'
  | 'manual'
  | 'auto_recovered';

/**
 * Root cause categories for incident classification
 */
export type RootCauseType =
  | 'api_outage'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'timeout'
  | 'network_error'
  | 'auth_failure'
  | 'config_error'
  | 'data_error'
  | 'resource_exhausted'
  | 'dependency_failure'
  | 'unknown';

// =============================================================================
// Core Incident Interfaces
// =============================================================================

/**
 * Error details captured from NexusError
 */
export interface IncidentErrorDetails {
  /** Error code following NEXUS_{DOMAIN}_{TYPE} format */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Stack trace (optional, for debugging) */
  stack?: string;
}

/**
 * Resolution details for closed incidents
 */
export interface ResolutionDetails {
  /** How the incident was resolved */
  type: ResolutionType;
  /** Additional notes about resolution */
  notes?: string;
  /** Who/what resolved the incident */
  resolvedBy?: 'system' | 'operator';
}

/**
 * Context captured at time of failure
 */
export interface IncidentContext {
  /** Which provider failed (if applicable) */
  provider?: string;
  /** Which retry attempt this was */
  attempt?: number;
  /** Fallbacks that were tried before failure */
  fallbacksUsed?: string[];
  /** Quality context at time of failure */
  qualityContext?: Record<string, unknown>;
  /** Additional context fields */
  [key: string]: unknown;
}

/**
 * Incident input for logging new incidents
 * Contains all data needed to create an incident record
 */
export interface Incident {
  /** Pipeline date in YYYY-MM-DD format */
  date: string;
  /** Pipeline ID (same as date for daily pipeline) */
  pipelineId: string;
  /** Stage that failed (e.g., "tts", "research") */
  stage: string;
  /** Error details from NexusError */
  error: IncidentErrorDetails;
  /** Incident severity */
  severity: IncidentSeverity;
  /** When incident started (ISO 8601 UTC) */
  startTime: string;
  /** Identified root cause */
  rootCause: RootCauseType;
  /** Context at time of failure */
  context: IncidentContext;
}

/**
 * Full incident record stored in Firestore
 * Extends Incident with ID, resolution, timestamps, and optional post-mortem
 */
export interface IncidentRecord extends Incident {
  /** Unique identifier: "YYYY-MM-DD-NNN" (e.g., "2026-01-22-001") */
  id: string;
  /** Whether incident is open (unresolved) - used for efficient querying */
  isOpen: boolean;
  /** When resolved (ISO 8601 UTC, undefined if still open) */
  endTime?: string;
  /** Time to resolution in milliseconds */
  duration?: number;
  /** Resolution details (undefined if still open) */
  resolution?: ResolutionDetails;
  /** Post-mortem template (CRITICAL incidents only) */
  postMortem?: PostMortemTemplate;
  /** When record was created (ISO 8601 UTC) */
  createdAt: string;
  /** Last update timestamp (ISO 8601 UTC) */
  updatedAt: string;
}

// =============================================================================
// Post-Mortem Types
// =============================================================================

/**
 * Timeline entries for post-mortem analysis
 */
export interface PostMortemTimeline {
  /** When incident was detected */
  detected: string;
  /** Description of what failed */
  impact: string;
  /** When resolved (if applicable) */
  resolved?: string;
}

/**
 * Impact assessment for post-mortem
 */
export interface PostMortemImpact {
  /** Whether pipeline was affected */
  pipelineAffected: boolean;
  /** Which stage was affected */
  stageAffected: string;
  /** Whether video output was potentially impacted */
  potentialVideoImpact: boolean;
}

/**
 * Auto-generated post-mortem template for CRITICAL incidents
 */
export interface PostMortemTemplate {
  /** When template was generated (ISO 8601 UTC) */
  generatedAt: string;
  /** Incident timeline */
  timeline: PostMortemTimeline;
  /** Auto-generated summary */
  summary: string;
  /** Impact assessment */
  impact: PostMortemImpact;
  /** Placeholder for root cause analysis (human fills in) */
  rootCauseAnalysis: string;
  /** Action items (empty array for human to add) */
  actionItems: string[];
  /** Placeholder for lessons learned (human fills in) */
  lessonsLearned: string;
}

// =============================================================================
// Digest Types
// =============================================================================

/**
 * Individual incident entry for digest summary
 */
export interface IncidentDigestEntry {
  /** Incident ID */
  id: string;
  /** Stage that failed */
  stage: string;
  /** Incident severity */
  severity: IncidentSeverity;
  /** Short error message */
  error: string;
  /** Resolution type if resolved */
  resolution?: string;
  /** Duration in milliseconds if resolved */
  duration?: number;
}

/**
 * Incident summary for daily digest email
 * Compatible with @nexus-ai/notifications digest format
 */
export interface IncidentSummary {
  /** Summary date in YYYY-MM-DD format */
  date: string;
  /** Total number of incidents */
  totalCount: number;
  /** Number of CRITICAL incidents */
  criticalCount: number;
  /** Number of WARNING incidents */
  warningCount: number;
  /** Number of RECOVERABLE incidents */
  recoverableCount: number;
  /** Stages that had incidents */
  stagesAffected: string[];
  /** Average resolution time in ms (null if no resolved incidents) */
  avgResolutionTimeMs: number | null;
  /** Number of open (unresolved) incidents */
  openIncidents: number;
  /** Individual incident entries */
  incidents: IncidentDigestEntry[];
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Options for incident ID generation caching
 */
export interface IncidentIdCacheOptions {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  ttlMs?: number;
}

/**
 * Query cache entry for incident queries
 */
export interface IncidentQueryCacheEntry<T> {
  /** Cached data */
  data: T;
  /** When the cache entry was created */
  timestamp: number;
  /** Cache TTL in milliseconds */
  ttlMs: number;
}
