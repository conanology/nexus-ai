/**
 * Tests for Twitter API health check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkTwitterHealth } from '../twitter-health.js';

// Mock dependencies
vi.mock('@nexus-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nexus-ai/core')>();
  return {
    ...actual,
    getSecret: vi.fn(),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('checkTwitterHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return healthy status when API responds with 200', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('{"access_token": "test-token"}');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('healthy');
    expect(result.error).toBeUndefined();
  });

  it('should return failed status on 401 Unauthorized', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('{"access_token": "invalid-token"}');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('401');
  });

  it('should return failed status on 403 Forbidden', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('{"access_token": "test-token"}');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
    });

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('403');
  });

  it('should return degraded status on 429 Rate Limited', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('{"access_token": "test-token"}');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
    });

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('Rate limited');
  });

  it('should return degraded status on other HTTP errors', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('{"access_token": "test-token"}');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('500');
  });

  it('should return degraded status on network errors (RECOVERABLE)', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('{"access_token": "test-token"}');
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('Network error');
  });

  it('should handle raw bearer token credentials', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('raw-bearer-token');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('healthy');

    // Verify fetch was called with correct authorization header
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.twitter.com/2/users/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer raw-bearer-token',
        }),
      })
    );
  });

  it('should return degraded status on secret retrieval error', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockRejectedValue(new Error('Secret not found'));

    const result = await checkTwitterHealth();

    expect(result.service).toBe('twitter');
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('Secret not found');
  });

  it('should include latency in result', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('{"access_token": "test-token"}');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await checkTwitterHealth();

    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
