/**
 * Tests for thumbnail upload functionality
 * @module @nexus-ai/youtube/thumbnail.test
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { downloadThumbnail, validateThumbnail, uploadThumbnailToYouTube } from './thumbnail.js';
import { NexusError } from '@nexus-ai/core';

// Mock dependencies
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    CloudStorageClient: vi.fn(() => ({
      downloadFile: vi.fn(),
    })),
  };
});

vi.mock('./client.js', () => ({
  getYouTubeClient: vi.fn(),
}));

vi.mock('./quota.js', () => ({
  recordThumbnailSet: vi.fn(),
}));

// Mock image-size
vi.mock('image-size', () => ({
  imageSize: vi.fn(),
}));

describe('downloadThumbnail', () => {
  it('should download thumbnail from Cloud Storage', async () => {
    const { CloudStorageClient } = await import('@nexus-ai/core');
    const mockDownload = vi.fn().mockResolvedValue(Buffer.from('test-image-data'));

    (CloudStorageClient as Mock).mockImplementation(() => ({
      downloadFile: mockDownload,
    }));

    const url = 'gs://nexus-ai-artifacts/2026-01-18/thumbnails/1.png';
    const result = await downloadThumbnail(url);

    expect(result).toBeInstanceOf(Buffer);
    expect(mockDownload).toHaveBeenCalledWith('2026-01-18/thumbnails/1.png');
  });

  it('should throw error for invalid URL format', async () => {
    const url = 'https://example.com/image.png';

    await expect(downloadThumbnail(url)).rejects.toThrow(NexusError);
  });

  it('should handle download failures', async () => {
    const { CloudStorageClient } = await import('@nexus-ai/core');
    const mockDownload = vi.fn().mockRejectedValue(new Error('Network error'));

    (CloudStorageClient as Mock).mockImplementation(() => ({
      downloadFile: mockDownload,
    }));

    const url = 'gs://nexus-ai-artifacts/2026-01-18/thumbnails/1.png';

    await expect(downloadThumbnail(url)).rejects.toThrow();
  });
});

describe('validateThumbnail', () => {
  let imageSizeMock: Mock;

  beforeEach(async () => {
    const imageSizeModule = await import('image-size');
    imageSizeMock = imageSizeModule.imageSize as unknown as Mock;
    imageSizeMock.mockReset();
  });

  it('should accept valid PNG thumbnail with correct dimensions', () => {
    const buffer = Buffer.alloc(1024);
    imageSizeMock.mockReturnValue({ type: 'png', width: 1280, height: 720 });

    expect(() => validateThumbnail(buffer)).not.toThrow();
  });

  it('should accept valid JPG thumbnail with correct dimensions', () => {
    const buffer = Buffer.alloc(1024);
    imageSizeMock.mockReturnValue({ type: 'jpg', width: 1280, height: 720 });

    expect(() => validateThumbnail(buffer)).not.toThrow();
  });

  it('should reject file larger than 2MB', () => {
    const largeBuffer = Buffer.alloc(2 * 1024 * 1024 + 1); // Just over 2MB
    // imageSize mock not needed as size check is first

    expect(() => validateThumbnail(largeBuffer)).toThrow(NexusError);
    expect(() => validateThumbnail(largeBuffer)).toThrow(/exceeds 2MB limit/);
  });

  it('should reject invalid dimensions', () => {
    const buffer = Buffer.alloc(1024);
    imageSizeMock.mockReturnValue({ type: 'png', width: 1920, height: 1080 }); // Wrong dimensions

    expect(() => validateThumbnail(buffer)).toThrow(NexusError);
    expect(() => validateThumbnail(buffer)).toThrow(/Invalid thumbnail dimensions/);
  });

  it('should reject invalid file format (gif)', () => {
    const buffer = Buffer.alloc(1024);
    imageSizeMock.mockReturnValue({ type: 'gif', width: 1280, height: 720 });

    expect(() => validateThumbnail(buffer)).toThrow(NexusError);
    expect(() => validateThumbnail(buffer)).toThrow(/Invalid thumbnail format/);
  });

  it('should reject when image type cannot be determined', () => {
    const buffer = Buffer.alloc(1024);
    imageSizeMock.mockReturnValue(undefined);

    expect(() => validateThumbnail(buffer)).toThrow(NexusError);
    expect(() => validateThumbnail(buffer)).toThrow(/Thumbnail validation failed/);
  });
});

describe('uploadThumbnailToYouTube', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upload thumbnail using YouTube API', async () => {
    const { getYouTubeClient } = await import('./client.js');
    const { recordThumbnailSet } = await import('./quota.js');

    const mockSet = vi.fn().mockResolvedValue({
      data: {
        items: [{ id: 'test-video-id' }],
      },
    });

    (getYouTubeClient as Mock).mockResolvedValue({
      getYouTubeApi: () => ({
        thumbnails: {
          set: mockSet,
        },
      }),
    });

    const videoId = 'test-video-id';
    // PNG signature simulation
    const thumbnailBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.from('image-data'),
    ]);

    await uploadThumbnailToYouTube(videoId, thumbnailBuffer);

    expect(mockSet).toHaveBeenCalledWith({
      videoId,
      media: {
        mimeType: 'image/png', // Should be detected from buffer
        body: expect.any(Object),
      },
    });
    expect(recordThumbnailSet).toHaveBeenCalled();
  });

  it('should handle YouTube API errors', async () => {
    const { getYouTubeClient } = await import('./client.js');

    const mockSet = vi.fn().mockRejectedValue(new Error('YouTube API error'));

    (getYouTubeClient as Mock).mockResolvedValue({
      getYouTubeApi: () => ({
        thumbnails: {
          set: mockSet,
        },
      }),
    });

    const videoId = 'test-video-id';
    const thumbnailBuffer = Buffer.from('image-data');

    await expect(uploadThumbnailToYouTube(videoId, thumbnailBuffer)).rejects.toThrow();
  });
});

describe('setThumbnail (main entry point)', () => {
  let imageSizeMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    const imageSizeModule = await import('image-size');
    imageSizeMock = imageSizeModule.imageSize as unknown as Mock;
    imageSizeMock.mockReset();
  });

  it('should complete full thumbnail flow successfully', async () => {
    const { CloudStorageClient } = await import('@nexus-ai/core');
    const { getYouTubeClient } = await import('./client.js');
    const { setThumbnail } = await import('./thumbnail.js');

    // Mock download
    const buffer = Buffer.alloc(1024 * 100);
    const mockDownload = vi.fn().mockResolvedValue(buffer);
    (CloudStorageClient as Mock).mockImplementation(() => ({
      downloadFile: mockDownload,
    }));

    // Mock validation success
    imageSizeMock.mockReturnValue({ type: 'png', width: 1280, height: 720 });

    // Mock upload
    const mockSet = vi.fn().mockResolvedValue({
      data: {
        items: [{ id: 'video-123' }],
      },
    });

    (getYouTubeClient as Mock).mockResolvedValue({
      getYouTubeApi: () => ({
        thumbnails: {
          set: mockSet,
        },
      }),
    });

    const result = await setThumbnail(
      'video-123',
      'gs://nexus-ai-artifacts/2026-01-18/thumbnails/1.png'
    );

    expect(result).toBe(true);
    expect(mockDownload).toHaveBeenCalled();
    expect(imageSizeMock).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
  });

  it('should return false on failure without throwing (warn-on-fail)', async () => {
    const { CloudStorageClient } = await import('@nexus-ai/core');
    const { setThumbnail } = await import('./thumbnail.js');

    // Mock download failure
    const mockDownload = vi.fn().mockRejectedValue(new Error('Download failed'));
    (CloudStorageClient as Mock).mockImplementation(() => ({
      downloadFile: mockDownload,
    }));

    const result = await setThumbnail(
      'video-123',
      'gs://nexus-ai-artifacts/2026-01-18/thumbnails/1.png'
    );

    expect(result).toBe(false);
  });
});
