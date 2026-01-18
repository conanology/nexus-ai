/**
 * Tests for TemplateThumbnailer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateThumbnailer } from '../template-thumbnailer.js';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (_path: string) => {
    // Return a minimal PNG buffer for testing (PNG signature)
    return Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    ]);
  }),
}));

vi.mock('sharp', () => {
  return {
    default: vi.fn(() => ({
      composite: vi.fn(() => ({
        png: vi.fn(() => ({
          toBuffer: vi.fn(async () => Buffer.from('mock-png-data')),
        })),
      })),
    })),
  };
});

vi.mock('../../../observability/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../../../storage/index.js', () => ({
  CloudStorageClient: vi.fn().mockImplementation(() => ({
    uploadFile: vi.fn(async (path: string) => `gs://test-bucket/${path}`),
    getPublicUrl: vi.fn((path: string) => `https://storage.googleapis.com/test-bucket/${path}`),
  })),
  getThumbnailPath: vi.fn((pipelineId: string, variant: number) =>
    `${pipelineId}/thumbnails/${variant}.png`
  ),
}));

describe('TemplateThumbnailer', () => {
  let provider: TemplateThumbnailer;

  beforeEach(() => {
    provider = new TemplateThumbnailer();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should have name property', () => {
      expect(provider.name).toBe('template-thumbnailer');
    });
  });

  describe('interface compliance', () => {
    it('should implement ImageProvider interface', () => {
      expect(typeof provider.generate).toBe('function');
      expect(typeof provider.estimateCost).toBe('function');
      expect(typeof provider.name).toBe('string');
    });
  });

  describe('estimateCost', () => {
    it('should return 0 (templates are free)', () => {
      const cost = provider.estimateCost('Any prompt');
      expect(cost).toBe(0);
    });

    it('should return 0 regardless of options', () => {
      const cost = provider.estimateCost('Any prompt', { count: 10 });
      expect(cost).toBe(0);
    });
  });

  describe('generate', () => {
    it('should return ImageResult with 3 variants', async () => {
      const result = await provider.generate('AI News Update');
      expect(result.imageUrls).toHaveLength(3);
    });

    it('should return zero cost (no API calls)', async () => {
      const result = await provider.generate('AI News Update');
      expect(result.cost).toBe(0);
    });

    it('should return fallback quality tier', async () => {
      const result = await provider.generate('AI News Update');
      expect(result.quality).toBe('fallback');
    });

    it('should return provider name as model', async () => {
      const result = await provider.generate('AI News Update');
      expect(result.model).toBe('template-thumbnailer');
    });

    it('should return valid GCS-style URLs from mock storage', async () => {
      const result = await provider.generate('AI News Update');

      result.imageUrls.forEach((url) => {
        expect(url).toMatch(/^gs:\/\/test-bucket\//);
        expect(url).toMatch(/\.png$/);
      });
    });

    it('should include generatedAt timestamp', async () => {
      const result = await provider.generate('AI News Update');

      expect(result.generatedAt).toBeDefined();
      // Should be valid ISO 8601 format
      expect(() => new Date(result.generatedAt)).not.toThrow();
    });

    it('should use different paths for each variant', async () => {
      const result = await provider.generate('AI News Update');
      const uniqueUrls = new Set(result.imageUrls);

      // Each URL should be unique (different variants)
      expect(uniqueUrls.size).toBe(3);
    });

    it('should handle long titles', async () => {
      const longTitle = 'This is a very long title that needs to be wrapped across multiple lines to fit properly on the thumbnail';
      const result = await provider.generate(longTitle);

      expect(result.imageUrls).toHaveLength(3);
      expect(result.cost).toBe(0);
    });

    it('should handle special characters in title', async () => {
      const result = await provider.generate('AI & Machine Learning: The Future');

      expect(result.imageUrls).toHaveLength(3);
    });
  });

  describe('input validation', () => {
    it('should throw on empty prompt', async () => {
      await expect(provider.generate('')).rejects.toThrow('Template title prompt cannot be empty');
    });

    it('should throw on whitespace-only prompt', async () => {
      await expect(provider.generate('   ')).rejects.toThrow('Template title prompt cannot be empty');
    });
  });

  describe('name property for withFallback', () => {
    it('should have name property for fallback tracking', () => {
      expect(provider.name).toBeDefined();
      expect(typeof provider.name).toBe('string');
      expect(provider.name).toBe('template-thumbnailer');
    });
  });

  describe('text wrapping utility', () => {
    it('should wrap text across multiple lines for long titles', async () => {
      const longTitle = 'A very long title that should be wrapped into multiple lines for proper display on the thumbnail image';
      const result = await provider.generate(longTitle);

      // Should still generate 3 variants successfully
      expect(result.imageUrls).toHaveLength(3);
    });
  });
});
