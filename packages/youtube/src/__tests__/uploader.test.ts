import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VideoMetadata } from '../types.js';

// Hoist all mocks using vi.hoisted
const {
  mockFirestoreGet,
  mockFirestoreSet,
  mockFirestoreUpdate,
  mockStorageDownload,
  mockStorageGetMetadata,
  mockYouTubeInsert,
  mockGetSecret,
} = vi.hoisted(() => {
  const mockFirestoreGet = vi.fn();
  const mockFirestoreSet = vi.fn();
  const mockFirestoreUpdate = vi.fn();
  const mockStorageDownload = vi.fn();
  const mockStorageGetMetadata = vi.fn();
  const mockYouTubeInsert = vi.fn();
  const mockGetSecret = vi.fn();

  return {
    mockFirestoreGet,
    mockFirestoreSet,
    mockFirestoreUpdate,
    mockStorageDownload,
    mockStorageGetMetadata,
    mockYouTubeInsert,
    mockGetSecret,
  };
});

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  FirestoreClient: vi.fn().mockImplementation(() => ({
    getDocument: mockFirestoreGet,
    setDocument: mockFirestoreSet,
    updateDocument: mockFirestoreUpdate,
  })),
  CloudStorageClient: vi.fn().mockImplementation(() => ({
    download: mockStorageDownload,
    downloadFile: mockStorageDownload,
    getMetadata: mockStorageGetMetadata,
    fileExists: vi.fn().mockResolvedValue(true),
  })),
  withRetry: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
    const result = await fn();
    return { result, attempts: 1, totalDelayMs: 0 };
  }),
  getSecret: mockGetSecret,
  NexusError: {
    critical: (code: string, message: string, stage: string) => {
      const error = new Error(`${code}: ${message} [${stage}]`);
      (error as Error & { code: string }).code = code;
      return error;
    },
  },
}));

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        on: vi.fn(),
        getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
        refreshAccessToken: vi.fn().mockResolvedValue({ credentials: {} }),
      })),
    },
    youtube: vi.fn().mockReturnValue({
      videos: {
        insert: mockYouTubeInsert,
      },
    }),
  },
}));

// Mock client module
vi.mock('../client.js', () => ({
  getYouTubeClient: vi.fn().mockResolvedValue({
    getYouTubeApi: () => ({
      videos: {
        insert: mockYouTubeInsert,
      },
    }),
    getOAuth2Client: vi.fn().mockReturnValue({}),
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
  }),
  YouTubeClient: vi.fn(),
}));

import { ResumableUploader, createResumableUploader } from '../uploader.js';

describe('ResumableUploader', () => {
  const testMetadata: VideoMetadata = {
    title: 'Test Video',
    description: 'Test description',
    tags: ['test', 'video'],
    categoryId: '28',
  };

  const testConfig = {
    pipelineId: '2026-01-18',
    videoPath: 'gs://nexus-ai-artifacts/2026-01-18/render/video.mp4',
    metadata: testMetadata,
    privacyStatus: 'private' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock responses
    mockFirestoreGet.mockResolvedValue(null); // No existing session
    mockFirestoreSet.mockResolvedValue(undefined);
    mockFirestoreUpdate.mockResolvedValue(undefined);
    mockStorageDownload.mockResolvedValue(Buffer.alloc(1024 * 1024)); // 1MB
    mockStorageGetMetadata.mockResolvedValue({ size: 1024 * 1024 }); // 1MB (unused but kept for reference)
    mockGetSecret.mockResolvedValue(JSON.stringify({
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      refresh_token: 'test-refresh-token',
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expiry_date: Date.now() + 3600000,
    }));
    mockYouTubeInsert.mockResolvedValue({
      data: { id: 'test-video-id' },
      config: { url: 'https://upload.youtube.com/resumable/123' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a ResumableUploader instance', () => {
      const uploader = new ResumableUploader();
      expect(uploader).toBeInstanceOf(ResumableUploader);
    });
  });

  describe('upload', () => {
    it('should successfully upload a video', async () => {
      const uploader = new ResumableUploader();
      const result = await uploader.upload(testConfig);

      expect(result).toEqual({
        videoId: 'test-video-id',
        uploadUrl: 'https://www.youtube.com/watch?v=test-video-id',
        processingStatus: 'processing',
        bytesUploaded: 1024 * 1024,
        wasResumed: false,
      });
    });

    it('should persist upload session to Firestore', async () => {
      const uploader = new ResumableUploader();
      await uploader.upload(testConfig);

      expect(mockFirestoreSet).toHaveBeenCalledWith(
        'pipelines/2026-01-18',
        'youtube-upload-session',
        expect.objectContaining({
          pipelineId: '2026-01-18',
          videoPath: testConfig.videoPath,
          status: 'active',
        })
      );
    });

    it('should update session status to completed on success', async () => {
      const uploader = new ResumableUploader();
      await uploader.upload(testConfig);

      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        'pipelines/2026-01-18',
        'youtube-upload-session',
        expect.objectContaining({
          status: 'completed',
        })
      );
    });

    it('should resume existing active session', async () => {
      const existingSession = {
        sessionUri: 'https://upload.youtube.com/resumable/existing',
        pipelineId: '2026-01-18',
        videoPath: testConfig.videoPath,
        fileSize: 1024 * 1024,
        bytesUploaded: 512 * 1024,
        status: 'active',
        createdAt: '2026-01-18T00:00:00Z',
        lastUpdatedAt: '2026-01-18T00:00:00Z',
      };

      mockFirestoreGet.mockResolvedValue(existingSession);

      const uploader = new ResumableUploader();
      const result = await uploader.upload(testConfig);

      expect(result.wasResumed).toBe(true);
    });

    it('should call progress callback', async () => {
      const onProgress = vi.fn();
      const uploader = new ResumableUploader();

      await uploader.upload({
        ...testConfig,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith({
        bytesUploaded: 1024 * 1024,
        totalBytes: 1024 * 1024,
        percentage: 100,
      });
    });

    it('should throw error if video exceeds 128GB', async () => {
      // getFileSize uses downloadFile + buffer.length, so we mock downloadFile
      // to return an object with a large .length (can't allocate 129GB buffer)
      mockStorageDownload.mockResolvedValue({ length: 129 * 1024 * 1024 * 1024 });

      const uploader = new ResumableUploader();

      await expect(uploader.upload(testConfig)).rejects.toThrow(
        'NEXUS_YOUTUBE_FILE_TOO_LARGE'
      );
    });

    it('should mark session as failed on error', async () => {
      // Error happens after session is created, during actual upload
      mockFirestoreGet.mockResolvedValue(null); // No existing session
      
      // First call succeeds (session creation), second call fails (upload)
      mockYouTubeInsert
        .mockResolvedValueOnce({
          data: {},
          config: { url: 'https://upload.youtube.com/resumable/123' },
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      const uploader = new ResumableUploader();

      await expect(uploader.upload(testConfig)).rejects.toThrow('Upload failed');

      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        'pipelines/2026-01-18',
        'youtube-upload-session',
        expect.objectContaining({
          status: 'failed',
        })
      );
    });
  });

  describe('resumeUpload', () => {
    it('should throw error if no session exists', async () => {
      mockFirestoreGet.mockResolvedValue(null);

      const uploader = new ResumableUploader();

      await expect(uploader.resumeUpload('2026-01-18')).rejects.toThrow(
        'NEXUS_YOUTUBE_NO_SESSION'
      );
    });

    it('should throw error if session is not active', async () => {
      mockFirestoreGet.mockResolvedValue({
        status: 'completed',
        pipelineId: '2026-01-18',
      });

      const uploader = new ResumableUploader();

      await expect(uploader.resumeUpload('2026-01-18')).rejects.toThrow(
        'NEXUS_YOUTUBE_SESSION_INVALID'
      );
    });
  });

  describe('checkUploadStatus', () => {
    it('should return last known bytes uploaded', async () => {
      const uploader = new ResumableUploader();
      const session = {
        sessionUri: 'https://upload.youtube.com/resumable/123',
        pipelineId: '2026-01-18',
        videoPath: testConfig.videoPath,
        fileSize: 1024 * 1024,
        bytesUploaded: 512 * 1024,
        status: 'active' as const,
        createdAt: '2026-01-18T00:00:00Z',
        lastUpdatedAt: '2026-01-18T00:00:00Z',
      };

      const bytesUploaded = await uploader.checkUploadStatus(session);
      expect(bytesUploaded).toBe(512 * 1024);
    });

    it('should return 0 if no session URI', async () => {
      const uploader = new ResumableUploader();
      const session = {
        sessionUri: '',
        pipelineId: '2026-01-18',
        videoPath: testConfig.videoPath,
        fileSize: 1024 * 1024,
        bytesUploaded: 0,
        status: 'active' as const,
        createdAt: '2026-01-18T00:00:00Z',
        lastUpdatedAt: '2026-01-18T00:00:00Z',
      };

      const bytesUploaded = await uploader.checkUploadStatus(session);
      expect(bytesUploaded).toBe(0);
    });
  });
});

describe('Factory functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createResumableUploader', () => {
    it('should create a new ResumableUploader instance', () => {
      const uploader = createResumableUploader();
      expect(uploader).toBeInstanceOf(ResumableUploader);
    });
  });
});
