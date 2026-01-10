/**
 * Secret management placeholder for NEXUS-AI
 *
 * PLACEHOLDER: Reads from environment variables for local development.
 * Story 1.6 will implement actual GCP Secret Manager integration.
 *
 * @module @nexus-ai/core/secrets/get-secret
 */

import { NexusError } from '../errors/index.js';

/**
 * Get secret value from Secret Manager or environment variable
 *
 * PLACEHOLDER: This reads from environment variables for local development.
 * Story 1.6 will implement actual GCP Secret Manager integration.
 *
 * Secret name format: kebab-case (e.g., 'nexus-gemini-api-key')
 * Environment variable format: SCREAMING_SNAKE_CASE (e.g., 'NEXUS_GEMINI_API_KEY')
 *
 * @param secretName - Secret name (e.g., 'nexus-gemini-api-key')
 * @returns Secret value
 * @throws NexusError if secret not found
 *
 * @example
 * ```typescript
 * const apiKey = await getSecret('nexus-gemini-api-key');
 * // Reads from NEXUS_GEMINI_API_KEY environment variable
 * ```
 */
export async function getSecret(secretName: string): Promise<string> {
  // Convert secret name to env var format
  // nexus-gemini-api-key -> NEXUS_GEMINI_API_KEY
  const envVarName = secretName.toUpperCase().replace(/-/g, '_');

  const value = process.env[envVarName];

  if (!value) {
    // TODO: Story 1.6 - Replace with structured logger when implemented
    // logger.warn('Secret not found', { secretName, envVarName, stage: 'secrets' });

    throw NexusError.critical(
      'NEXUS_SECRET_NOT_FOUND',
      `Secret '${secretName}' not found. Set environment variable ${envVarName}.`,
      'secrets',
      { secretName, envVarName }
    );
  }

  return value;
}

/**
 * Check if a secret exists without retrieving it
 *
 * @param secretName - Secret name to check
 * @returns true if secret exists
 */
export function hasSecret(secretName: string): boolean {
  const envVarName = secretName.toUpperCase().replace(/-/g, '_');
  return process.env[envVarName] !== undefined;
}
