/**
 * Tests for CloudStorageClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NexusError } from '../../errors/index.js';

// Mock functions
const mockSave = vi.fn();
const mockDownload = vi.fn();
const mockDelete = vi.fn();
const mockExists = vi.fn();
const mockGetSignedUrl = vi.fn();
const mockGetFiles = vi.fn();

const mockFile = {
  name: 'test-file.txt',
  save: mockSave,
  download: mockDownload,
  delete: mockDelete,
  exists: mockExists,
  getSignedUrl: mockGetSignedUrl,
};

const mockBucket = {
  file: vi.fn(() => mockFile),
  getFiles: mockGetFiles,
};

// Mock the Storage SDK
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn(() => mockBucket),
  })),
}));

describe('CloudStorageClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXUS_BUCKET_NAME = 'test-bucket';
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockDownload.mockResolvedValue([Buffer.from('test content')]);
    mockDelete.mockResolvedValue(undefined);
    mockExists.mockResolvedValue([true]);
    mockGetSignedUrl.mockResolvedValue(['https://signed-url.example.com']);
    mockGetFiles.mockResolvedValue([[
      { name: 'file1.txt' },
      { name: 'file2.txt' },
    ]]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should delegate to local storage when no bucket name available', async () => {
      delete process.env.NEXUS_BUCKET_NAME;
      delete process.env.STORAGE_MODE;

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient();
      // Should not throw — auto-delegates to LocalStorageClient
      expect(client.name).toBe('cloud-storage');
    });

    it('should delegate to local storage when STORAGE_MODE=local', async () => {
      process.env.STORAGE_MODE = 'local';

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient();
      expect(client.name).toBe('cloud-storage');
      // Delegate handles all operations — verify getGsUri returns local:// format
      expect(client.getGsUri('test/file.txt')).toBe('local://test/file.txt');
    });

    it('should accept explicit bucket name', async () => {
      delete process.env.NEXUS_BUCKET_NAME;

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('explicit-bucket');
      expect(client.name).toBe('cloud-storage');
    });

    it('should have name property for debugging', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');
      expect(client.name).toBe('cloud-storage');
    });
  });

  describe('uploadFile', () => {
    it('should upload string content and return gs:// URL', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const url = await client.uploadFile(
        '2026-01-08/research/research.md',
        'test content',
        'text/markdown'
      );

      expect(url).toBe('gs://test-bucket/2026-01-08/research/research.md');
      expect(mockSave).toHaveBeenCalledWith(
        expect.any(Buffer),
        { contentType: 'text/markdown' }
      );
    });

    it('should upload Buffer content', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const buffer = Buffer.from('binary content');
      const url = await client.uploadFile(
        '2026-01-08/tts/audio.wav',
        buffer,
        'audio/wav'
      );

      expect(url).toBe('gs://test-bucket/2026-01-08/tts/audio.wav');
      expect(mockSave).toHaveBeenCalledWith(buffer, { contentType: 'audio/wav' });
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockSave.mockRejectedValue(new Error('Upload failed'));

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      try {
        await client.uploadFile('fail', 'content', 'text/plain');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('downloadFile', () => {
    it('should download file and return Buffer', async () => {
      mockDownload.mockResolvedValue([Buffer.from('downloaded content')]);

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const content = await client.downloadFile('2026-01-08/tts/audio.wav');

      expect(content).toBeInstanceOf(Buffer);
      expect(content.toString()).toBe('downloaded content');
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockDownload.mockRejectedValue(new Error('Download failed'));

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      try {
        await client.downloadFile('fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL with default expiration', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const url = await client.getSignedUrl('2026-01-08/render/video.mp4');

      expect(url).toBe('https://signed-url.example.com');
      expect(mockGetSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'read',
        expires: expect.any(Number),
      });
    });

    it('should accept custom expiration', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      await client.getSignedUrl('2026-01-08/tts/audio.wav', 120);

      expect(mockGetSignedUrl).toHaveBeenCalled();
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('Signed URL failed'));

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      try {
        await client.getSignedUrl('fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      await client.deleteFile('test/file.txt');

      expect(mockDelete).toHaveBeenCalled();
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockDelete.mockRejectedValue(new Error('Delete failed'));

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      try {
        await client.deleteFile('fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockExists.mockResolvedValue([true]);

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const exists = await client.fileExists('2026-01-08/render/video.mp4');

      expect(exists).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockExists.mockResolvedValue([false]);

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const exists = await client.fileExists('nonexistent.txt');

      expect(exists).toBe(false);
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockExists.mockRejectedValue(new Error('Exists check failed'));

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      try {
        await client.fileExists('fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('listFiles', () => {
    it('should return list of file paths', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const files = await client.listFiles('2026-01-08/');

      expect(files).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should pass prefix to getFiles', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      await client.listFiles('2026-01-08/thumbnails/');

      expect(mockGetFiles).toHaveBeenCalledWith({ prefix: '2026-01-08/thumbnails/' });
    });

    it('should wrap SDK errors in NexusError', async () => {
      mockGetFiles.mockRejectedValue(new Error('List failed'));

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      try {
        await client.listFiles('fail');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NexusError);
      }
    });
  });

  describe('uploadArtifact', () => {
    it('should build path and upload file', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const url = await client.uploadArtifact(
        '2026-01-08',
        'research',
        'research.md',
        'content',
        'text/markdown'
      );

      expect(url).toBe('gs://test-bucket/2026-01-08/research/research.md');
    });
  });

  describe('downloadArtifact', () => {
    it('should build path and download file', async () => {
      mockDownload.mockResolvedValue([Buffer.from('artifact content')]);

      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const content = await client.downloadArtifact('2026-01-08', 'tts', 'audio.wav');

      expect(content.toString()).toBe('artifact content');
    });
  });

  describe('getPublicUrl', () => {
    it('should return public HTTPS URL', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const url = client.getPublicUrl('2026-01-08/thumbnails/1.png');

      expect(url).toBe('https://storage.googleapis.com/test-bucket/2026-01-08/thumbnails/1.png');
    });
  });

  describe('getGsUri', () => {
    it('should return gs:// URI', async () => {
      const module = await import('../cloud-storage-client.js');
      const client = new module.CloudStorageClient('test-bucket');

      const uri = client.getGsUri('2026-01-08/render/video.mp4');

      expect(uri).toBe('gs://test-bucket/2026-01-08/render/video.mp4');
    });
  });
});
