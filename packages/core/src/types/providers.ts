/**
 * Provider interfaces for NEXUS-AI
 * Abstractions for LLM, TTS, and Image generation services
 */

/**
 * Cost breakdown for API calls
 * Supports 4 decimal precision for micro-costs (e.g., $0.0023)
 */
export interface CostBreakdown {
  /** API service name (e.g., "gemini-3-pro") */
  service: string;
  /** Token usage (LLM only) */
  tokens: {
    /** Input tokens */
    input?: number;
    /** Output tokens */
    output?: number;
  };
  /** Cost in USD (4 decimal precision) */
  cost: number;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
  /** Model name if applicable */
  model?: string;
}

/**
 * LLM generation options
 */
export interface LLMOptions {
  /** Temperature (0-2, default 1) */
  temperature?: number;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Nucleus sampling (0-1) */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** System instructions */
  systemPrompt?: string;
}

/**
 * LLM generation result
 */
export interface LLMResult {
  /** Generated text content */
  text: string;
  /** Token usage */
  tokens: {
    /** Input tokens */
    input: number;
    /** Output tokens */
    output: number;
  };
  /** Cost in USD (4 decimal precision) */
  cost: number;
  /** Model identifier */
  model: string;
  /** Provider tier used */
  quality: 'primary' | 'fallback';
}

/**
 * Large Language Model provider interface
 */
export interface LLMProvider {
  /**
   * Generate text from prompt
   * @param prompt - Input prompt
   * @param options - Generation options
   * @returns Generated text with metadata
   */
  generate(prompt: string, options?: LLMOptions): Promise<LLMResult>;

  /**
   * Estimate cost before making call
   * @param prompt - Input prompt
   * @returns Estimated cost in USD
   */
  estimateCost(prompt: string): number;
}

/**
 * Voice information
 */
export interface Voice {
  /** Voice identifier */
  id: string;
  /** Display name */
  name: string;
  /** BCP 47 language code */
  language: string;
  /** Voice gender */
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  /** Naturalness level */
  naturalness?: 'NATURAL' | 'STANDARD';
}

/**
 * Text-to-Speech synthesis options
 */
export interface TTSOptions {
  /** Voice ID (e.g., "en-US-Neural2-F") */
  voice?: string;
  /** BCP 47 language code (e.g., "en-US") */
  language?: string;
  /** Speaking rate (0.25-4.0, default 1.0) */
  speakingRate?: number;
  /** Pitch adjustment (-20 to 20, default 0) */
  pitch?: number;
  /** Speaking style */
  style?: 'narrative' | 'formal' | 'casual';
  /** Whether input text contains SSML tags */
  ssmlInput?: boolean;
}

/**
 * Text-to-Speech synthesis result
 */
export interface TTSResult {
  /** GCS path to audio file */
  audioUrl: string;
  /** Audio duration in seconds */
  durationSec: number;
  /** Cost in USD */
  cost: number;
  /** Model identifier */
  model: string;
  /** Provider tier used */
  quality: 'primary' | 'fallback';
  /** Audio codec */
  codec: 'wav' | 'mp3';
  /** Sample rate in Hz */
  sampleRate: number;
}

/**
 * Text-to-Speech provider interface
 */
export interface TTSProvider {
  /**
   * Synthesize text to audio
   * @param text - Text to synthesize (may contain SSML)
   * @param options - Synthesis options
   * @returns Audio file reference with metadata
   */
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;

  /**
   * Get available voices
   * @returns List of available voices
   */
  getVoices(): Promise<Voice[]>;

  /**
   * Estimate cost before synthesis
   * @param text - Text to synthesize
   * @returns Estimated cost in USD
   */
  estimateCost(text: string): number;
}

/**
 * Image generation options
 */
export interface ImageOptions {
  /** Image width in pixels (default: 1280 for YouTube) */
  width?: number;
  /** Image height in pixels (default: 720 for YouTube) */
  height?: number;
  /** Number of variants to generate (NFR22: must be 3) */
  count?: number;
  /** Art style description */
  style?: string;
}

/**
 * Image generation result
 */
export interface ImageResult {
  /** Array of GCS paths to generated images */
  imageUrls: string[];
  /** Total cost for all variants */
  cost: number;
  /** Model identifier */
  model: string;
  /** Provider tier used */
  quality: 'primary' | 'fallback';
  /** ISO 8601 UTC generation timestamp */
  generatedAt: string;
}

/**
 * Image generation provider interface
 */
export interface ImageProvider {
  /**
   * Generate images from text prompt
   * @param prompt - Text description
   * @param options - Generation options
   * @returns Generated image references with metadata
   */
  generate(prompt: string, options: ImageOptions): Promise<ImageResult>;

  /**
   * Estimate cost before generation
   * @param prompt - Text description
   * @param options - Generation options (count affects total cost)
   * @returns Estimated cost in USD
   */
  estimateCost(prompt: string, options?: ImageOptions): number;
}
