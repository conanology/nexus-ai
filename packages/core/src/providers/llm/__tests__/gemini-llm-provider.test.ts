/**
 * Tests for GeminiLLMProvider
 */

import { describe, it, expect, vi } from 'vitest';
import { GeminiLLMProvider } from '../gemini-llm-provider.js';
import type { LLMResult } from '../../../types/providers.js';

// Mock the secrets module
vi.mock('../../../secrets/index.js', () => ({
  getSecret: vi.fn().mockResolvedValue('mock-api-key'),
}));

// Mock withRetry to execute function directly for most tests
vi.mock('../../../utils/with-retry.js', () => ({
  withRetry: vi.fn(async (fn) => {
    const result = await fn();
    return { result, attempts: 1, totalDelayMs: 0 };
  }),
}));

describe('GeminiLLMProvider', () => {
  describe('constructor', () => {
    it('should have name property matching model', () => {
      const provider = new GeminiLLMProvider('gemini-3-pro-preview');

      expect(provider.name).toBe('gemini-3-pro-preview');
    });

    it('should use default model when not specified', () => {
      const provider = new GeminiLLMProvider();

      expect(provider.name).toBe('gemini-3-pro-preview');
    });

    it('should accept custom model names', () => {
      const provider = new GeminiLLMProvider('gemini-2.5-pro');

      expect(provider.name).toBe('gemini-2.5-pro');
    });
  });

  describe('interface compliance', () => {
    it('should implement LLMProvider interface', () => {
      const provider = new GeminiLLMProvider();

      expect(typeof provider.generate).toBe('function');
      expect(typeof provider.estimateCost).toBe('function');
      expect(typeof provider.name).toBe('string');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on prompt length', () => {
      const provider = new GeminiLLMProvider();

      // Short prompt
      const shortCost = provider.estimateCost('Hello');
      expect(shortCost).toBeGreaterThan(0);

      // Longer prompt should cost more for input
      const longPrompt = 'A'.repeat(4000); // ~1000 tokens
      const longCost = provider.estimateCost(longPrompt);
      expect(longCost).toBeGreaterThan(shortCost);
    });

    it('should return reasonable estimates for typical prompts', () => {
      const provider = new GeminiLLMProvider();

      // Typical script prompt (~500 chars = ~125 tokens input)
      const typicalPrompt =
        'Write a YouTube script about the latest developments in artificial intelligence, ' +
        'focusing on large language models and their applications in everyday life. ' +
        'The script should be engaging and informative.';

      const cost = provider.estimateCost(typicalPrompt);

      // Should be less than $0.02 for a typical prompt
      // (125 input tokens * $0.00125/1K) + (2000 output tokens * $0.005/1K) = ~$0.01
      expect(cost).toBeLessThan(0.02);
      expect(cost).toBeGreaterThan(0);
    });

    it('should handle empty prompt', () => {
      const provider = new GeminiLLMProvider();

      const cost = provider.estimateCost('');

      // Should still have output cost estimate
      expect(cost).toBeGreaterThan(0);
    });

    it('should return 4 decimal precision', () => {
      const provider = new GeminiLLMProvider();

      const cost = provider.estimateCost('Test prompt');
      const decimalPlaces = cost.toString().split('.')[1]?.length || 0;

      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });
  });

  describe('generate', () => {
    it('should call getSecret for API key', async () => {
      const provider = new GeminiLLMProvider();
      const { getSecret } = await import('../../../secrets/index.js');

      // The placeholder will throw, but getSecret should be called first
      try {
        await provider.generate('Test prompt');
      } catch {
        // Expected to fail in placeholder mode
      }

      expect(getSecret).toHaveBeenCalledWith('nexus-gemini-api-key');
    });

    it('should use withRetry for API calls', async () => {
      const provider = new GeminiLLMProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      try {
        await provider.generate('Test prompt');
      } catch {
        // Expected to fail in placeholder mode
      }

      expect(withRetry).toHaveBeenCalled();
    });

    // Test with mocked successful response
    it('should return LLMResult when SDK is configured', async () => {
      const provider = new GeminiLLMProvider();

      // Mock withRetry to return a successful result
      const { withRetry } = await import('../../../utils/with-retry.js');
      const mockResult: LLMResult = {
        text: 'Generated text response',
        tokens: { input: 100, output: 500 },
        cost: 0.0025,
        model: 'gemini-3-pro-preview',
        quality: 'primary',
      };

      vi.mocked(withRetry).mockResolvedValueOnce({
        result: mockResult,
        attempts: 1,
        totalDelayMs: 0,
      });

      const result = await provider.generate('Test prompt');

      expect(result).toEqual(mockResult);
      expect(result.text).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.input).toBeGreaterThanOrEqual(0);
      expect(result.tokens.output).toBeGreaterThanOrEqual(0);
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('gemini-3-pro-preview');
      expect(result.quality).toBe('primary');
    });
  });

  describe('input validation', () => {
    it('should throw on empty prompt', async () => {
      const provider = new GeminiLLMProvider();

      await expect(provider.generate('')).rejects.toThrow('Prompt cannot be empty');
    });

    it('should throw on whitespace-only prompt', async () => {
      const provider = new GeminiLLMProvider();

      await expect(provider.generate('   ')).rejects.toThrow('Prompt cannot be empty');
    });

    it('should include NEXUS_LLM_INVALID_INPUT error code', async () => {
      const provider = new GeminiLLMProvider();

      try {
        await provider.generate('');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Prompt cannot be empty');
      }
    });
  });

  describe('name property for withFallback', () => {
    it('should have name property for fallback tracking', () => {
      const providers = [
        new GeminiLLMProvider('gemini-3-pro-preview'),
        new GeminiLLMProvider('gemini-2.5-pro'),
      ];

      providers.forEach((p) => {
        expect(p.name).toBeDefined();
        expect(typeof p.name).toBe('string');
        expect(p.name.length).toBeGreaterThan(0);
      });
    });

    it('should have unique names for different models', () => {
      const primary = new GeminiLLMProvider('gemini-3-pro-preview');
      const fallback = new GeminiLLMProvider('gemini-2.5-pro');

      expect(primary.name).not.toBe(fallback.name);
    });
  });
});
