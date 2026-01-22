/**
 * Incident resolution functions for NEXUS-AI pipeline
 *
 * Provides resolution workflow for closing incidents with duration tracking.
 *
 * @module @nexus-ai/core/incidents/resolution
 */

import { FirestoreClient } from '../storage/firestore-client.js';
import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/nexus-error.js';
import type { IncidentRecord, ResolutionDetails } from './types.js';

const logger = createLogger('nexus.core.incidents.resolution');

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

/**
 * Resolve an incident with resolution details
 *
 * Sets the endTime, calculates duration, and updates resolution information.
 * Logs the resolution event via structured logger.
 *
 * @param id - Incident ID to resolve
 * @param resolution - Resolution details (type, notes, resolvedBy)
 * @throws NexusError if incident not found or update fails
 *
 * @example
 * ```typescript
 * await resolveIncident('2026-01-22-001', {
 *   type: 'retry',
 *   notes: 'Succeeded after 2nd retry',
 *   resolvedBy: 'system',
 * });
 * ```
 */
export async function resolveIncident(
  id: string,
  resolution: ResolutionDetails
): Promise<void> {
  const client = getFirestoreClient();
  const now = new Date();
  const endTime = now.toISOString();

  // Get current incident to calculate duration
  const incident = await client.getDocument<IncidentRecord>(INCIDENTS_COLLECTION, id);

  if (!incident) {
    throw NexusError.recoverable(
      'NEXUS_INCIDENT_NOT_FOUND',
      `Incident not found: ${id}`,
      'incidents',
      { incidentId: id }
    );
  }

  // Calculate duration
  const startTime = new Date(incident.startTime);
  const duration = now.getTime() - startTime.getTime();

  // Update incident record - mark as closed
  const updates: Partial<IncidentRecord> = {
    isOpen: false, // Mark incident as resolved
    endTime,
    duration,
    resolution,
    updatedAt: endTime,
  };

  await client.updateDocument(INCIDENTS_COLLECTION, id, updates);

  logger.info(
    {
      incidentId: id,
      pipelineId: incident.pipelineId,
      stage: incident.stage,
      severity: incident.severity,
      resolutionType: resolution.type,
      durationMs: duration,
    },
    'Incident resolved'
  );
}
