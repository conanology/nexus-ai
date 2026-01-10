/**
 * Tests for ChirpProvider
 */

import { describe, it, expect, vi } from 'vitest';
import { ChirpProvider } from '../chirp-provider.js';
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

describe('ChirpProvider', () => {
  describe('constructor', () => {
    it('should have name property matching model', () => {
      const provider = new ChirpProvider('chirp3-hd');

      expect(provider.name).toBe('chirp3-hd');
    });

    it('should use default model when not specified', () => {
      const provider = new ChirpProvider();

      expect(provider.name).toBe('chirp3-hd');
    });
  });

  describe('interface compliance', () => {
    it('should implement TTSProvider interface', () => {
      const provider = new ChirpProvider();

      expect(typeof provider.synthesize).toBe('function');
      expect(typeof provider.getVoices).toBe('function');
      expect(typeof provider.estimateCost).toBe('function');
      expect(typeof provider.name).toBe('string');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on character count', () => {
      const provider = new ChirpProvider();

      const shortCost = provider.estimateCost('Hello');
      const longCost = provider.estimateCost('Hello world, this is a longer text');

      expect(shortCost).toBeGreaterThan(0);
      expect(longCost).toBeGreaterThan(shortCost);
    });

    it('should be cheaper than Gemini TTS', () => {
      const chirp = new ChirpProvider();
      const text = 'A'.repeat(1000);

      const chirpCost = chirp.estimateCost(text);

      // Chirp is $0.000012/char vs Gemini $0.000016/char
      // 1000 chars * $0.000012 = $0.012
      expect(chirpCost).toBeCloseTo(0.012, 3);
    });
  });

  describe('getVoices', () => {
    it('should return array of voices', async () => {
      const provider = new ChirpProvider();

      const voices = await provider.getVoices();

      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it('should return voices with Chirp identifiers', async () => {
      const provider = new ChirpProvider();

      const voices = await provider.getVoices();

      voices.forEach((voice: Voice) => {
        expect(voice.id).toContain('Chirp');
      });
    });
  });

  describe('synthesize', () => {
    it('should use withRetry for API calls', async () => {
      const provider = new ChirpProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      try {
        await provider.synthesize('Test text', { voice: 'en-US-Chirp3-HD-F' });
      } catch {
        // Expected in placeholder mode
      }

      expect(withRetry).toHaveBeenCalled();
    });

    it('should return TTSResult when SDK is configured', async () => {
      const provider = new ChirpProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      const mockResult: TTSResult = {
        audioUrl: 'gs://nexus-ai-artifacts/test/audio.wav',
        durationSec: 120,
        cost: 0.06,
        model: 'chirp3-hd',
        quality: 'fallback',
        codec: 'wav',
        sampleRate: 44100,
      };

      vi.mocked(withRetry).mockResolvedValueOnce({
        result: mockResult,
        attempts: 1,
        totalDelayMs: 0,
      });

      const result = await provider.synthesize('Test text', { voice: 'en-US-Chirp3-HD-F' });

      expect(result.audioUrl).toBeDefined();
      expect(result.model).toBe('chirp3-hd');
      expect(result.quality).toBe('fallback');
    });
  });

  describe('name property for withFallback', () => {
    it('should have name property for fallback tracking', () => {
      const provider = new ChirpProvider();

      expect(provider.name).toBeDefined();
      expect(typeof provider.name).toBe('string');
    });
  });
});
