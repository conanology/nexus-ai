/**
 * Gemini API health check
 *
 * Tests Gemini API availability with a minimal generation call.
 * Uses AbortController for 30-second timeout.
 *
 * @module orchestrator/health/gemini-health
 */

import { getSecret, createLogger } from '@nexus-ai/core';
import type { IndividualHealthCheck } from '@nexus-ai/core';
import { HEALTH_CHECK_TIMEOUT_MS } from '@nexus-ai/core';

const logger = createLogger('orchestrator.health.gemini');

/**
 * Check Gemini API health by performing a minimal generation call
 *
 * @returns Health check result for Gemini service
 */
export async function checkGeminiHealth(): Promise<IndividualHealthCheck> {
  const startTime = Date.now();

  try {
    logger.debug({}, 'Starting Gemini health check');

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    const checkPromise = performGeminiCheck();

    // Race between check and timeout
    await Promise.race([checkPromise, timeoutPromise]);

    const latencyMs = Date.now() - startTime;

    logger.info({
      latencyMs,
      status: 'healthy',
    }, 'Gemini health check passed');

    return {
      service: 'gemini',
      status: 'healthy',
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const isTimeout = errorMessage.includes('Timeout');

    logger.error({
      latencyMs,
      error: errorMessage,
      isTimeout,
    }, 'Gemini health check failed');

    return {
      service: 'gemini',
      status: 'failed',
      latencyMs,
      error: isTimeout ? `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms` : errorMessage,
    };
  }
}

/**
 * Perform the actual Gemini API check
 */
async function performGeminiCheck(): Promise<void> {
  // Get API key from Secret Manager
  const apiKey = await getSecret('nexus-gemini-api-key');

  // Dynamically import Gemini SDK to avoid cold start overhead
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  // Use flash model for health check (fastest, cheapest)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Minimal health check prompt
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'health check' }] }],
  });

  // Verify we got a response
  const response = result.response;
  if (!response || !response.text()) {
    throw new Error('Empty response from Gemini API');
  }
}
