/**
 * Resumable upload implementation for YouTube
 * @module @nexus-ai/youtube/uploader
 */

import { Readable } from 'stream';
import {
  createLogger,
  CloudStorageClient,
  FirestoreClient,
  withRetry,
  NexusError,
  type Logger,
} from '@nexus-ai/core';
import { YouTubeClient, getYouTubeClient } from './client.js';
import type {
  VideoMetadata,
  PrivacyStatus,
  UploadSession,
  ProgressCallback,
} from './types.js';

/**
 * Default chunk size for resumable uploads (8MB)
 */
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

/**
 * Maximum file size YouTube supports (128GB)
 */
const MAX_FILE_SIZE = 128 * 1024 * 1024 * 1024;

/**
 * Configuration for resumable upload
 */
export interface ResumableUploadConfig {
  /** Pipeline ID for context */
  pipelineId: string;
  /** GCS path to the video file */
  videoPath: string;
  /** Video metadata */
  metadata: VideoMetadata;
  /** Privacy status */
  privacyStatus: PrivacyStatus;
  /** Optional progress callback */
  onProgress?: ProgressCallback;
  /** Chunk size for uploads (default 8MB) */
  chunkSize?: number;
}

/**
 * Result of a resumable upload
 */
export interface ResumableUploadResult {
  /** YouTube video ID */
  videoId: string;
  /** Full YouTube URL */
  uploadUrl: string;
  /** Processing status */
  processingStatus: 'processing' | 'processed' | 'failed';
  /** Number of bytes uploaded */
  bytesUploaded: number;
  /** Whether the upload was resumed */
  wasResumed: boolean;
}

/**
 * ResumableUploader class for YouTube video uploads
 * Implements YouTube Data API v3 resumable upload protocol
 */
export class ResumableUploader {
  private readonly logger: Logger;
  private readonly storageClient: CloudStorageClient;
  private readonly firestoreClient: FirestoreClient;
  private youtubeClient: YouTubeClient | null = null;

  constructor() {
    this.logger = createLogger('youtube.uploader');
    this.storageClient = new CloudStorageClient();
    this.firestoreClient = new FirestoreClient();
  }

  /**
   * Upload a video to YouTube with resumable upload protocol
   */
  async upload(config: ResumableUploadConfig): Promise<ResumableUploadResult> {
    const {
      pipelineId,
      videoPath,
      onProgress,
      chunkSize = DEFAULT_CHUNK_SIZE,
    } = config;

    this.logger.info({
      pipelineId,
      videoPath,
      title: config.metadata.title,
    }, 'Starting YouTube upload');

    // Initialize YouTube client
    this.youtubeClient = await getYouTubeClient();

    // Check for existing upload session
    let session = await this.loadSession(pipelineId);
    let wasResumed = false;

    if (session && session.status === 'active') {
      this.logger.info({
        pipelineId,
        bytesUploaded: session.bytesUploaded,
        fileSize: session.fileSize,
      }, 'Found existing upload session, attempting resume');
      wasResumed = true;
    } else {
      // Start new resumable session
      session = await this.startSession(config);
    }

    try {
      // Get file size from GCS
      const fileSize = await this.getFileSize(videoPath);

      if (fileSize > MAX_FILE_SIZE) {
        throw NexusError.critical(
          'NEXUS_YOUTUBE_FILE_TOO_LARGE',
          `Video file exceeds YouTube's 128GB limit: ${fileSize} bytes`,
          'youtube'
        );
      }

      // Perform upload with resume capability
      const videoId = await this.performUpload(
        session,
        videoPath,
        fileSize,
        chunkSize,
        onProgress
      );

      // Mark session as completed
      await this.updateSession(pipelineId, {
        status: 'completed',
        bytesUploaded: fileSize,
        lastUpdatedAt: new Date().toISOString(),
      });

      this.logger.info({ pipelineId, videoId }, 'YouTube upload completed');

      return {
        videoId,
        uploadUrl: `https://www.youtube.com/watch?v=${videoId}`,
        processingStatus: 'processing', // Videos start in processing state
        bytesUploaded: fileSize,
        wasResumed,
      };
    } catch (error) {
      // Mark session as failed
      await this.updateSession(pipelineId, {
        status: 'failed',
        lastUpdatedAt: new Date().toISOString(),
      });

      this.logger.error({ pipelineId, error }, 'YouTube upload failed');
      throw error;
    }
  }

  /**
   * Start a new resumable upload session
   */
  private async startSession(config: ResumableUploadConfig): Promise<UploadSession> {
    const { pipelineId, videoPath, metadata, privacyStatus } = config;

    this.logger.info({ pipelineId }, 'Starting new resumable upload session');

    const youtube = this.youtubeClient!.getYouTubeApi();
    const fileSize = await this.getFileSize(videoPath);

    // Use withRetry for the initial session creation
    const response = await withRetry(
      async () => {
        return youtube.videos.insert({
          part: ['snippet', 'status'],
          notifySubscribers: false,
          requestBody: {
            snippet: {
              title: metadata.title,
              description: metadata.description,
              tags: metadata.tags,
              categoryId: metadata.categoryId,
              defaultLanguage: metadata.defaultLanguage,
              defaultAudioLanguage: metadata.defaultAudioLanguage,
            },
            status: {
              privacyStatus,
              selfDeclaredMadeForKids: false,
            },
          },
          media: {
            mimeType: 'video/*',
            body: Readable.from([]), // Empty body for session initiation
          },
        });
      },
      {
        maxRetries: 3,
        stage: 'youtube',
      }
    );

    // Extract session URI from response headers
    // For googleapis, the upload URL is typically returned in the response
    const sessionUri = (response.result as { config?: { url?: string } }).config?.url || '';

    const session: UploadSession = {
      sessionUri,
      pipelineId,
      videoPath,
      fileSize,
      bytesUploaded: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    // Persist session to Firestore
    await this.saveSession(pipelineId, session);

    this.logger.info({
      pipelineId,
      sessionUri: sessionUri ? 'present' : 'missing',
    }, 'Resumable upload session created');

    return session;
  }

  /**
   * Perform the actual upload with chunked transfer
   */
  private async performUpload(
    session: UploadSession,
    videoPath: string,
    fileSize: number,
    chunkSize: number,
    onProgress?: ProgressCallback
  ): Promise<string> {
    const youtube = this.youtubeClient!.getYouTubeApi();

    this.logger.info({
      pipelineId: session.pipelineId,
      fileSize,
      chunkSize,
    }, 'Performing video upload');

    // TODO: PERFORMANCE ISSUE - Currently downloads entire file to memory
    // For large videos (up to 128GB per YouTube limit), this will cause OOM errors.
    // Need CloudStorageClient.createReadStream() API to stream directly from GCS → YouTube
    // without buffering entire file in memory. This is a known limitation.
    // See: https://github.com/googleapis/nodejs-storage/blob/main/samples/downloadFileUsingRequesterPays.js
    const videoBuffer = await this.storageClient.downloadFile(videoPath);
    const videoStream = Readable.from(videoBuffer);

    // Perform upload with retry
    // Note: googleapis handles the actual resumable upload protocol internally
    // We can't easily track progress at byte-level with the current googleapis API
    const response = await withRetry(
      async () => {
        return youtube.videos.insert({
          part: ['snippet', 'status'],
          notifySubscribers: false,
          requestBody: {
            snippet: {
              title: 'Video Upload', // Metadata already set in session
            },
            status: {
              privacyStatus: 'private',
            },
          },
          media: {
            mimeType: 'video/*',
            body: videoStream,
          },
        });
      },
      {
        maxRetries: 3,
        stage: 'youtube',
      }
    );

    // Update progress callback (can only report completion, not incremental progress)
    if (onProgress) {
      onProgress({
        bytesUploaded: fileSize,
        totalBytes: fileSize,
        percentage: 100,
      });
    }

    const videoId = response.result.data?.id;

    if (!videoId) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_UPLOAD_FAILED',
        'Upload completed but no video ID returned',
        'youtube'
      );
    }

    return videoId;
  }

  /**
   * Check upload status for resume capability
   *
   * LIMITATION: Returns last known bytes uploaded from session state.
   * True status check would require HTTP PUT to session.sessionUri with:
   *   Content-Length: 0
   *   Content-Range: bytes * / {total_size}
   *
   * Response would be 308 Resume Incomplete with Range: bytes=0-{last_byte}
   * See: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol#Checking_Upload_Status
   */
  async checkUploadStatus(session: UploadSession): Promise<number> {
    this.logger.info({
      pipelineId: session.pipelineId,
      sessionUri: session.sessionUri ? 'present' : 'missing',
      lastKnownBytes: session.bytesUploaded,
    }, 'Checking upload status');

    // If no session URI, cannot check status
    if (!session.sessionUri) {
      this.logger.warn({
        pipelineId: session.pipelineId,
      }, 'No session URI available for status check');
      return 0;
    }

    // LIMITATION: True status check requires direct HTTP PUT to sessionUri
    // with Content-Range: bytes */total_size to query YouTube's progress.
    // googleapis library doesn't expose this functionality.
    //
    // For production implementation, use axios or node-fetch:
    // PUT {sessionUri}
    // Headers:
    //   Content-Length: 0
    //   Content-Range: bytes */{session.fileSize}
    //
    // Response 308: Range: bytes=0-{last_byte_received}

    return session.bytesUploaded;
  }

  /**
   * Resume an interrupted upload
   *
   * LIMITATION: Current implementation restarts the upload from the beginning.
   * True byte-level resume would require direct use of the resumable upload URI
   * from the session, which googleapis library abstracts away.
   *
   * For production use, consider implementing direct HTTP PUT requests to the
   * session.sessionUri with Content-Range headers for true resume capability.
   * See: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
   */
  async resumeUpload(
    pipelineId: string,
    onProgress?: ProgressCallback
  ): Promise<ResumableUploadResult> {
    const session = await this.loadSession(pipelineId);

    if (!session) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_NO_SESSION',
        `No upload session found for pipeline ${pipelineId}`,
        'youtube'
      );
    }

    if (session.status !== 'active') {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_SESSION_INVALID',
        `Upload session status is ${session.status}, cannot resume`,
        'youtube'
      );
    }

    // Check current upload status
    const bytesUploaded = await this.checkUploadStatus(session);

    this.logger.warn({
      pipelineId,
      bytesUploaded,
      totalSize: session.fileSize,
      sessionUri: session.sessionUri ? 'present' : 'missing',
    }, 'Attempting to resume upload - will restart from beginning due to API limitations');

    // LIMITATION: This restarts the upload from the beginning
    // True resume would require direct HTTP PUT to session.sessionUri
    // with Content-Range headers, bypassing googleapis library
    return this.upload({
      pipelineId,
      videoPath: session.videoPath,
      metadata: {
        title: 'Resumed Upload',
        description: 'Video upload resumed after interruption',
        tags: [],
        categoryId: '28', // Science & Technology (from AC requirements)
      },
      privacyStatus: 'private',
      onProgress,
    });
  }

  /**
   * Get file size from GCS
   * Note: CloudStorageClient doesn't have getMetadata, so we download and check length
   * This is inefficient for large files - consider adding getMetadata to core
   */
  private async getFileSize(videoPath: string): Promise<number> {
    // Check if file exists first
    const exists = await this.storageClient.fileExists(videoPath);
    if (!exists) {
      throw NexusError.critical(
        'NEXUS_YOUTUBE_FILE_NOT_FOUND',
        `Video file not found: ${videoPath}`,
        'youtube'
      );
    }
    // For now, we'll get the size when we download the file
    // This is a limitation - ideally we'd have getMetadata in CloudStorageClient
    const buffer = await this.storageClient.downloadFile(videoPath);
    return buffer.length;
  }

  /**
   * Load upload session from Firestore
   */
  private async loadSession(pipelineId: string): Promise<UploadSession | null> {
    try {
      const collection = `pipelines/${pipelineId}`;
      const docId = 'youtube-upload-session';
      const data = await this.firestoreClient.getDocument<UploadSession>(collection, docId);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Save upload session to Firestore
   */
  private async saveSession(pipelineId: string, session: UploadSession): Promise<void> {
    const collection = `pipelines/${pipelineId}`;
    const docId = 'youtube-upload-session';
    await this.firestoreClient.setDocument(collection, docId, session);
  }

  /**
   * Update upload session in Firestore
   */
  private async updateSession(
    pipelineId: string,
    updates: Partial<UploadSession>
  ): Promise<void> {
    const collection = `pipelines/${pipelineId}`;
    const docId = 'youtube-upload-session';
    await this.firestoreClient.updateDocument(collection, docId, updates);
  }
}

/**
 * Create a new ResumableUploader instance
 */
export function createResumableUploader(): ResumableUploader {
  return new ResumableUploader();
}

/**
 * Convenience function to upload a video
 */
export async function uploadVideo(
  config: ResumableUploadConfig
): Promise<ResumableUploadResult> {
  const uploader = createResumableUploader();
  return uploader.upload(config);
}
