/**
 * Local filesystem storage client for NEXUS-AI pipeline
 *
 * Drop-in replacement for CloudStorageClient that stores files locally.
 * Used in local development mode when GCS is unavailable.
 *
 * @module @nexus-ai/core/storage/local-storage-client
 */

import { NexusError } from '../errors/index.js';
import { buildStoragePath, type StorageStage } from './paths.js';
import fs from 'fs/promises';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { Writable } from 'stream';

/**
 * Local filesystem storage client for NEXUS-AI pipeline operations
 *
 * Provides the same API as CloudStorageClient but operates on local filesystem.
 * All paths are resolved relative to a configurable base directory.
 *
 * @example
 * ```typescript
 * const client = new LocalStorageClient('./local-storage');
 * const url = await client.uploadFile('2026-01-08/tts/audio.wav', audioBuffer, 'audio/wav');
 * const buffer = await client.downloadFile('2026-01-08/tts/audio.wav');
 * ```
 */
export class LocalStorageClient {
  /** Client name for logging/debugging */
  readonly name = 'local-storage';

  /** Base directory for local file storage */
  private readonly basePath: string;

  /** HTTP server port for serving files (0 = not started yet) */
  private httpPort: number = 0;

  /**
   * Create a new LocalStorageClient
   *
   * @param basePath - Base directory for storage (defaults to LOCAL_STORAGE_PATH env or ./local-storage)
   */
  constructor(basePath?: string) {
    this.basePath = basePath
      || process.env.LOCAL_STORAGE_PATH
      || './local-storage';

    // Ensure base directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Get the absolute filesystem path for a storage path
   */
  private resolvePath(storagePath: string): string {
    // Strip gs:// prefix if present
    const normalized = this.normalizePath(storagePath);
    return path.resolve(this.basePath, normalized);
  }

  /**
   * Normalize a path, stripping gs://bucket-name/ prefix if present
   */
  private normalizePath(storagePath: string): string {
    if (storagePath.startsWith('gs://')) {
      const withoutProtocol = storagePath.slice(5);
      const slashIndex = withoutProtocol.indexOf('/');
      if (slashIndex > 0) {
        return withoutProtocol.slice(slashIndex + 1);
      }
      return '';
    }
    return storagePath;
  }

  /**
   * Ensure parent directory exists for a file path
   */
  private async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Upload a file to local storage
   *
   * @param storagePath - Storage path (e.g., '2026-01-08/tts/audio.wav')
   * @param content - File content as Buffer or string
   * @param _contentType - MIME type (stored as metadata, not used for local files)
   * @returns local:// URI of the stored file
   */
  async uploadFile(
    storagePath: string,
    content: Buffer | string,
    _contentType: string
  ): Promise<string> {
    try {
      const filePath = this.resolvePath(storagePath);
      await this.ensureDir(filePath);

      const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
      await fs.writeFile(filePath, buffer);

      return `local://${storagePath}`;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'local-storage');
    }
  }

  /**
   * Download a file from local storage
   *
   * @param storagePath - Storage path
   * @returns File content as Buffer
   */
  async downloadFile(storagePath: string): Promise<Buffer> {
    try {
      const filePath = this.resolvePath(storagePath);
      return await fs.readFile(filePath);
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'local-storage');
    }
  }

  /**
   * Upload a stream to local storage
   *
   * @param storagePath - Storage path
   * @param stream - Readable stream
   * @param _contentType - MIME type (not used for local files)
   * @returns local:// URI of the stored file
   */
  async uploadStream(
    storagePath: string,
    stream: NodeJS.ReadableStream,
    _contentType: string
  ): Promise<string> {
    try {
      const filePath = this.resolvePath(storagePath);
      await this.ensureDir(filePath);

      return new Promise((resolve, reject) => {
        const writeStream = createWriteStream(filePath);
        stream
          .pipe(writeStream as unknown as Writable)
          .on('finish', () => resolve(`local://${storagePath}`))
          .on('error', (err) => reject(NexusError.fromError(err, 'local-storage')));
      });
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'local-storage');
    }
  }

  /**
   * Get a URL for file access
   *
   * In local mode, returns a file:// URL pointing to the local file.
   * If an HTTP port is configured, returns http://localhost URL instead.
   *
   * @param storagePath - Storage path
   * @param _expirationMinutes - Ignored in local mode
   * @returns File URL
   */
  async getSignedUrl(storagePath: string, _expirationMinutes: number = 60): Promise<string> {
    const filePath = this.resolvePath(storagePath);
    if (this.httpPort > 0) {
      return `http://localhost:${this.httpPort}/${storagePath}`;
    }
    return `file://${filePath.replace(/\\/g, '/')}`;
  }

  /**
   * Delete a file from local storage
   *
   * @param storagePath - Storage path
   */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      const filePath = this.resolvePath(storagePath);
      await fs.unlink(filePath);
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'local-storage');
    }
  }

  /**
   * Check if a file exists in local storage
   *
   * @param storagePath - Storage path
   * @returns true if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(storagePath);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files with a given prefix
   *
   * @param prefix - Path prefix to filter by
   * @returns Array of relative file paths
   */
  async listFiles(prefix: string): Promise<string[]> {
    try {
      const dirPath = this.resolvePath(prefix);
      const results: string[] = [];

      const walkDir = async (dir: string): Promise<void> => {
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return; // Directory doesn't exist
        }

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else {
            // Convert back to storage path (relative to basePath)
            const relativePath = path.relative(
              path.resolve(this.basePath),
              fullPath
            ).replace(/\\/g, '/');
            results.push(relativePath);
          }
        }
      };

      await walkDir(dirPath);
      return results;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'local-storage');
    }
  }

  /**
   * Build a storage path and upload a file
   */
  async uploadArtifact(
    date: string,
    stage: StorageStage,
    filename: string,
    content: Buffer | string,
    contentType: string
  ): Promise<string> {
    const storagePath = buildStoragePath(date, stage, filename);
    return this.uploadFile(storagePath, content, contentType);
  }

  /**
   * Build a storage path and download a file
   */
  async downloadArtifact(
    date: string,
    stage: StorageStage,
    filename: string
  ): Promise<Buffer> {
    const storagePath = buildStoragePath(date, stage, filename);
    return this.downloadFile(storagePath);
  }

  /**
   * Get the public URL for a file (local file:// path)
   */
  getPublicUrl(storagePath: string): string {
    const filePath = this.resolvePath(storagePath);
    return `file://${filePath.replace(/\\/g, '/')}`;
  }

  /**
   * Get the local:// URI for a file (analogous to gs:// URI)
   */
  getGsUri(storagePath: string): string {
    return `local://${storagePath}`;
  }

  /**
   * Get the absolute path on the filesystem for a storage path.
   * Useful for local mode operations that need direct file access.
   */
  getAbsolutePath(storagePath: string): string {
    return this.resolvePath(storagePath);
  }

  /**
   * Set the HTTP port for URL generation.
   * When set, getSignedUrl() returns http://localhost URLs instead of file:// URLs.
   */
  setHttpPort(port: number): void {
    this.httpPort = port;
  }

  /**
   * Get the base directory path
   */
  getBasePath(): string {
    return path.resolve(this.basePath);
  }
}
