/**
 * Incident logging for NEXUS-AI pipeline
 *
 * Provides incident creation, ID generation, and post-mortem template generation.
 * Integrates with Firestore for persistence and Discord for CRITICAL alerts.
 *
 * @module @nexus-ai/core/incidents/logger
 */

import { FirestoreClient } from '../storage/firestore-client.js';
import { createLogger } from '../observability/logger.js';
import { ErrorSeverity } from '../types/errors.js';
import type {
  Incident,
  IncidentRecord,
  IncidentSeverity,
  PostMortemTemplate,
  RootCauseType,
} from './types.js';

const logger = createLogger('nexus.core.incidents.logger');

/** Collection name for incidents */
const INCIDENTS_COLLECTION = 'incidents';

// Lazy-initialized Firestore client
let firestoreClient: FirestoreClient | null = null;

/**
 * Get or create Firestore client
 */
function getFirestoreClient(): FirestoreClient {
  if (!firestoreClient) {
    firestoreClient = new FirestoreClient();
  }
  return firestoreClient;
}

// =============================================================================
// Severity Mapping
// =============================================================================

/**
 * Map NexusError ErrorSeverity to IncidentSeverity
 *
 * @param errorSeverity - Error severity from NexusError
 * @returns Mapped incident severity
 */
export function mapSeverity(errorSeverity: ErrorSeverity): IncidentSeverity {
  switch (errorSeverity) {
    case ErrorSeverity.CRITICAL:
      return 'CRITICAL';
    case ErrorSeverity.DEGRADED:
    case ErrorSeverity.FALLBACK:
      return 'WARNING';
    case ErrorSeverity.RECOVERABLE:
    case ErrorSeverity.RETRYABLE:
      return 'RECOVERABLE';
    default:
      return 'WARNING';
  }
}

// =============================================================================
// Root Cause Inference
// =============================================================================

/**
 * Infer root cause from error code
 *
 * @param errorCode - NexusError code (e.g., "NEXUS_TTS_TIMEOUT")
 * @returns Inferred root cause type
 */
export function inferRootCause(errorCode: string): RootCauseType {
  const upperCode = errorCode.toUpperCase();

  if (upperCode.includes('TIMEOUT')) return 'timeout';
  if (upperCode.includes('RATE_LIMIT')) return 'rate_limit';
  if (upperCode.includes('QUOTA')) return 'quota_exceeded';
  if (upperCode.includes('AUTH')) return 'auth_failure';
  if (upperCode.includes('NETWORK')) return 'network_error';
  if (upperCode.includes('CONFIG')) return 'config_error';
  if (upperCode.includes('DATA') || upperCode.includes('INVALID')) return 'data_error';
  if (upperCode.includes('RESOURCE') || upperCode.includes('MEMORY')) return 'resource_exhausted';
  if (upperCode.includes('DEPENDENCY')) return 'dependency_failure';
  if (upperCode.includes('OUTAGE')) return 'api_outage';

  return 'unknown';
}

// =============================================================================
// Critical Stage Detection
// =============================================================================

/**
 * Stages that directly impact video output
 */
const CRITICAL_STAGES = new Set([
  'tts',
  'render',
  'script-gen',
  'visual-gen',
  'thumbnail',
]);

/**
 * Check if a stage is critical for video production
 *
 * @param stage - Stage name
 * @returns true if stage is critical
 */
export function isCriticalStage(stage: string): boolean {
  return CRITICAL_STAGES.has(stage.toLowerCase());
}

// =============================================================================
// Incident ID Generation
// =============================================================================

/**
 * Generate a unique incident ID for a given date
 *
 * Format: {YYYY-MM-DD}-{sequence}
 * Example: "2026-01-22-001", "2026-01-22-002"
 *
 * NOTE: This implementation has a potential race condition if multiple incidents
 * are logged concurrently for the same date. In practice, this is unlikely since
 * the pipeline runs sequentially and incidents are rare. For production systems
 * with high concurrency, consider using Firestore transactions or atomic counters.
 *
 * @param date - Pipeline date in YYYY-MM-DD format
 * @returns Generated incident ID
 */
export async function generateIncidentId(date: string): Promise<string> {
  const client = getFirestoreClient();

  // Query existing incidents for this date
  const existing = await client.queryDocuments<IncidentRecord>(INCIDENTS_COLLECTION, [
    { field: 'date', operator: '==', value: date },
  ]);

  const sequence = String(existing.length + 1).padStart(3, '0');
  return `${date}-${sequence}`;
}

// =============================================================================
// Post-Mortem Template Generation
// =============================================================================

/**
 * Generate a post-mortem template for CRITICAL incidents
 *
 * @param incident - The incident to generate template for
 * @returns Generated post-mortem template
 */
export function generatePostMortemTemplate(incident: Incident): PostMortemTemplate {
  return {
    generatedAt: new Date().toISOString(),
    timeline: {
      detected: incident.startTime,
      impact: `Stage "${incident.stage}" failed with ${incident.error.code}`,
    },
    summary: `CRITICAL incident in ${incident.stage} stage: ${incident.error.message}`,
    impact: {
      pipelineAffected: true,
      stageAffected: incident.stage,
      potentialVideoImpact: isCriticalStage(incident.stage),
    },
    rootCauseAnalysis: '<!-- TODO: Fill in root cause analysis -->',
    actionItems: [],
    lessonsLearned: '<!-- TODO: Fill in lessons learned -->',
  };
}

// =============================================================================
// Incident Logging
// =============================================================================

/**
 * Log an incident to Firestore
 *
 * Creates an incident record with auto-generated ID, timestamps, and optional
 * post-mortem template for CRITICAL incidents. Sends Discord alert for CRITICAL.
 *
 * @param incident - Incident data to log
 * @returns Generated incident ID
 *
 * @example
 * ```typescript
 * const incidentId = await logIncident({
 *   date: '2026-01-22',
 *   pipelineId: '2026-01-22',
 *   stage: 'tts',
 *   error: { code: 'NEXUS_TTS_TIMEOUT', message: 'TTS timed out' },
 *   severity: 'CRITICAL',
 *   startTime: new Date().toISOString(),
 *   rootCause: 'timeout',
 *   context: { provider: 'gemini-tts', attempt: 3 },
 * });
 * ```
 */
export async function logIncident(incident: Incident): Promise<string> {
  const client = getFirestoreClient();
  const now = new Date().toISOString();

  // Generate unique ID
  const id = await generateIncidentId(incident.date);

  // Build incident record
  const record: IncidentRecord = {
    ...incident,
    id,
    isOpen: true, // New incidents are open until resolved
    createdAt: now,
    updatedAt: now,
  };

  // Generate post-mortem for CRITICAL incidents
  if (incident.severity === 'CRITICAL') {
    record.postMortem = generatePostMortemTemplate(incident);
  }

  // Persist to Firestore
  await client.setDocument(INCIDENTS_COLLECTION, id, record);

  logger.info(
    {
      incidentId: id,
      pipelineId: incident.pipelineId,
      stage: incident.stage,
      severity: incident.severity,
      rootCause: incident.rootCause,
    },
    'Incident logged'
  );

  // Send Discord alert for CRITICAL incidents
  // Note: Discord alerts are sent by the orchestrator which imports @nexus-ai/notifications
  // The incident logging module doesn't directly depend on notifications to avoid circular deps
  if (incident.severity === 'CRITICAL') {
    logger.info(
      { incidentId: id, severity: 'CRITICAL' },
      'CRITICAL incident logged - orchestrator will handle Discord alert'
    );
  }

  return id;
}
