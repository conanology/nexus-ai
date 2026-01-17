/**
 * Cloud Storage client for NEXUS-AI pipeline artifact storage
 *
 * Provides file operations for GCS with consistent error handling.
 * All operations wrap GCS SDK errors in NexusError.
 *
 * @module @nexus-ai/core/storage/cloud-storage-client
 */

import { NexusError } from '../errors/index.js';
import { buildStoragePath, type StorageStage } from './paths.js';

/**
 * GCS SDK types (dynamically imported)
 */
interface StorageSDK {
  Storage: new () => StorageInstance;
}

interface StorageInstance {
  bucket(name: string): Bucket;
}

interface Bucket {
  file(name: string): GCSFile;
  getFiles(options?: { prefix?: string }): Promise<[GCSFile[]]>;
}

interface GCSFile {
  name: string;
  save(data: Buffer | string, options?: { contentType?: string }): Promise<void>;
  download(): Promise<[Buffer]>;
  delete(): Promise<void>;
  exists(): Promise<[boolean]>;
  getSignedUrl(options: SignedUrlOptions): Promise<[string]>;
  createWriteStream(options?: { contentType?: string; resumable?: boolean }): NodeJS.WritableStream;
}

interface SignedUrlOptions {
  version: 'v4';
  action: 'read' | 'write';
  expires: number;
}

// Lazy-initialized Storage SDK
let storageSDK: StorageSDK | null = null;

/**
 * Lazily load the Cloud Storage SDK
 */
async function getStorageSDK(): Promise<StorageSDK> {
  if (!storageSDK) {
    try {
      const module = await import('@google-cloud/storage');
      storageSDK = module as unknown as StorageSDK;
    } catch (error) {
      throw NexusError.critical(
        'NEXUS_GCS_SDK_LOAD_ERROR',
        'Failed to load Cloud Storage SDK. Ensure @google-cloud/storage is installed.',
        'cloud-storage',
        { originalError: (error as Error).message }
      );
    }
  }
  return storageSDK;
}

/**
 * Cloud Storage client for NEXUS-AI pipeline operations
 *
 * Provides file upload, download, and management operations.
 * All GCS SDK errors are wrapped in NexusError.
 *
 * @example
 * ```typescript
 * const client = new CloudStorageClient();
 *
 * // Upload a file
 * const url = await client.uploadFile('2026-01-08/research/research.md', content, 'text/markdown');
 *
 * // Download a file
 * const buffer = await client.downloadFile('2026-01-08/tts/audio.wav');
 *
 * // Get a signed URL for temporary access
 * const signedUrl = await client.getSignedUrl('2026-01-08/render/video.mp4', 120);
 * ```
 */
export class CloudStorageClient {
  /** Client name for logging/debugging */
  readonly name = 'cloud-storage';

  /** GCS bucket name */
  private readonly bucketName: string;

  /** Storage instance (lazy initialized) */
  private storage: StorageInstance | null = null;

  /**
   * Create a new CloudStorageClient
   *
   * @param bucketName - GCS bucket name (defaults to NEXUS_BUCKET_NAME env var)
   * @throws NexusError if no bucket name is available
   */
  constructor(bucketName?: string) {
    this.bucketName = bucketName || process.env.NEXUS_BUCKET_NAME || '';

    if (!this.bucketName) {
      throw NexusError.critical(
        'NEXUS_GCS_NO_BUCKET',
        'NEXUS_BUCKET_NAME environment variable not set and no bucketName provided',
        'cloud-storage'
      );
    }
  }

  /**
   * Initialize Storage connection (lazy)
   */
  private async getStorage(): Promise<StorageInstance> {
    if (!this.storage) {
      const sdk = await getStorageSDK();
      this.storage = new sdk.Storage();
    }
    return this.storage;
  }

  /**
   * Get a bucket reference
   */
  private async getBucket(): Promise<Bucket> {
    const storage = await this.getStorage();
    return storage.bucket(this.bucketName);
  }

  /**
   * Upload a file to Cloud Storage
   *
   * @param path - Storage path (e.g., '2026-01-08/research/research.md')
   * @param content - File content as Buffer or string
   * @param contentType - MIME type (e.g., 'text/markdown', 'audio/wav')
   * @returns gs:// URL of uploaded file
   * @throws NexusError on GCS errors
   *
   * @example
   * ```typescript
   * const url = await client.uploadFile(
   *   '2026-01-08/research/research.md',
   *   researchContent,
   *   'text/markdown'
   * );
   * // Returns: gs://nexus-ai-artifacts/2026-01-08/research/research.md
   * ```
   */
  async uploadFile(
    path: string,
    content: Buffer | string,
    contentType: string
  ): Promise<string> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);

      const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
      await file.save(buffer, { contentType });

      return `gs://${this.bucketName}/${path}`;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cloud-storage');
    }
  }

  /**
   * Download a file from Cloud Storage
   *
   * @param path - Storage path
   * @returns File content as Buffer
   * @throws NexusError on GCS errors (including file not found)
   *
   * @example
   * ```typescript
   * const audioBuffer = await client.downloadFile('2026-01-08/tts/audio.wav');
   * ```
   */
  async downloadFile(path: string): Promise<Buffer> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);
      const [content] = await file.download();
      return content;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cloud-storage');
    }
  }

  /**
   * Upload a stream to Cloud Storage
   *
   * @param path - Storage path
   * @param stream - Readable stream
   * @param contentType - MIME type
   * @returns gs:// URL of uploaded file
   */
  async uploadStream(
    path: string,
    stream: NodeJS.ReadableStream,
    contentType: string
  ): Promise<string> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);
      const writeStream = file.createWriteStream({
        contentType,
        resumable: false,
      });

      return new Promise((resolve, reject) => {
        stream
          .pipe(writeStream)
          .on('finish', () => resolve(`gs://${this.bucketName}/${path}`))
          .on('error', (err) => reject(NexusError.fromError(err, 'cloud-storage')));
      });
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cloud-storage');
    }
  }

  /**
   * Get a signed URL for temporary file access
   *
   * @param path - Storage path
   * @param expirationMinutes - URL expiration time in minutes (default: 60)
   * @returns Signed URL with temporary access
   * @throws NexusError on GCS errors
   *
   * @example
   * ```typescript
   * // Get a 2-hour signed URL for the render service
   * const url = await client.getSignedUrl('2026-01-08/tts/audio.wav', 120);
   * ```
   */
  async getSignedUrl(path: string, expirationMinutes: number = 60): Promise<string> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expirationMinutes * 60 * 1000,
      });

      return url;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cloud-storage');
    }
  }

  /**
   * Delete a file from Cloud Storage
   *
   * @param path - Storage path
   * @throws NexusError on GCS errors
   *
   * @example
   * ```typescript
   * await client.deleteFile('test/integration-test.txt');
   * ```
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);
      await file.delete();
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cloud-storage');
    }
  }

  /**
   * Check if a file exists in Cloud Storage
   *
   * @param path - Storage path
   * @returns true if file exists
   * @throws NexusError on GCS errors
   *
   * @example
   * ```typescript
   * if (await client.fileExists('2026-01-08/render/video.mp4')) {
   *   console.log('Video is ready');
   * }
   * ```
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cloud-storage');
    }
  }

  /**
   * List files with a given prefix
   *
   * @param prefix - Path prefix to filter by
   * @returns Array of file paths
   * @throws NexusError on GCS errors
   *
   * @example
   * ```typescript
   * // List all files for a specific date
   * const files = await client.listFiles('2026-01-08/');
   * // Returns: ['2026-01-08/research/research.md', '2026-01-08/tts/audio.wav', ...]
   * ```
   */
  async listFiles(prefix: string): Promise<string[]> {
    try {
      const bucket = await this.getBucket();
      const [files] = await bucket.getFiles({ prefix });
      return files.map((file) => file.name);
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cloud-storage');
    }
  }

  /**
   * Build a storage path and upload a file
   *
   * Convenience method that combines path building with upload.
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param stage - Pipeline stage
   * @param filename - File name
   * @param content - File content
   * @param contentType - MIME type
   * @returns gs:// URL of uploaded file
   *
   * @example
   * ```typescript
   * const url = await client.uploadArtifact(
   *   '2026-01-08',
   *   'research',
   *   'research.md',
   *   researchContent,
   *   'text/markdown'
   * );
   * ```
   */
  async uploadArtifact(
    date: string,
    stage: StorageStage,
    filename: string,
    content: Buffer | string,
    contentType: string
  ): Promise<string> {
    const path = buildStoragePath(date, stage, filename);
    return this.uploadFile(path, content, contentType);
  }

  /**
   * Build a storage path and download a file
   *
   * Convenience method that combines path building with download.
   *
   * @param date - Pipeline date (YYYY-MM-DD)
   * @param stage - Pipeline stage
   * @param filename - File name
   * @returns File content as Buffer
   *
   * @example
   * ```typescript
   * const audio = await client.downloadArtifact('2026-01-08', 'tts', 'audio.wav');
   * ```
   */
  async downloadArtifact(
    date: string,
    stage: StorageStage,
    filename: string
  ): Promise<Buffer> {
    const path = buildStoragePath(date, stage, filename);
    return this.downloadFile(path);
  }

  /**
   * Get the public HTTPS URL for a file
   *
   * Returns a publicly accessible URL (requires bucket to have public access configured).
   * For private buckets, use getSignedUrl() instead.
   *
   * @param path - Storage path
   * @returns Public HTTPS URL
   *
   * @example
   * ```typescript
   * const publicUrl = client.getPublicUrl('2026-01-08/thumbnails/1.png');
   * // Returns: https://storage.googleapis.com/bucket-name/2026-01-08/thumbnails/1.png
   * ```
   */
  getPublicUrl(path: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${path}`;
  }

  /**
   * Get the gs:// URI for a file
   *
   * Returns the internal GCS URI format used by Google Cloud services.
   *
   * @param path - Storage path
   * @returns GCS URI (gs://bucket/path)
   *
   * @example
   * ```typescript
   * const gsUri = client.getGsUri('2026-01-08/render/video.mp4');
   * // Returns: gs://bucket-name/2026-01-08/render/video.mp4
   * ```
   */
  getGsUri(path: string): string {
    return `gs://${this.bucketName}/${path}`;
  }
}
