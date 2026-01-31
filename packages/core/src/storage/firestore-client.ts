/**
 * Firestore client for NEXUS-AI pipeline state and metadata storage
 *
 * Provides typed CRUD operations for Firestore with consistent error handling.
 * All operations wrap Firestore SDK errors in NexusError.
 *
 * @module @nexus-ai/core/storage/firestore-client
 */

import { NexusError } from '../errors/index.js';
import {
  getPipelineStatePath,
  getPipelineArtifactsPath,
  getPipelineCostsPath,
  getPipelineQualityPath,
  getPipelineYouTubePath,
} from './paths.js';

/**
 * Firestore query filter definition
 */
export interface FirestoreQueryFilter {
  /** Field name to filter on */
  field: string;
  /** Comparison operator */
  operator: FirestoreWhereFilterOp;
  /** Value to compare against */
  value: unknown;
}

/**
 * Supported Firestore where filter operators
 */
export type FirestoreWhereFilterOp =
  | '<'
  | '<='
  | '=='
  | '!='
  | '>='
  | '>'
  | 'array-contains'
  | 'array-contains-any'
  | 'in'
  | 'not-in';

/**
 * Firestore SDK types (dynamically imported)
 */
interface FirestoreSDK {
  Firestore: new (options: { projectId: string }) => FirestoreInstance;
}

interface FirestoreInstance {
  collection(path: string): CollectionReference;
}

interface CollectionReference {
  doc(docId: string): DocumentReference;
  where(
    field: string,
    operator: FirestoreWhereFilterOp,
    value: unknown
  ): Query;
  get(): Promise<QuerySnapshot>;
}

interface DocumentReference {
  get(): Promise<DocumentSnapshot>;
  set(data: object, options?: { merge?: boolean }): Promise<void>;
  update(data: object): Promise<void>;
  delete(): Promise<void>;
}

interface DocumentSnapshot {
  exists: boolean;
  data(): object | undefined;
  id: string;
}

interface Query {
  where(
    field: string,
    operator: FirestoreWhereFilterOp,
    value: unknown
  ): Query;
  get(): Promise<QuerySnapshot>;
}

interface QuerySnapshot {
  docs: DocumentSnapshot[];
  empty: boolean;
}

// Lazy-initialized Firestore SDK
let firestoreSDK: FirestoreSDK | null = null;

/**
 * Sanitize an object for Firestore by removing undefined values
 * Firestore SDK throws errors when writing objects with undefined fields
 */
function sanitizeForFirestore<T extends object>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeForFirestore(value as object);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}

/**
 * Lazily load the Firestore SDK
 */
async function getFirestoreSDK(): Promise<FirestoreSDK> {
  if (!firestoreSDK) {
    try {
      const module = await import('@google-cloud/firestore');
      firestoreSDK = module as unknown as FirestoreSDK;
    } catch (error) {
      throw NexusError.critical(
        'NEXUS_FIRESTORE_SDK_LOAD_ERROR',
        'Failed to load Firestore SDK. Ensure @google-cloud/firestore is installed.',
        'firestore',
        { originalError: (error as Error).message }
      );
    }
  }
  return firestoreSDK;
}

/**
 * Firestore client for NEXUS-AI pipeline operations
 *
 * Provides typed CRUD operations with consistent error handling.
 * All Firestore SDK errors are wrapped in NexusError.
 *
 * @example
 * ```typescript
 * const client = new FirestoreClient();
 *
 * // Get a document
 * const state = await client.getDocument<PipelineState>('pipelines', '2026-01-08');
 *
 * // Set a document
 * await client.setDocument('pipelines', '2026-01-08', { stage: 'research', status: 'running' });
 *
 * // Query documents
 * const pending = await client.queryDocuments<ReviewItem>('review-queue', [
 *   { field: 'status', operator: '==', value: 'pending' }
 * ]);
 * ```
 */
export class FirestoreClient {
  /** Client name for logging/debugging */
  readonly name = 'firestore';

  /** GCP project ID */
  private readonly projectId: string;

  /** Firestore instance (lazy initialized) */
  private db: FirestoreInstance | null = null;

  /**
   * Create a new FirestoreClient
   *
   * @param projectId - GCP project ID (defaults to NEXUS_PROJECT_ID env var)
   * @throws NexusError if no project ID is available
   */
  constructor(projectId?: string) {
    this.projectId = projectId || process.env.NEXUS_PROJECT_ID || '';

    if (!this.projectId) {
      throw NexusError.critical(
        'NEXUS_FIRESTORE_NO_PROJECT',
        'NEXUS_PROJECT_ID environment variable not set and no projectId provided',
        'firestore'
      );
    }
  }

  /**
   * Initialize Firestore connection (lazy)
   */
  private async getDb(): Promise<FirestoreInstance> {
    if (!this.db) {
      const sdk = await getFirestoreSDK();
      this.db = new sdk.Firestore({ projectId: this.projectId });
    }
    return this.db;
  }

  /**
   * Resolve a collection/docId path to a flat collection and docId
   * Handles paths like 'pipelines/2026-01-08' + 'state' -> 'pipelines' + '2026-01-08_state'
   */
  private resolveDocPath(collection: string, docId: string): { collection: string; docId: string } {
    const fullPath = `${collection}/${docId}`;
    const pathParts = fullPath.split('/');

    // For any path with >2 parts, flatten to collection + underscore-joined docId
    if (pathParts.length > 2) {
      return {
        collection: pathParts[0],
        docId: pathParts.slice(1).join('_'),
      };
    }

    // Simple 2-part path: collection/doc
    return { collection, docId };
  }

  /**
   * Get a document by ID
   *
   * @param collection - Collection name or parent document path (e.g., 'pipelines' or 'pipelines/2026-01-08')
   * @param docId - Document ID
   * @returns Document data or null if not found
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * const state = await client.getDocument<PipelineState>('pipelines/2026-01-08', 'state');
   * if (state) {
   *   console.log(state.stage);
   * }
   * ```
   */
  async getDocument<T>(collection: string, docId: string): Promise<T | null> {
    try {
      const db = await this.getDb();
      const resolved = this.resolveDocPath(collection, docId);
      const doc = await db.collection(resolved.collection).doc(resolved.docId).get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as T;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'firestore');
    }
  }

  /**
   * Set a document (create or overwrite)
   *
   * @param collection - Collection name or parent document path (e.g., 'pipelines' or 'pipelines/2026-01-08')
   * @param docId - Document ID (can include subcollection path like 'state' or 'outputs/research')
   * @param data - Document data
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * await client.setDocument('pipelines/2026-01-08', 'state', {
   *   stage: 'research',
   *   status: 'running',
   *   startTime: new Date().toISOString()
   * });
   * ```
   */
  async setDocument<T extends object>(
    collection: string,
    docId: string,
    data: T
  ): Promise<void> {
    try {
      const db = await this.getDb();
      const resolved = this.resolveDocPath(collection, docId);
      await db.collection(resolved.collection).doc(resolved.docId).set(sanitizeForFirestore(data));
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'firestore');
    }
  }

  /**
   * Update a document (partial update with upsert behavior)
   *
   * Uses Firestore's set with merge option, which:
   * - Creates the document if it doesn't exist
   * - Merges updates into existing document if it does
   *
   * @param collection - Collection name or parent document path
   * @param docId - Document ID
   * @param updates - Partial document data to merge
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * await client.updateDocument('pipelines/2026-01-08', 'state', {
   *   stage: 'tts',
   *   status: 'complete'
   * });
   * ```
   */
  async updateDocument<T>(
    collection: string,
    docId: string,
    updates: Partial<T>
  ): Promise<void> {
    try {
      const db = await this.getDb();
      const resolved = this.resolveDocPath(collection, docId);
      // Use set with merge: true for upsert behavior (create if not exists, merge if exists)
      await db.collection(resolved.collection).doc(resolved.docId).set(sanitizeForFirestore(updates as object), { merge: true });
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'firestore');
    }
  }

  /**
   * Query documents with filters
   *
   * @param collection - Collection name
   * @param filters - Array of query filters
   * @returns Array of matching documents
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * const pending = await client.queryDocuments<ReviewItem>('review-queue', [
   *   { field: 'status', operator: '==', value: 'pending' },
   *   { field: 'type', operator: '==', value: 'pronunciation' }
   * ]);
   * ```
   */
  async queryDocuments<T>(
    collection: string,
    filters: FirestoreQueryFilter[]
  ): Promise<T[]> {
    try {
      const db = await this.getDb();
      let query: Query | CollectionReference = db.collection(collection);

      for (const filter of filters) {
        query = query.where(filter.field, filter.operator, filter.value);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map((doc) => doc.data() as T);
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'firestore');
    }
  }

  /**
   * Delete a document
   *
   * @param collection - Collection name or parent document path
   * @param docId - Document ID
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * await client.deleteDocument('test-collection', 'test-doc');
   * ```
   */
  async deleteDocument(collection: string, docId: string): Promise<void> {
    try {
      const db = await this.getDb();
      const resolved = this.resolveDocPath(collection, docId);
      await db.collection(resolved.collection).doc(resolved.docId).delete();
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'firestore');
    }
  }

  // ============================================================================
  // Pipeline Convenience Methods
  // ============================================================================

  /**
   * Parse a path helper result into collection and docId
   * Path format: "collection/docId/subdoc" -> collection="collection", docId="docId-subdoc"
   * This flattens the subcollection into the document ID for simpler Firestore structure
   */
  private parsePipelinePath(path: string): { collection: string; docId: string } {
    const parts = path.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid pipeline path format: ${path}`);
    }
    // pipelines/2026-01-08/state -> collection="pipelines", docId="2026-01-08_state"
    // pipelines/2026-01-08 -> collection="pipelines", docId="2026-01-08"
    if (parts.length === 2) {
      return {
        collection: parts[0],
        docId: parts[1],
      };
    }
    // For 3+ parts, flatten: pipelines/2026-01-08/state -> pipelines, 2026-01-08_state
    return {
      collection: parts[0],
      docId: parts.slice(1).join('_'),
    };
  }

  /**
   * Get pipeline state document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @returns Pipeline state or null if not found
   *
   * @example
   * ```typescript
   * const state = await client.getPipelineState('2026-01-08');
   * if (state?.status === 'complete') { ... }
   * ```
   */
  async getPipelineState<T>(date: string): Promise<T | null> {
    const { collection, docId } = this.parsePipelinePath(getPipelineStatePath(date));
    return this.getDocument<T>(collection, docId);
  }

  /**
   * Set pipeline state document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param state - State data to set
   *
   * @example
   * ```typescript
   * await client.setPipelineState('2026-01-08', { stage: 'research', status: 'running' });
   * ```
   */
  async setPipelineState<T extends object>(date: string, state: T): Promise<void> {
    const { collection, docId } = this.parsePipelinePath(getPipelineStatePath(date));
    return this.setDocument(collection, docId, state);
  }

  /**
   * Update pipeline state document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param updates - Partial state updates
   *
   * @example
   * ```typescript
   * await client.updatePipelineState('2026-01-08', { status: 'complete' });
   * ```
   */
  async updatePipelineState<T>(date: string, updates: Partial<T>): Promise<void> {
    const { collection, docId } = this.parsePipelinePath(getPipelineStatePath(date));
    return this.updateDocument(collection, docId, updates);
  }

  /**
   * Get pipeline artifacts document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @returns Pipeline artifacts or null if not found
   */
  async getPipelineArtifacts<T>(date: string): Promise<T | null> {
    const { collection, docId } = this.parsePipelinePath(getPipelineArtifactsPath(date));
    return this.getDocument<T>(collection, docId);
  }

  /**
   * Set pipeline artifacts document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param artifacts - Artifacts data to set
   */
  async setPipelineArtifacts<T extends object>(date: string, artifacts: T): Promise<void> {
    const { collection, docId } = this.parsePipelinePath(getPipelineArtifactsPath(date));
    return this.setDocument(collection, docId, artifacts);
  }

  /**
   * Get pipeline costs document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @returns Pipeline costs or null if not found
   */
  async getPipelineCosts<T>(date: string): Promise<T | null> {
    const { collection, docId } = this.parsePipelinePath(getPipelineCostsPath(date));
    return this.getDocument<T>(collection, docId);
  }

  /**
   * Set pipeline costs document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param costs - Costs data to set
   */
  async setPipelineCosts<T extends object>(date: string, costs: T): Promise<void> {
    const { collection, docId } = this.parsePipelinePath(getPipelineCostsPath(date));
    return this.setDocument(collection, docId, costs);
  }

  /**
   * Get pipeline quality document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @returns Pipeline quality metrics or null if not found
   */
  async getPipelineQuality<T>(date: string): Promise<T | null> {
    const { collection, docId } = this.parsePipelinePath(getPipelineQualityPath(date));
    return this.getDocument<T>(collection, docId);
  }

  /**
   * Set pipeline quality document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param quality - Quality metrics to set
   */
  async setPipelineQuality<T extends object>(date: string, quality: T): Promise<void> {
    const { collection, docId } = this.parsePipelinePath(getPipelineQualityPath(date));
    return this.setDocument(collection, docId, quality);
  }

  /**
   * Get pipeline YouTube document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @returns Pipeline YouTube data or null if not found
   */
  async getPipelineYouTube<T>(date: string): Promise<T | null> {
    const { collection, docId } = this.parsePipelinePath(getPipelineYouTubePath(date));
    return this.getDocument<T>(collection, docId);
  }

  /**
   * Set pipeline YouTube document
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param youtube - YouTube data to set
   */
  async setPipelineYouTube<T extends object>(date: string, youtube: T): Promise<void> {
    const { collection, docId } = this.parsePipelinePath(getPipelineYouTubePath(date));
    return this.setDocument(collection, docId, youtube);
  }
}
