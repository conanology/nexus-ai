/**
 * Storage factory — returns the appropriate storage client based on environment.
 *
 * When STORAGE_MODE=local OR NEXUS_BUCKET_NAME is not set, returns LocalStorageClient.
 * Otherwise, returns CloudStorageClient (default cloud behavior).
 *
 * @module @nexus-ai/core/storage/storage-factory
 */

import { CloudStorageClient } from './cloud-storage-client.js';
import { LocalStorageClient } from './local-storage-client.js';

/**
 * Common interface shared by both CloudStorageClient and LocalStorageClient.
 */
export interface StorageClient {
  readonly name: string;
  uploadFile(path: string, content: Buffer | string, contentType: string): Promise<string>;
  downloadFile(path: string): Promise<Buffer>;
  uploadStream(path: string, stream: NodeJS.ReadableStream, contentType: string): Promise<string>;
  getSignedUrl(path: string, expirationMinutes?: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  listFiles(prefix: string): Promise<string[]>;
  uploadArtifact(date: string, stage: any, filename: string, content: Buffer | string, contentType: string): Promise<string>;
  downloadArtifact(date: string, stage: any, filename: string): Promise<Buffer>;
  getPublicUrl(path: string): string;
  getGsUri(path: string): string;
}

/**
 * Check if local storage mode is active
 */
export function isLocalStorageMode(): boolean {
  return (
    process.env.STORAGE_MODE === 'local' ||
    !process.env.NEXUS_BUCKET_NAME
  );
}

/** Cached storage client singleton */
let cachedClient: StorageClient | null = null;

/**
 * Get the appropriate storage client based on environment configuration.
 *
 * - STORAGE_MODE=local → LocalStorageClient
 * - NEXUS_BUCKET_NAME not set → LocalStorageClient (auto-detect)
 * - Otherwise → CloudStorageClient
 *
 * Returns a cached singleton to avoid creating multiple instances.
 *
 * @returns StorageClient instance (either Cloud or Local)
 *
 * @example
 * ```typescript
 * const storage = getStorageClient();
 * await storage.uploadFile('path/to/file', content, 'text/plain');
 * ```
 */
export function getStorageClient(): StorageClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (isLocalStorageMode()) {
    const basePath = process.env.LOCAL_STORAGE_PATH || './local-storage';
    cachedClient = new LocalStorageClient(basePath);
  } else {
    cachedClient = new CloudStorageClient(process.env.NEXUS_BUCKET_NAME);
  }

  return cachedClient;
}

/**
 * Reset the cached storage client.
 * Useful for testing or when environment variables change.
 */
export function resetStorageClient(): void {
  cachedClient = null;
}
