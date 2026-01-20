/**
 * Tests for Cloud Storage health check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkStorageHealth } from '../storage-health.js';

// Mock dependencies
vi.mock('@nexus-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nexus-ai/core')>();
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(),
}));

describe('checkStorageHealth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  it('should return healthy status when bucket exists and is accessible', async () => {
    const { Storage } = await import('@google-cloud/storage');

    const mockBucket = {
      exists: vi.fn().mockResolvedValue([true]),
      getFiles: vi.fn().mockResolvedValue([[]]),
    };

    (Storage as any).mockImplementation(() => ({
      bucket: vi.fn().mockReturnValue(mockBucket),
    }));

    const result = await checkStorageHealth();

    expect(result.service).toBe('cloud-storage');
    expect(result.status).toBe('healthy');
    expect(result.error).toBeUndefined();
  });

  it('should return degraded status when bucket does not exist (DEGRADED criticality)', async () => {
    const { Storage } = await import('@google-cloud/storage');

    const mockBucket = {
      exists: vi.fn().mockResolvedValue([false]),
    };

    (Storage as any).mockImplementation(() => ({
      bucket: vi.fn().mockReturnValue(mockBucket),
    }));

    const result = await checkStorageHealth();

    expect(result.service).toBe('cloud-storage');
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('does not exist');
  });

  it('should return healthy status even if list operation fails', async () => {
    const { Storage } = await import('@google-cloud/storage');

    const mockBucket = {
      exists: vi.fn().mockResolvedValue([true]),
      getFiles: vi.fn().mockRejectedValue(new Error('Permission denied')),
    };

    (Storage as any).mockImplementation(() => ({
      bucket: vi.fn().mockReturnValue(mockBucket),
    }));

    const result = await checkStorageHealth();

    expect(result.service).toBe('cloud-storage');
    expect(result.status).toBe('healthy');
  });

  it('should return degraded status on connection error (DEGRADED criticality)', async () => {
    const { Storage } = await import('@google-cloud/storage');

    (Storage as any).mockImplementation(() => ({
      bucket: vi.fn().mockReturnValue({
        exists: vi.fn().mockRejectedValue(new Error('Connection refused')),
      }),
    }));

    const result = await checkStorageHealth();

    expect(result.service).toBe('cloud-storage');
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('Connection refused');
  });

  it('should use custom bucket name from environment', async () => {
    const { Storage } = await import('@google-cloud/storage');
    process.env.NEXUS_BUCKET_NAME = 'custom-bucket';

    const mockStorage = {
      bucket: vi.fn().mockReturnValue({
        exists: vi.fn().mockResolvedValue([true]),
        getFiles: vi.fn().mockResolvedValue([[]]),
      }),
    };

    (Storage as any).mockImplementation(() => mockStorage);

    await checkStorageHealth();

    expect(mockStorage.bucket).toHaveBeenCalledWith('custom-bucket');
  });

  it('should use default bucket name when not specified', async () => {
    const { Storage } = await import('@google-cloud/storage');
    delete process.env.NEXUS_BUCKET_NAME;

    const mockStorage = {
      bucket: vi.fn().mockReturnValue({
        exists: vi.fn().mockResolvedValue([true]),
        getFiles: vi.fn().mockResolvedValue([[]]),
      }),
    };

    (Storage as any).mockImplementation(() => mockStorage);

    await checkStorageHealth();

    expect(mockStorage.bucket).toHaveBeenCalledWith('nexus-ai-artifacts');
  });

  it('should include latency in result', async () => {
    const { Storage } = await import('@google-cloud/storage');

    const mockBucket = {
      exists: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [true];
      }),
      getFiles: vi.fn().mockResolvedValue([[]]),
    };

    (Storage as any).mockImplementation(() => ({
      bucket: vi.fn().mockReturnValue(mockBucket),
    }));

    const result = await checkStorageHealth();

    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('should include bucket name in metadata on success', async () => {
    const { Storage } = await import('@google-cloud/storage');

    const mockBucket = {
      exists: vi.fn().mockResolvedValue([true]),
      getFiles: vi.fn().mockResolvedValue([[]]),
    };

    (Storage as any).mockImplementation(() => ({
      bucket: vi.fn().mockReturnValue(mockBucket),
    }));

    const result = await checkStorageHealth();

    expect(result.metadata?.exists).toBe(true);
    expect(result.metadata?.name).toBe('nexus-ai-artifacts');
  });
});
