/**
 * Gemini LLM Provider implementation
 * Primary LLM provider for NEXUS-AI pipeline
 *
 * @module @nexus-ai/core/providers/llm/gemini-llm-provider
 */

import type { LLMProvider, LLMOptions, LLMResult } from '../../types/providers.js';
import { withRetry } from '../../utils/with-retry.js';
import { NexusError } from '../../errors/index.js';
import { getSecret } from '../../secrets/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// =============================================================================
// Constants
// =============================================================================

/** Default model for LLM generation */
const DEFAULT_MODEL = 'gemini-3-pro-preview';

/** Approximate characters per token for estimation */
const CHARS_PER_TOKEN = 4;

/** Default estimated output tokens for cost calculation */
const DEFAULT_OUTPUT_TOKENS = 2000;

/**
 * Pricing per 1K tokens (Gemini 3 Pro)
 * Based on Google AI pricing as of 2026
 */
const PRICING = {
  inputPer1K: 0.00125, // $0.00125 per 1K input tokens
  outputPer1K: 0.005, // $0.005 per 1K output tokens
};

// =============================================================================
// GeminiLLMProvider
// =============================================================================

/**
 * Gemini LLM Provider
 *
 * Implements the LLMProvider interface using Google's Gemini models.
 * Supports gemini-3-pro-preview (primary) and gemini-2.5-pro (fallback).
 *
 * @example
 * ```typescript
 * const provider = new GeminiLLMProvider('gemini-3-pro-preview');
 * const result = await provider.generate('Write a script about AI');
 * console.log(result.text);
 * ```
 */
export class GeminiLLMProvider implements LLMProvider {
  /** Provider name for withFallback tracking */
  readonly name: string;

  /** Model identifier */
  private readonly model: string;

  /**
   * Create a new Gemini LLM provider
   * @param model - Model name (default: 'gemini-3-pro-preview')
   */
  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
    this.name = model; // Name matches model for tracking
  }

  /**
   * Generate text from a prompt
   *
   * Uses withRetry internally for resilience against transient failures.
   * All API calls go through the retry wrapper.
   *
   * @param prompt - Input prompt
   * @param options - Generation options
   * @returns LLMResult with generated text and metadata
   */
  async generate(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    // Validate input
    if (!prompt || prompt.trim().length === 0) {
      throw NexusError.critical(
        'NEXUS_LLM_INVALID_INPUT',
        'Prompt cannot be empty',
        'llm',
        { promptLength: prompt?.length ?? 0 }
      );
    }

    const apiKey = await getSecret('nexus-gemini-api-key');

    const retryResult = await withRetry(
      async () => {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: this.model });

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options?.temperature ?? 0.7,
              maxOutputTokens: options?.maxTokens ?? 8192,
              topP: options?.topP,
              topK: options?.topK,
            },
            systemInstruction: options?.systemPrompt,
          });

          const response = result.response;
          const text = response.text();

          // Extract token usage from response metadata
          const usageMetadata = response.usageMetadata;
          const inputTokens = usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / CHARS_PER_TOKEN);
          const outputTokens = usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / CHARS_PER_TOKEN);

          // Calculate cost
          const inputCost = (inputTokens / 1000) * PRICING.inputPer1K;
          const outputCost = (outputTokens / 1000) * PRICING.outputPer1K;
          const totalCost = Number((inputCost + outputCost).toFixed(4));

          return {
            text,
            tokens: {
              input: inputTokens,
              output: outputTokens,
            },
            cost: totalCost,
            model: this.model,
            quality: 'primary' as const,
          };
        } catch (error) {
          // Re-throw NexusErrors as-is
          if (error instanceof NexusError) {
            throw error;
          }

          // Wrap SDK errors
          throw NexusError.fromError(error, 'llm');
        }
      },
      {
        maxRetries: 3,
        stage: 'llm',
        baseDelay: 1000,
        maxDelay: 30000,
      }
    );

    return retryResult.result;
  }

  /**
   * Estimate cost before making the API call
   *
   * Useful for budgeting and pre-flight cost checks.
   * Uses character count to estimate tokens.
   *
   * @param prompt - Input prompt
   * @returns Estimated cost in USD
   */
  estimateCost(prompt: string): number {
    // Estimate input tokens from character count
    const estimatedInputTokens = Math.ceil(prompt.length / CHARS_PER_TOKEN);

    // Use default output estimate (typical script length)
    const estimatedOutputTokens = DEFAULT_OUTPUT_TOKENS;

    // Calculate cost
    const inputCost = (estimatedInputTokens / 1000) * PRICING.inputPer1K;
    const outputCost = (estimatedOutputTokens / 1000) * PRICING.outputPer1K;

    // Return total with 4 decimal precision
    return Number((inputCost + outputCost).toFixed(4));
  }
}
