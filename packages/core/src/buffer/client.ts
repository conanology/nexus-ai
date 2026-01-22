/**
 * Shared Firestore client for buffer module
 *
 * Provides a singleton Firestore client instance to avoid creating
 * multiple connections across buffer submodules.
 *
 * @module @nexus-ai/core/buffer/client
 */

import { FirestoreClient } from '../storage/firestore-client.js';

let sharedClient: FirestoreClient | null = null;

/**
 * Get the shared Firestore client instance
 * Creates the client lazily on first access
 */
export function getSharedFirestoreClient(): FirestoreClient {
  if (!sharedClient) {
    sharedClient = new FirestoreClient();
  }
  return sharedClient;
}

/**
 * Reset the shared client (for testing purposes)
 */
export function resetSharedClient(): void {
  sharedClient = null;
}
