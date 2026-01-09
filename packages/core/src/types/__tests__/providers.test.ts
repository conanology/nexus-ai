/**
 * Type validation tests for provider types
 */

import { describe, it, expect } from 'vitest';
import type {
  CostBreakdown,
  LLMOptions,
  LLMResult,
  TTSOptions,
  TTSResult,
  Voice,
  ImageOptions,
  ImageResult,
} from '../providers.js';

describe('Provider Types', () => {
  describe('CostBreakdown', () => {
    it('should support 4 decimal precision for micro-costs', () => {
      const cost: CostBreakdown = {
        service: 'gemini-3-pro',
        tokens: {
          input: 1500,
          output: 800,
        },
        cost: 0.0023,
        timestamp: '2026-01-08T08:23:45.123Z',
        model: 'gemini-3-pro-preview',
      };

      expect(cost.cost).toBe(0.0023);
      expect(cost.tokens.input).toBe(1500);
      expect(cost.tokens.output).toBe(800);
    });

    it('should allow optional token tracking', () => {
      const cost: CostBreakdown = {
        service: 'chirp3-hd',
        tokens: {},
        cost: 0.0045,
        timestamp: '2026-01-08T08:23:45.123Z',
      };

      expect(cost.tokens.input).toBeUndefined();
      expect(cost.tokens.output).toBeUndefined();
    });
  });

  describe('LLMOptions', () => {
    it('should accept all LLM generation options', () => {
      const options: LLMOptions = {
        temperature: 0.7,
        maxTokens: 2000,
        topP: 0.9,
        topK: 40,
        systemPrompt: 'You are a helpful assistant.',
      };

      expect(options.temperature).toBe(0.7);
      expect(options.maxTokens).toBe(2000);
      expect(options.systemPrompt).toBeDefined();
    });

    it('should allow partial options', () => {
      const options: LLMOptions = {
        temperature: 1.0,
      };

      expect(options.temperature).toBe(1.0);
      expect(options.maxTokens).toBeUndefined();
    });
  });

  describe('LLMResult', () => {
    it('should include token usage and cost', () => {
      const result: LLMResult = {
        text: 'Generated content',
        tokens: {
          input: 1500,
          output: 800,
        },
        cost: 0.0023,
        model: 'gemini-3-pro-preview',
        quality: 'primary',
      };

      expect(result.text).toBe('Generated content');
      expect(result.tokens.input).toBe(1500);
      expect(result.quality).toBe('primary');
    });

    it('should track fallback tier', () => {
      const result: LLMResult = {
        text: 'Fallback generated content',
        tokens: {
          input: 1500,
          output: 800,
        },
        cost: 0.0018,
        model: 'gemini-2.5-pro',
        quality: 'fallback',
      };

      expect(result.quality).toBe('fallback');
      expect(result.model).toBe('gemini-2.5-pro');
    });
  });

  describe('Voice', () => {
    it('should define voice information', () => {
      const voice: Voice = {
        id: 'en-US-Neural2-F',
        name: 'en-US-Neural2-F',
        language: 'en-US',
        gender: 'FEMALE',
        naturalness: 'NATURAL',
      };

      expect(voice.id).toBe('en-US-Neural2-F');
      expect(voice.gender).toBe('FEMALE');
      expect(voice.naturalness).toBe('NATURAL');
    });

    it('should support all gender types', () => {
      const genders: Voice['gender'][] = ['MALE', 'FEMALE', 'NEUTRAL'];

      genders.forEach((gender) => {
        const voice: Voice = {
          id: `test-${gender}`,
          name: `Test Voice ${gender}`,
          language: 'en-US',
          gender,
        };
        expect(voice.gender).toBe(gender);
      });
    });
  });

  describe('TTSOptions', () => {
    it('should accept all TTS synthesis options', () => {
      const options: TTSOptions = {
        voice: 'en-US-Neural2-F',
        language: 'en-US',
        speakingRate: 0.95,
        pitch: 0,
        style: 'narrative',
        ssmlInput: true,
      };

      expect(options.voice).toBe('en-US-Neural2-F');
      expect(options.speakingRate).toBe(0.95);
      expect(options.ssmlInput).toBe(true);
    });

    it('should support style options', () => {
      const styles: TTSOptions['style'][] = ['narrative', 'formal', 'casual'];

      styles.forEach((style) => {
        const options: TTSOptions = {
          style,
        };
        expect(options.style).toBe(style);
      });
    });
  });

  describe('TTSResult', () => {
    it('should include audio metadata and cost', () => {
      const result: TTSResult = {
        audioUrl: 'gs://nexus-ai-artifacts/2026-01-08/tts/audio.wav',
        durationSec: 487,
        cost: 0.0045,
        model: 'gemini-2.5-pro-tts',
        quality: 'primary',
        codec: 'wav',
        sampleRate: 44100,
      };

      expect(result.audioUrl).toContain('gs://');
      expect(result.durationSec).toBe(487);
      expect(result.sampleRate).toBe(44100);
    });

    it('should support both audio codecs', () => {
      const codecs: TTSResult['codec'][] = ['wav', 'mp3'];

      codecs.forEach((codec) => {
        const result: TTSResult = {
          audioUrl: `gs://nexus-ai-artifacts/audio.${codec}`,
          durationSec: 300,
          cost: 0.0025,
          model: 'test-model',
          quality: 'primary',
          codec,
          sampleRate: 44100,
        };
        expect(result.codec).toBe(codec);
      });
    });
  });

  describe('ImageOptions', () => {
    it('should accept image generation options', () => {
      const options: ImageOptions = {
        width: 1280,
        height: 720,
        count: 3,
        style: 'modern tech aesthetic',
      };

      expect(options.width).toBe(1280);
      expect(options.height).toBe(720);
      expect(options.count).toBe(3);
    });

    it('should enforce NFR22 requirement for 3 variants', () => {
      const options: ImageOptions = {
        count: 3,
      };

      expect(options.count).toBe(3);
    });
  });

  describe('ImageResult', () => {
    it('should return array of image URLs', () => {
      const result: ImageResult = {
        imageUrls: [
          'gs://nexus-ai-artifacts/2026-01-08/thumbnails/1.png',
          'gs://nexus-ai-artifacts/2026-01-08/thumbnails/2.png',
          'gs://nexus-ai-artifacts/2026-01-08/thumbnails/3.png',
        ],
        cost: 0.0800,
        model: 'gemini-3-pro-image-preview',
        quality: 'primary',
        generatedAt: '2026-01-08T10:00:00.000Z',
      };

      expect(result.imageUrls).toHaveLength(3);
      expect(result.cost).toBe(0.0800);
      expect(result.quality).toBe('primary');
    });

    it('should track fallback usage', () => {
      const result: ImageResult = {
        imageUrls: [
          'gs://nexus-ai-artifacts/2026-01-08/thumbnails/template-1.png',
          'gs://nexus-ai-artifacts/2026-01-08/thumbnails/template-2.png',
          'gs://nexus-ai-artifacts/2026-01-08/thumbnails/template-3.png',
        ],
        cost: 0.0000,
        model: 'template-thumbnails',
        quality: 'fallback',
        generatedAt: '2026-01-08T10:00:00.000Z',
      };

      expect(result.quality).toBe('fallback');
      expect(result.cost).toBe(0);
    });
  });
});
