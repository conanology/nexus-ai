/**
 * Incident query functions for NEXUS-AI pipeline
 *
 * Provides typed query functions with caching for efficient incident retrieval.
 *
 * @module @nexus-ai/core/incidents/queries
 */

import { FirestoreClient } from '../storage/firestore-client.js';
import { createLogger } from '../observability/logger.js';
import type { IncidentRecord, IncidentQueryCacheEntry } from './types.js';

const logger = createLogger('nexus.core.incidents.queries');

/** Collection name for incidents */
const INCIDENTS_COLLECTION = 'incidents';

// Default cache TTL: 5 minutes
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

// Query cache
const queryCache = new Map<string, IncidentQueryCacheEntry<IncidentRecord[]>>();

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
 * Query options for incident queries
 */
export interface IncidentQueryOptions {
  /** Bypass cache and fetch fresh data */
  bypassCache?: boolean;
  /** Custom TTL in milliseconds */
  ttlMs?: number;
}

/**
 * Check if a cache entry is still valid
 */
function isCacheValid<T>(entry: IncidentQueryCacheEntry<T> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < entry.ttlMs;
}

/**
 * Get from cache or execute query
 */
async function getCachedOrQuery<T extends IncidentRecord[]>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  options: IncidentQueryOptions = {}
): Promise<T> {
  const { bypassCache = false, ttlMs = DEFAULT_CACHE_TTL_MS } = options;

  // Check cache unless bypassing
  if (!bypassCache) {
    const cached = queryCache.get(cacheKey) as IncidentQueryCacheEntry<T> | undefined;
    if (isCacheValid(cached)) {
      logger.debug({ cacheKey }, 'Cache hit for incident query');
      return cached!.data;
    }
  }

  // Execute query
  const data = await queryFn();

  // Store in cache
  queryCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });

  logger.debug({ cacheKey, resultCount: data.length }, 'Cache miss - query executed');
  return data;
}

/**
 * Clear the query cache
 *
 * Call this when you need fresh data or after making changes
 */
export function clearQueryCache(): void {
  queryCache.clear();
  logger.debug({}, 'Query cache cleared');
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get a single incident by ID
 *
 * @param id - Incident ID (e.g., "2026-01-22-001")
 * @returns Incident record or null if not found
 *
 * @example
 * ```typescript
 * const incident = await getIncidentById('2026-01-22-001');
 * if (incident) {
 *   console.log(incident.stage, incident.severity);
 * }
 * ```
 */
export async function getIncidentById(id: string): Promise<IncidentRecord | null> {
  const client = getFirestoreClient();
  const result = await client.getDocument<IncidentRecord>(INCIDENTS_COLLECTION, id);

  if (result) {
    logger.debug({ incidentId: id }, 'Incident found');
  } else {
    logger.debug({ incidentId: id }, 'Incident not found');
  }

  return result;
}

/**
 * Get all incidents for a specific date
 *
 * @param date - Pipeline date in YYYY-MM-DD format
 * @param options - Query options (caching, TTL)
 * @returns Array of incident records for that date
 *
 * @example
 * ```typescript
 * const incidents = await getIncidentsByDate('2026-01-22');
 * console.log(`Found ${incidents.length} incidents`);
 * ```
 */
export async function getIncidentsByDate(
  date: string,
  options: IncidentQueryOptions = {}
): Promise<IncidentRecord[]> {
  const cacheKey = `date:${date}`;

  return getCachedOrQuery(
    cacheKey,
    async () => {
      const client = getFirestoreClient();
      return client.queryDocuments<IncidentRecord>(INCIDENTS_COLLECTION, [
        { field: 'date', operator: '==', value: date },
      ]);
    },
    options
  );
}

/**
 * Get all incidents for a specific stage
 *
 * @param stage - Stage name (e.g., "tts", "research")
 * @param options - Query options (caching, TTL)
 * @returns Array of incident records for that stage
 *
 * @example
 * ```typescript
 * const ttsIncidents = await getIncidentsByStage('tts');
 * console.log(`Found ${ttsIncidents.length} TTS incidents`);
 * ```
 */
export async function getIncidentsByStage(
  stage: string,
  options: IncidentQueryOptions = {}
): Promise<IncidentRecord[]> {
  const cacheKey = `stage:${stage}`;

  return getCachedOrQuery(
    cacheKey,
    async () => {
      const client = getFirestoreClient();
      return client.queryDocuments<IncidentRecord>(INCIDENTS_COLLECTION, [
        { field: 'stage', operator: '==', value: stage },
      ]);
    },
    options
  );
}

/**
 * Get all open (unresolved) incidents
 *
 * Open incidents have isOpen: true flag set.
 * Uses Firestore-native filtering for efficient querying.
 *
 * @param options - Query options (caching, TTL)
 * @returns Array of unresolved incident records
 *
 * @example
 * ```typescript
 * const openIncidents = await getOpenIncidents();
 * if (openIncidents.length > 0) {
 *   console.log('Warning: unresolved incidents exist');
 * }
 * ```
 */
export async function getOpenIncidents(
  options: IncidentQueryOptions = {}
): Promise<IncidentRecord[]> {
  const cacheKey = 'open';

  return getCachedOrQuery(
    cacheKey,
    async () => {
      const client = getFirestoreClient();
      // Use isOpen boolean field for efficient Firestore-native filtering
      return client.queryDocuments<IncidentRecord>(INCIDENTS_COLLECTION, [
        { field: 'isOpen', operator: '==', value: true },
      ]);
    },
    options
  );
}
