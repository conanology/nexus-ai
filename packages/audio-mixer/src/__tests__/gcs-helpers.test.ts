/**
 * Tests for GCS helpers
 *
 * Note: Testing the authenticated SDK path is challenging due to import hoisting.
 * The key behavior (fallback from SDK to HTTP, and HTTP error handling) is tested here.
 * Full E2E tests verify the authenticated path works in production.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadFromGCS, uploadToGCS } from '../gcs-helpers.js';

// Mock the logger
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@nexus-ai/core')>('@nexus-ai/core');
  return {
    ...actual,
    logger: {
      child: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    },
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock @google-cloud/storage to always fail, forcing HTTP fallback for testability
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        download: vi.fn().mockRejectedValue(new Error('SDK not available in test')),
      }),
      upload: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}));

describe('gcs-helpers', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('downloadFromGCS', () => {
    it('should fall back to public URL when SDK is unavailable', async () => {
      // Mock fetch to succeed
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(new ArrayBuffer(100), { status: 200 }))
      );

      await expect(downloadFromGCS('gs://bucket/path/file.wav', '/tmp/local.wav'))
        .resolves.toBeUndefined();

      // Verify fetch WAS called as fallback
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://storage.googleapis.com/bucket/path/file.wav'
      );
    });

    it('should work with https:// URLs directly (no SDK attempt)', async () => {
      // Mock fetch to succeed
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(new ArrayBuffer(100), { status: 200 }))
      );

      await expect(
        downloadFromGCS('https://storage.googleapis.com/bucket/file.wav', '/tmp/local.wav')
      ).resolves.toBeUndefined();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://storage.googleapis.com/bucket/file.wav'
      );
    });

    it('should throw retryable error when fetch fails', async () => {
      // Mock fetch to fail
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(downloadFromGCS('gs://bucket/file.wav', '/tmp/local.wav'))
        .rejects.toThrow('Failed to download from GCS');
    });

    it('should throw retryable error on non-OK HTTP response (403 Forbidden)', async () => {
      // Mock fetch to return 403 (the bug we're fixing)
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 403 }))
      );

      await expect(downloadFromGCS('gs://bucket/file.wav', '/tmp/local.wav'))
        .rejects.toThrow('GCS download failed with status 403');
    });

    it('should throw retryable error on 404 response', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 404 }))
      );

      await expect(downloadFromGCS('gs://bucket/file.wav', '/tmp/local.wav'))
        .rejects.toThrow('GCS download failed with status 404');
    });
  });

  describe('uploadToGCS', () => {
    it('should upload file successfully', async () => {
      const result = await uploadToGCS('/tmp/local.wav', 'gs://bucket/path/file.wav');

      expect(result).toBe('https://storage.googleapis.com/bucket/path/file.wav');
    });

    it('should throw on invalid GCS URL format', async () => {
      await expect(uploadToGCS('/tmp/local.wav', 'not-a-gcs-url'))
        .rejects.toThrow('Invalid GCS URL');
    });

    it('should throw on missing bucket in URL', async () => {
      await expect(uploadToGCS('/tmp/local.wav', 'gs://'))
        .rejects.toThrow('Invalid GCS URL');
    });
  });
});
