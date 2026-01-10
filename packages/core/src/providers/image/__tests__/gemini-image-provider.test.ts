/**
 * Tests for GeminiImageProvider
 */

import { describe, it, expect, vi } from 'vitest';
import { GeminiImageProvider } from '../gemini-image-provider.js';
import type { ImageResult } from '../../../types/providers.js';

// Mock dependencies
vi.mock('../../../secrets/index.js', () => ({
  getSecret: vi.fn().mockResolvedValue('mock-api-key'),
}));

vi.mock('../../../utils/with-retry.js', () => ({
  withRetry: vi.fn(async (fn) => {
    const result = await fn();
    return { result, attempts: 1, totalDelayMs: 0 };
  }),
}));

describe('GeminiImageProvider', () => {
  describe('constructor', () => {
    it('should have name property matching model', () => {
      const provider = new GeminiImageProvider('gemini-3-pro-image-preview');

      expect(provider.name).toBe('gemini-3-pro-image-preview');
    });

    it('should use default model when not specified', () => {
      const provider = new GeminiImageProvider();

      expect(provider.name).toBe('gemini-3-pro-image-preview');
    });
  });

  describe('interface compliance', () => {
    it('should implement ImageProvider interface', () => {
      const provider = new GeminiImageProvider();

      expect(typeof provider.generate).toBe('function');
      expect(typeof provider.estimateCost).toBe('function');
      expect(typeof provider.name).toBe('string');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on image count', () => {
      const provider = new GeminiImageProvider();

      // Default count (3)
      const defaultCost = provider.estimateCost('Test prompt');
      expect(defaultCost).toBe(0.12); // 3 * $0.04

      // Custom count
      const customCost = provider.estimateCost('Test prompt', { count: 5 });
      expect(customCost).toBe(0.2); // 5 * $0.04
    });

    it('should default to 3 variants (NFR22)', () => {
      const provider = new GeminiImageProvider();

      const cost = provider.estimateCost('Test prompt');

      expect(cost).toBe(0.12); // 3 * $0.04
    });

    it('should return 2 decimal precision', () => {
      const provider = new GeminiImageProvider();

      const cost = provider.estimateCost('Test prompt');
      const decimalPlaces = cost.toString().split('.')[1]?.length || 0;

      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  describe('generate', () => {
    it('should call getSecret for API key', async () => {
      const provider = new GeminiImageProvider();
      const { getSecret } = await import('../../../secrets/index.js');

      try {
        await provider.generate('AI robot thumbnail');
      } catch {
        // Expected in placeholder mode
      }

      expect(getSecret).toHaveBeenCalledWith('nexus-gemini-api-key');
    });

    it('should use withRetry for API calls', async () => {
      const provider = new GeminiImageProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      try {
        await provider.generate('AI robot thumbnail');
      } catch {
        // Expected in placeholder mode
      }

      expect(withRetry).toHaveBeenCalled();
    });

    it('should return ImageResult when SDK is configured', async () => {
      const provider = new GeminiImageProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      const mockResult: ImageResult = {
        imageUrls: [
          'gs://nexus-ai-artifacts/test/thumbnail-1.png',
          'gs://nexus-ai-artifacts/test/thumbnail-2.png',
          'gs://nexus-ai-artifacts/test/thumbnail-3.png',
        ],
        cost: 0.12,
        model: 'gemini-3-pro-image-preview',
        quality: 'primary',
        generatedAt: new Date().toISOString(),
      };

      vi.mocked(withRetry).mockResolvedValueOnce({
        result: mockResult,
        attempts: 1,
        totalDelayMs: 0,
      });

      const result = await provider.generate('AI robot thumbnail');

      expect(result.imageUrls).toHaveLength(3);
      expect(result.cost).toBe(0.12);
      expect(result.model).toBe('gemini-3-pro-image-preview');
      expect(result.quality).toBe('primary');
      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should throw on empty prompt', async () => {
      const provider = new GeminiImageProvider();

      await expect(provider.generate('')).rejects.toThrow('Image generation prompt cannot be empty');
    });

    it('should throw on whitespace-only prompt', async () => {
      const provider = new GeminiImageProvider();

      await expect(provider.generate('   ')).rejects.toThrow(
        'Image generation prompt cannot be empty'
      );
    });
  });

  describe('name property for withFallback', () => {
    it('should have name property for fallback tracking', () => {
      const provider = new GeminiImageProvider();

      expect(provider.name).toBeDefined();
      expect(typeof provider.name).toBe('string');
    });
  });
});
