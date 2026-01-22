/**
 * Incident digest helpers for NEXUS-AI pipeline
 *
 * Provides functions to generate incident summaries for daily digest emails.
 * Compatible with @nexus-ai/notifications digest format.
 *
 * @module @nexus-ai/core/incidents/digest
 */

import { FirestoreClient } from '../storage/firestore-client.js';
import { createLogger } from '../observability/logger.js';
import type { IncidentRecord, IncidentSummary, IncidentDigestEntry } from './types.js';

const logger = createLogger('nexus.core.incidents.digest');

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
 * Get incident summary for daily digest email
 *
 * Aggregates incident data for a specific date into a summary format
 * compatible with @nexus-ai/notifications digest format.
 *
 * @param date - Pipeline date in YYYY-MM-DD format
 * @returns Incident summary for digest
 *
 * @example
 * ```typescript
 * const summary = await getIncidentSummaryForDigest('2026-01-22');
 * console.log(`Total incidents: ${summary.totalCount}`);
 * console.log(`Critical: ${summary.criticalCount}`);
 * console.log(`Avg resolution: ${summary.avgResolutionTimeMs}ms`);
 * ```
 */
export async function getIncidentSummaryForDigest(date: string): Promise<IncidentSummary> {
  const client = getFirestoreClient();

  // Query all incidents for the date
  const incidents = await client.queryDocuments<IncidentRecord>(INCIDENTS_COLLECTION, [
    { field: 'date', operator: '==', value: date },
  ]);

  // Calculate severity counts
  let criticalCount = 0;
  let warningCount = 0;
  let recoverableCount = 0;

  for (const incident of incidents) {
    switch (incident.severity) {
      case 'CRITICAL':
        criticalCount++;
        break;
      case 'WARNING':
        warningCount++;
        break;
      case 'RECOVERABLE':
        recoverableCount++;
        break;
    }
  }

  // Get unique stages affected
  const stagesAffected = [...new Set(incidents.map((i) => i.stage))];

  // Calculate average resolution time for resolved incidents
  const resolvedIncidents = incidents.filter((i) => i.endTime && i.duration !== undefined);
  const avgResolutionTimeMs =
    resolvedIncidents.length > 0
      ? Math.round(
          resolvedIncidents.reduce((sum, i) => sum + (i.duration ?? 0), 0) /
            resolvedIncidents.length
        )
      : null;

  // Count open incidents
  const openIncidents = incidents.filter((i) => !i.endTime).length;

  // Create digest entries
  const incidentEntries: IncidentDigestEntry[] = incidents.map((incident) => {
    const entry: IncidentDigestEntry = {
      id: incident.id,
      stage: incident.stage,
      severity: incident.severity,
      error: incident.error.message,
    };

    if (incident.resolution) {
      entry.resolution = incident.resolution.type;
    }

    if (incident.duration !== undefined) {
      entry.duration = incident.duration;
    }

    return entry;
  });

  const summary: IncidentSummary = {
    date,
    totalCount: incidents.length,
    criticalCount,
    warningCount,
    recoverableCount,
    stagesAffected,
    avgResolutionTimeMs,
    openIncidents,
    incidents: incidentEntries,
  };

  logger.debug(
    {
      date,
      totalCount: summary.totalCount,
      criticalCount: summary.criticalCount,
      openIncidents: summary.openIncidents,
    },
    'Incident digest summary generated'
  );

  return summary;
}
