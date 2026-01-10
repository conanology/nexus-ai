/**
 * Tests for Provider Registry
 */

import { describe, it, expect } from 'vitest';
import { createProviderRegistry, getAllProviders } from '../registry.js';
import { GeminiLLMProvider } from '../llm/gemini-llm-provider.js';
import { GeminiTTSProvider } from '../tts/gemini-tts-provider.js';
import { ChirpProvider } from '../tts/chirp-provider.js';
import { WaveNetProvider } from '../tts/wavenet-provider.js';
import { GeminiImageProvider } from '../image/gemini-image-provider.js';
import { TemplateThumbnailer } from '../image/template-thumbnailer.js';

describe('createProviderRegistry', () => {
  describe('registry structure', () => {
    it('should create registry with all provider types', () => {
      const registry = createProviderRegistry();

      expect(registry.llm).toBeDefined();
      expect(registry.tts).toBeDefined();
      expect(registry.image).toBeDefined();
    });

    it('should have primary and fallbacks for each type', () => {
      const registry = createProviderRegistry();

      expect(registry.llm.primary).toBeDefined();
      expect(registry.llm.fallbacks).toBeDefined();
      expect(Array.isArray(registry.llm.fallbacks)).toBe(true);

      expect(registry.tts.primary).toBeDefined();
      expect(registry.tts.fallbacks).toBeDefined();
      expect(Array.isArray(registry.tts.fallbacks)).toBe(true);

      expect(registry.image.primary).toBeDefined();
      expect(registry.image.fallbacks).toBeDefined();
      expect(Array.isArray(registry.image.fallbacks)).toBe(true);
    });
  });

  describe('LLM providers', () => {
    it('should have GeminiLLMProvider as primary', () => {
      const registry = createProviderRegistry();

      expect(registry.llm.primary).toBeInstanceOf(GeminiLLMProvider);
      expect(registry.llm.primary.name).toBe('gemini-3-pro-preview');
    });

    it('should have 1 LLM fallback', () => {
      const registry = createProviderRegistry();

      expect(registry.llm.fallbacks).toHaveLength(1);
    });

    it('should have Gemini 2.5 Pro as LLM fallback', () => {
      const registry = createProviderRegistry();

      expect(registry.llm.fallbacks[0]).toBeInstanceOf(GeminiLLMProvider);
      expect(registry.llm.fallbacks[0].name).toBe('gemini-2.5-pro');
    });
  });

  describe('TTS providers', () => {
    it('should have GeminiTTSProvider as primary', () => {
      const registry = createProviderRegistry();

      expect(registry.tts.primary).toBeInstanceOf(GeminiTTSProvider);
      expect(registry.tts.primary.name).toBe('gemini-2.5-pro-tts');
    });

    it('should have 2 TTS fallbacks', () => {
      const registry = createProviderRegistry();

      expect(registry.tts.fallbacks).toHaveLength(2);
    });

    it('should have Chirp as first TTS fallback', () => {
      const registry = createProviderRegistry();

      expect(registry.tts.fallbacks[0]).toBeInstanceOf(ChirpProvider);
      expect(registry.tts.fallbacks[0].name).toBe('chirp3-hd');
    });

    it('should have WaveNet as second TTS fallback', () => {
      const registry = createProviderRegistry();

      expect(registry.tts.fallbacks[1]).toBeInstanceOf(WaveNetProvider);
      expect(registry.tts.fallbacks[1].name).toBe('wavenet');
    });
  });

  describe('Image providers', () => {
    it('should have GeminiImageProvider as primary', () => {
      const registry = createProviderRegistry();

      expect(registry.image.primary).toBeInstanceOf(GeminiImageProvider);
      expect(registry.image.primary.name).toBe('gemini-3-pro-image-preview');
    });

    it('should have 1 image fallback', () => {
      const registry = createProviderRegistry();

      expect(registry.image.fallbacks).toHaveLength(1);
    });

    it('should have TemplateThumbnailer as image fallback', () => {
      const registry = createProviderRegistry();

      expect(registry.image.fallbacks[0]).toBeInstanceOf(TemplateThumbnailer);
      expect(registry.image.fallbacks[0].name).toBe('template-thumbnailer');
    });
  });

  describe('provider name properties', () => {
    it('should have all providers with name property', () => {
      const registry = createProviderRegistry();

      // LLM providers
      expect(registry.llm.primary.name).toBeDefined();
      registry.llm.fallbacks.forEach((p) => expect(p.name).toBeDefined());

      // TTS providers
      expect(registry.tts.primary.name).toBeDefined();
      registry.tts.fallbacks.forEach((p) => expect(p.name).toBeDefined());

      // Image providers
      expect(registry.image.primary.name).toBeDefined();
      registry.image.fallbacks.forEach((p) => expect(p.name).toBeDefined());
    });

    it('should have unique names within each provider type', () => {
      const registry = createProviderRegistry();

      const llmNames = [registry.llm.primary.name, ...registry.llm.fallbacks.map((p) => p.name)];
      const ttsNames = [registry.tts.primary.name, ...registry.tts.fallbacks.map((p) => p.name)];
      const imageNames = [
        registry.image.primary.name,
        ...registry.image.fallbacks.map((p) => p.name),
      ];

      expect(new Set(llmNames).size).toBe(llmNames.length);
      expect(new Set(ttsNames).size).toBe(ttsNames.length);
      expect(new Set(imageNames).size).toBe(imageNames.length);
    });
  });
});

describe('getAllProviders', () => {
  it('should return flat array starting with primary', () => {
    const registry = createProviderRegistry();
    const allTTS = getAllProviders(registry.tts);

    expect(allTTS[0]).toBe(registry.tts.primary);
    expect(allTTS[1]).toBe(registry.tts.fallbacks[0]);
    expect(allTTS[2]).toBe(registry.tts.fallbacks[1]);
  });

  it('should include all providers', () => {
    const registry = createProviderRegistry();

    const allLLM = getAllProviders(registry.llm);
    expect(allLLM).toHaveLength(2);

    const allTTS = getAllProviders(registry.tts);
    expect(allTTS).toHaveLength(3);

    const allImage = getAllProviders(registry.image);
    expect(allImage).toHaveLength(2);
  });

  it('should work with withFallback pattern', () => {
    const registry = createProviderRegistry();
    const allProviders = getAllProviders(registry.tts);

    // Should be usable directly with withFallback
    expect(allProviders.every((p) => typeof p.name === 'string')).toBe(true);
    expect(allProviders.every((p) => typeof p.synthesize === 'function')).toBe(true);
  });
});
