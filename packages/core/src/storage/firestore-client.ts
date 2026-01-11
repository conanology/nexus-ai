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
  set(data: object): Promise<void>;
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
   * Get a document by ID
   *
   * @param collection - Collection name
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
      const doc = await db.collection(collection).doc(docId).get();

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
   * @param collection - Collection name
   * @param docId - Document ID
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
      await db.collection(collection).doc(docId).set(data);
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'firestore');
    }
  }

  /**
   * Update a document (partial update)
   *
   * @param collection - Collection name
   * @param docId - Document ID
   * @param updates - Partial document data to merge
   * @throws NexusError on Firestore errors (including if document doesn't exist)
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
      await db.collection(collection).doc(docId).update(updates as object);
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
   * @param collection - Collection name
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
      await db.collection(collection).doc(docId).delete();
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
   * Path format: "collection/docId/subdoc" -> collection="collection/docId", docId="subdoc"
   */
  private parsePipelinePath(path: string): { collection: string; docId: string } {
    const parts = path.split('/');
    if (parts.length < 3) {
      throw new Error(`Invalid pipeline path format: ${path}`);
    }
    // pipelines/2026-01-08/state -> collection="pipelines/2026-01-08", docId="state"
    return {
      collection: parts.slice(0, -1).join('/'),
      docId: parts[parts.length - 1],
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
