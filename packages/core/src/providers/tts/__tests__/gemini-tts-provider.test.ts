/**
 * Tests for GeminiTTSProvider
 */

import { describe, it, expect, vi } from 'vitest';
import { GeminiTTSProvider } from '../gemini-tts-provider.js';
import type { TTSResult, Voice } from '../../../types/providers.js';

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

describe('GeminiTTSProvider', () => {
  describe('constructor', () => {
    it('should have name property matching model', () => {
      const provider = new GeminiTTSProvider('gemini-2.5-pro-tts');

      expect(provider.name).toBe('gemini-2.5-pro-tts');
    });

    it('should use default model when not specified', () => {
      const provider = new GeminiTTSProvider();

      expect(provider.name).toBe('gemini-2.5-pro-tts');
    });
  });

  describe('interface compliance', () => {
    it('should implement TTSProvider interface', () => {
      const provider = new GeminiTTSProvider();

      expect(typeof provider.synthesize).toBe('function');
      expect(typeof provider.getVoices).toBe('function');
      expect(typeof provider.estimateCost).toBe('function');
      expect(typeof provider.name).toBe('string');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on character count', () => {
      const provider = new GeminiTTSProvider();

      const shortCost = provider.estimateCost('Hello');
      const longCost = provider.estimateCost('Hello world, this is a longer text');

      expect(shortCost).toBeGreaterThan(0);
      expect(longCost).toBeGreaterThan(shortCost);
    });

    it('should return reasonable estimates for typical text', () => {
      const provider = new GeminiTTSProvider();

      // Typical script (~5000 chars)
      const text = 'A'.repeat(5000);
      const cost = provider.estimateCost(text);

      // 5000 chars * $0.000016/char = $0.08
      expect(cost).toBeCloseTo(0.08, 2);
    });

    it('should handle empty text', () => {
      const provider = new GeminiTTSProvider();

      const cost = provider.estimateCost('');

      expect(cost).toBe(0);
    });
  });

  describe('getVoices', () => {
    it('should return array of voices', async () => {
      const provider = new GeminiTTSProvider();

      const voices = await provider.getVoices();

      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it('should return voices with correct structure', async () => {
      const provider = new GeminiTTSProvider();

      const voices = await provider.getVoices();

      voices.forEach((voice: Voice) => {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.language).toBeDefined();
        expect(['MALE', 'FEMALE', 'NEUTRAL']).toContain(voice.gender);
      });
    });
  });

  describe('synthesize', () => {
    it('should call getSecret for API key', async () => {
      const provider = new GeminiTTSProvider();
      const { getSecret } = await import('../../../secrets/index.js');

      try {
        await provider.synthesize('Test text', { voice: 'en-US-Neural2-F' });
      } catch {
        // Expected in placeholder mode
      }

      expect(getSecret).toHaveBeenCalledWith('nexus-gemini-api-key');
    });

    it('should use withRetry for API calls', async () => {
      const provider = new GeminiTTSProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      try {
        await provider.synthesize('Test text', { voice: 'en-US-Neural2-F' });
      } catch {
        // Expected in placeholder mode
      }

      expect(withRetry).toHaveBeenCalled();
    });

    it('should return TTSResult when SDK is configured', async () => {
      const provider = new GeminiTTSProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      const mockResult: TTSResult = {
        audioUrl: 'gs://nexus-ai-artifacts/test/audio.wav',
        durationSec: 120,
        cost: 0.08,
        model: 'gemini-2.5-pro-tts',
        quality: 'primary',
        codec: 'wav',
        sampleRate: 44100,
      };

      vi.mocked(withRetry).mockResolvedValueOnce({
        result: mockResult,
        attempts: 1,
        totalDelayMs: 0,
      });

      const result = await provider.synthesize('Test text', { voice: 'en-US-Neural2-F' });

      expect(result.audioUrl).toBeDefined();
      expect(result.durationSec).toBeGreaterThanOrEqual(0);
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.model).toBe('gemini-2.5-pro-tts');
      expect(result.quality).toBe('primary');
      expect(result.codec).toBe('wav');
      expect(result.sampleRate).toBe(44100);
    });
  });

  describe('input validation', () => {
    it('should throw on empty text', async () => {
      const provider = new GeminiTTSProvider();

      await expect(provider.synthesize('', { voice: 'en-US-Neural2-F' })).rejects.toThrow(
        'Text to synthesize cannot be empty'
      );
    });

    it('should throw on whitespace-only text', async () => {
      const provider = new GeminiTTSProvider();

      await expect(provider.synthesize('   ', { voice: 'en-US-Neural2-F' })).rejects.toThrow(
        'Text to synthesize cannot be empty'
      );
    });
  });

  describe('name property for withFallback', () => {
    it('should have name property for fallback tracking', () => {
      const provider = new GeminiTTSProvider();

      expect(provider.name).toBeDefined();
      expect(typeof provider.name).toBe('string');
      expect(provider.name.length).toBeGreaterThan(0);
    });
  });
});
