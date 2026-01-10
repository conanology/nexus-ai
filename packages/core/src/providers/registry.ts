/**
 * Provider Registry - Factory for creating provider chains
 *
 * Defines primary providers and their fallback chains for each service type.
 * Used by stages with withFallback for automatic failover.
 *
 * @module @nexus-ai/core/providers/registry
 */

import type { LLMProvider, TTSProvider, ImageProvider } from '../types/providers.js';
import { GeminiLLMProvider } from './llm/gemini-llm-provider.js';
import { GeminiTTSProvider } from './tts/gemini-tts-provider.js';
import { ChirpProvider } from './tts/chirp-provider.js';
import { WaveNetProvider } from './tts/wavenet-provider.js';
import { GeminiImageProvider } from './image/gemini-image-provider.js';
import { TemplateThumbnailer } from './image/template-thumbnailer.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Provider chain with primary and fallback providers
 */
export interface ProviderChain<T> {
  /** Primary provider (first choice) */
  primary: T;
  /** Fallback providers in priority order */
  fallbacks: T[];
}

/**
 * Complete provider registry for all service types
 */
export interface ProviderRegistry {
  /** LLM providers (script generation, research) */
  llm: ProviderChain<LLMProvider>;
  /** TTS providers (voice synthesis) */
  tts: ProviderChain<TTSProvider>;
  /** Image providers (thumbnail generation) */
  image: ProviderChain<ImageProvider>;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a provider registry with default configuration
 *
 * Returns a registry with:
 * - LLM: Gemini 3 Pro (primary) → Gemini 2.5 Pro (fallback)
 * - TTS: Gemini TTS (primary) → Chirp 3 HD → WaveNet (fallbacks)
 * - Image: Gemini Image (primary) → Template Thumbnailer (fallback)
 *
 * @returns Configured provider registry
 *
 * @example
 * ```typescript
 * const registry = createProviderRegistry();
 *
 * // Use with withFallback
 * const allTTSProviders = [registry.tts.primary, ...registry.tts.fallbacks];
 * const result = await withFallback(
 *   allTTSProviders,
 *   (p) => p.synthesize(text, options),
 *   { stage: 'tts' }
 * );
 * ```
 */
export function createProviderRegistry(): ProviderRegistry {
  return {
    llm: {
      primary: new GeminiLLMProvider('gemini-3-pro-preview'),
      fallbacks: [new GeminiLLMProvider('gemini-2.5-pro')],
    },
    tts: {
      primary: new GeminiTTSProvider('gemini-2.5-pro-tts'),
      fallbacks: [new ChirpProvider(), new WaveNetProvider()],
    },
    image: {
      primary: new GeminiImageProvider('gemini-3-pro-image-preview'),
      fallbacks: [new TemplateThumbnailer()],
    },
  };
}

/**
 * Get all providers for a service type as a flat array
 *
 * Convenience function for use with withFallback.
 *
 * @param chain - Provider chain to flatten
 * @returns Array of [primary, ...fallbacks]
 *
 * @example
 * ```typescript
 * const registry = createProviderRegistry();
 * const allProviders = getAllProviders(registry.tts);
 * // [GeminiTTSProvider, ChirpProvider, WaveNetProvider]
 * ```
 */
export function getAllProviders<T>(chain: ProviderChain<T>): T[] {
  return [chain.primary, ...chain.fallbacks];
}
