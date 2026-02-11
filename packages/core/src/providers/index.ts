/**
 * Provider exports
 * @module @nexus-ai/core/providers
 */

// LLM Providers
export { GeminiLLMProvider } from './llm/gemini-llm-provider.js';

// TTS Providers
export { GeminiTTSProvider } from './tts/gemini-tts-provider.js';
export { ChirpProvider } from './tts/chirp-provider.js';
export { WaveNetProvider } from './tts/wavenet-provider.js';

// Local-mode TTS Providers (no GCP billing required)
export { AIStudioTTSProvider } from './tts/aistudio-tts-provider.js';
export { EdgeTTSProvider } from './tts/edge-tts-provider.js';

// Image Providers
export { GeminiImageProvider } from './image/gemini-image-provider.js';
export { TemplateThumbnailer } from './image/template-thumbnailer.js';

// Registry
export {
  createProviderRegistry,
  getAllProviders,
  type ProviderChain,
  type ProviderRegistry,
} from './registry.js';
