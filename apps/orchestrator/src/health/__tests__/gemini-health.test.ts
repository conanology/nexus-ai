/**
 * Tests for Gemini API health check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkGeminiHealth } from '../gemini-health.js';

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

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
}));

describe('checkGeminiHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return healthy status when API responds successfully', async () => {
    const { getSecret } = await import('@nexus-ai/core');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    (getSecret as any).mockResolvedValue('test-api-key');
    (GoogleGenerativeAI as any).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => 'health check response',
          },
        }),
      }),
    }));

    const result = await checkGeminiHealth();

    expect(result.service).toBe('gemini');
    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('should return failed status when secret retrieval fails', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockRejectedValue(new Error('Secret not found'));

    const result = await checkGeminiHealth();

    expect(result.service).toBe('gemini');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Secret not found');
  });

  it('should return failed status when API returns empty response', async () => {
    const { getSecret } = await import('@nexus-ai/core');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    (getSecret as any).mockResolvedValue('test-api-key');
    (GoogleGenerativeAI as any).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => '',
          },
        }),
      }),
    }));

    const result = await checkGeminiHealth();

    expect(result.service).toBe('gemini');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Empty response');
  });

  it('should return failed status when API call throws', async () => {
    const { getSecret } = await import('@nexus-ai/core');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    (getSecret as any).mockResolvedValue('test-api-key');
    (GoogleGenerativeAI as any).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: vi.fn().mockRejectedValue(new Error('API Error')),
      }),
    }));

    const result = await checkGeminiHealth();

    expect(result.service).toBe('gemini');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('API Error');
  });

  it('should include latency in result', async () => {
    const { getSecret } = await import('@nexus-ai/core');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    (getSecret as any).mockResolvedValue('test-api-key');
    (GoogleGenerativeAI as any).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            response: {
              text: () => 'response',
            },
          };
        }),
      }),
    }));

    const result = await checkGeminiHealth();

    expect(result.latencyMs).toBeGreaterThan(0);
  });
});
