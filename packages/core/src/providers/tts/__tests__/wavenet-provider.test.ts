/**
 * Tests for WaveNetProvider
 */

import { describe, it, expect, vi } from 'vitest';
import { WaveNetProvider } from '../wavenet-provider.js';
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

describe('WaveNetProvider', () => {
  describe('constructor', () => {
    it('should have name property matching model', () => {
      const provider = new WaveNetProvider('wavenet');

      expect(provider.name).toBe('wavenet');
    });

    it('should use default model when not specified', () => {
      const provider = new WaveNetProvider();

      expect(provider.name).toBe('wavenet');
    });
  });

  describe('interface compliance', () => {
    it('should implement TTSProvider interface', () => {
      const provider = new WaveNetProvider();

      expect(typeof provider.synthesize).toBe('function');
      expect(typeof provider.getVoices).toBe('function');
      expect(typeof provider.estimateCost).toBe('function');
      expect(typeof provider.name).toBe('string');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on character count', () => {
      const provider = new WaveNetProvider();

      const shortCost = provider.estimateCost('Hello');
      const longCost = provider.estimateCost('Hello world, this is a longer text');

      expect(shortCost).toBeGreaterThan(0);
      expect(longCost).toBeGreaterThan(shortCost);
    });

    it('should be cheapest TTS option', () => {
      const wavenet = new WaveNetProvider();
      const text = 'A'.repeat(1000);

      const wavenetCost = wavenet.estimateCost(text);

      // WaveNet is $0.000004/char
      // 1000 chars * $0.000004 = $0.004
      expect(wavenetCost).toBeCloseTo(0.004, 4);
    });
  });

  describe('getVoices', () => {
    it('should return array of voices', async () => {
      const provider = new WaveNetProvider();

      const voices = await provider.getVoices();

      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it('should return voices with WaveNet identifiers', async () => {
      const provider = new WaveNetProvider();

      const voices = await provider.getVoices();

      voices.forEach((voice: Voice) => {
        expect(voice.id).toContain('Wavenet');
      });
    });

    it('should mark voices as STANDARD naturalness', async () => {
      const provider = new WaveNetProvider();

      const voices = await provider.getVoices();

      voices.forEach((voice: Voice) => {
        expect(voice.naturalness).toBe('STANDARD');
      });
    });
  });

  describe('synthesize', () => {
    it('should use withRetry for API calls', async () => {
      const provider = new WaveNetProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      try {
        await provider.synthesize('Test text', { voice: 'en-US-Wavenet-F' });
      } catch {
        // Expected in placeholder mode
      }

      expect(withRetry).toHaveBeenCalled();
    });

    it('should return TTSResult when SDK is configured', async () => {
      const provider = new WaveNetProvider();
      const { withRetry } = await import('../../../utils/with-retry.js');

      const mockResult: TTSResult = {
        audioUrl: 'gs://nexus-ai-artifacts/test/audio.wav',
        durationSec: 120,
        cost: 0.02,
        model: 'wavenet',
        quality: 'fallback',
        codec: 'wav',
        sampleRate: 24000,
      };

      vi.mocked(withRetry).mockResolvedValueOnce({
        result: mockResult,
        attempts: 1,
        totalDelayMs: 0,
      });

      const result = await provider.synthesize('Test text', { voice: 'en-US-Wavenet-F' });

      expect(result.audioUrl).toBeDefined();
      expect(result.model).toBe('wavenet');
      expect(result.quality).toBe('fallback');
    });
  });

  describe('name property for withFallback', () => {
    it('should have name property for fallback tracking', () => {
      const provider = new WaveNetProvider();

      expect(provider.name).toBeDefined();
      expect(typeof provider.name).toBe('string');
    });
  });
});
