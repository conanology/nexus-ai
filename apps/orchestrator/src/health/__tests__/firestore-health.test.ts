/**
 * Tests for Firestore health check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkFirestoreHealth } from '../firestore-health.js';

// Mock dependencies
vi.mock('@nexus-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nexus-ai/core')>();
  return {
    ...actual,
    FirestoreClient: vi.fn(),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

describe('checkFirestoreHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return healthy status when read/write succeeds', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockClient = {
      setDocument: vi.fn().mockResolvedValue(undefined),
      getDocument: vi.fn().mockResolvedValue({
        timestamp: new Date().toISOString(),
        healthCheck: true,
        randomValue: 0.5,
      }),
    };

    (FirestoreClient as any).mockImplementation(() => mockClient);

    const result = await checkFirestoreHealth();

    expect(result.service).toBe('firestore');
    expect(result.status).toBe('healthy');
    expect(result.error).toBeUndefined();
    expect(mockClient.setDocument).toHaveBeenCalled();
    expect(mockClient.getDocument).toHaveBeenCalled();
  });

  it('should return failed status when write fails', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockClient = {
      setDocument: vi.fn().mockRejectedValue(new Error('Write failed')),
      getDocument: vi.fn(),
    };

    (FirestoreClient as any).mockImplementation(() => mockClient);

    const result = await checkFirestoreHealth();

    expect(result.service).toBe('firestore');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Write failed');
  });

  it('should return failed status when document not found after write', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockClient = {
      setDocument: vi.fn().mockResolvedValue(undefined),
      getDocument: vi.fn().mockResolvedValue(null),
    };

    (FirestoreClient as any).mockImplementation(() => mockClient);

    const result = await checkFirestoreHealth();

    expect(result.service).toBe('firestore');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('document not found');
  });

  it('should return failed status when document data is invalid', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockClient = {
      setDocument: vi.fn().mockResolvedValue(undefined),
      getDocument: vi.fn().mockResolvedValue({
        timestamp: new Date().toISOString(),
        healthCheck: false, // Invalid
        randomValue: 0.5,
      }),
    };

    (FirestoreClient as any).mockImplementation(() => mockClient);

    const result = await checkFirestoreHealth();

    expect(result.service).toBe('firestore');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('data mismatch');
  });

  it('should return failed status when read fails', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockClient = {
      setDocument: vi.fn().mockResolvedValue(undefined),
      getDocument: vi.fn().mockRejectedValue(new Error('Read failed')),
    };

    (FirestoreClient as any).mockImplementation(() => mockClient);

    const result = await checkFirestoreHealth();

    expect(result.service).toBe('firestore');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Read failed');
  });

  it('should include latency in result', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockClient = {
      setDocument: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }),
      getDocument: vi.fn().mockResolvedValue({
        timestamp: new Date().toISOString(),
        healthCheck: true,
        randomValue: 0.5,
      }),
    };

    (FirestoreClient as any).mockImplementation(() => mockClient);

    const result = await checkFirestoreHealth();

    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('should write to correct collection path', async () => {
    const { FirestoreClient } = await import('@nexus-ai/core');

    const mockClient = {
      setDocument: vi.fn().mockResolvedValue(undefined),
      getDocument: vi.fn().mockResolvedValue({
        timestamp: new Date().toISOString(),
        healthCheck: true,
        randomValue: 0.5,
      }),
    };

    (FirestoreClient as any).mockImplementation(() => mockClient);

    await checkFirestoreHealth();

    expect(mockClient.setDocument).toHaveBeenCalledWith(
      'health-checks',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
      expect.objectContaining({
        healthCheck: true,
      })
    );
  });
});
