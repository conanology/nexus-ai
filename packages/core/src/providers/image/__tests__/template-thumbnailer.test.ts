/**
 * Tests for TemplateThumbnailer
 */

import { describe, it, expect } from 'vitest';
import { TemplateThumbnailer } from '../template-thumbnailer.js';

describe('TemplateThumbnailer', () => {
  describe('constructor', () => {
    it('should have name property', () => {
      const provider = new TemplateThumbnailer();

      expect(provider.name).toBe('template-thumbnailer');
    });
  });

  describe('interface compliance', () => {
    it('should implement ImageProvider interface', () => {
      const provider = new TemplateThumbnailer();

      expect(typeof provider.generate).toBe('function');
      expect(typeof provider.estimateCost).toBe('function');
      expect(typeof provider.name).toBe('string');
    });
  });

  describe('estimateCost', () => {
    it('should return 0 (templates are free)', () => {
      const provider = new TemplateThumbnailer();

      const cost = provider.estimateCost('Any prompt');

      expect(cost).toBe(0);
    });

    it('should return 0 regardless of options', () => {
      const provider = new TemplateThumbnailer();

      const cost = provider.estimateCost('Any prompt', { count: 10 });

      expect(cost).toBe(0);
    });
  });

  describe('generate', () => {
    it('should return ImageResult with 3 variants', async () => {
      const provider = new TemplateThumbnailer();

      const result = await provider.generate('AI News Update');

      expect(result.imageUrls).toHaveLength(3);
    });

    it('should return zero cost (no API calls)', async () => {
      const provider = new TemplateThumbnailer();

      const result = await provider.generate('AI News Update');

      expect(result.cost).toBe(0);
    });

    it('should return fallback quality tier', async () => {
      const provider = new TemplateThumbnailer();

      const result = await provider.generate('AI News Update');

      expect(result.quality).toBe('fallback');
    });

    it('should return provider name as model', async () => {
      const provider = new TemplateThumbnailer();

      const result = await provider.generate('AI News Update');

      expect(result.model).toBe('template-thumbnailer');
    });

    it('should return valid GCS-style URLs', async () => {
      const provider = new TemplateThumbnailer();

      const result = await provider.generate('AI News Update');

      result.imageUrls.forEach((url) => {
        expect(url).toMatch(/^gs:\/\/nexus-ai-artifacts\//);
        expect(url).toContain('template-');
        expect(url).toMatch(/\.png$/);
      });
    });

    it('should include generatedAt timestamp', async () => {
      const provider = new TemplateThumbnailer();

      const result = await provider.generate('AI News Update');

      expect(result.generatedAt).toBeDefined();
      // Should be valid ISO 8601 format
      expect(() => new Date(result.generatedAt)).not.toThrow();
    });

    it('should use different template styles for variants', async () => {
      const provider = new TemplateThumbnailer();

      const result = await provider.generate('AI News Update');
      const uniqueUrls = new Set(result.imageUrls);

      // Each URL should be unique (different templates)
      expect(uniqueUrls.size).toBe(3);
    });
  });

  describe('input validation', () => {
    it('should throw on empty prompt', async () => {
      const provider = new TemplateThumbnailer();

      await expect(provider.generate('')).rejects.toThrow('Template title prompt cannot be empty');
    });

    it('should throw on whitespace-only prompt', async () => {
      const provider = new TemplateThumbnailer();

      await expect(provider.generate('   ')).rejects.toThrow('Template title prompt cannot be empty');
    });
  });

  describe('name property for withFallback', () => {
    it('should have name property for fallback tracking', () => {
      const provider = new TemplateThumbnailer();

      expect(provider.name).toBeDefined();
      expect(typeof provider.name).toBe('string');
      expect(provider.name).toBe('template-thumbnailer');
    });
  });
});
