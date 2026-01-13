/**
 * Secret management for NEXUS-AI with GCP Secret Manager integration
 *
 * Retrieval order:
 * 1. In-memory cache (process duration)
 * 2. Environment variable fallback (for local dev)
 * 3. GCP Secret Manager
 *
 * @module @nexus-ai/core/secrets/get-secret
 */

import { NexusError } from '../errors/index.js';
import { createLogger } from '../observability/logger.js';

// In-memory cache for secrets (persists for process duration)
const secretCache = new Map<string, string>();

// Logger for secrets module
const logger = createLogger('secrets');

// Lazy-initialized Secret Manager client (typed as unknown to avoid SDK type conflicts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let secretManagerClient: any = null;

/**
 * Lazily initialize the Secret Manager client
 * Only imports the SDK when actually needed (reduces cold start time)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSecretManagerClient(): Promise<any> {
  if (!secretManagerClient) {
    try {
      // Dynamic import to avoid loading SDK unless needed
      const { SecretManagerServiceClient } = await import(
        '@google-cloud/secret-manager'
      );
      secretManagerClient = new SecretManagerServiceClient();
    } catch (error) {
      throw NexusError.critical(
        'NEXUS_SECRET_SDK_LOAD_ERROR',
        'Failed to load Secret Manager SDK. Ensure @google-cloud/secret-manager is installed.',
        'secrets',
        { originalError: (error as Error).message }
      );
    }
  }
  return secretManagerClient;
}

/**
 * Convert secret name to environment variable format
 * nexus-gemini-api-key -> NEXUS_GEMINI_API_KEY
 */
function toEnvVarName(secretName: string): string {
  return secretName.toUpperCase().replace(/-/g, '_');
}

/**
 * Get secret value from GCP Secret Manager with caching
 *
 * Retrieval order:
 * 1. In-memory cache (fastest, persists for process duration)
 * 2. Environment variable fallback (for local development)
 * 3. GCP Secret Manager (production)
 *
 * Secret name format: kebab-case (e.g., 'nexus-gemini-api-key')
 * Environment variable format: SCREAMING_SNAKE_CASE (e.g., 'NEXUS_GEMINI_API_KEY')
 *
 * @param secretName - Secret name (e.g., 'nexus-gemini-api-key')
 * @returns Secret value
 * @throws NexusError if secret not found anywhere
 *
 * @example
 * ```typescript
 * // In production: retrieves from GCP Secret Manager
 * // In local dev: falls back to NEXUS_GEMINI_API_KEY env var
 * const apiKey = await getSecret('nexus-gemini-api-key');
 * ```
 */
export async function getSecret(secretName: string): Promise<string> {
  // 1. Check in-memory cache first (fastest path)
  const cached = secretCache.get(secretName);
  if (cached !== undefined) {
    logger.debug({ secretName, cached: true }, 'Secret cache hit');
    return cached;
  }
  logger.debug({ secretName, cached: false }, 'Secret cache miss');

  // 2. Try environment variable fallback (for local development)
  const envVarName = toEnvVarName(secretName);
  const envValue = process.env[envVarName];

  if (envValue !== undefined && envValue !== '') {
    // Cache the env var value for subsequent calls
    secretCache.set(secretName, envValue);
    logger.debug({ secretName, envVarName, source: 'environment' }, 'Secret retrieved from environment variable');
    return envValue;
  }

  // 3. Try GCP Secret Manager (production path)
  const projectId = process.env.NEXUS_PROJECT_ID;
  if (!projectId) {
    throw NexusError.critical(
      'NEXUS_SECRET_NO_PROJECT',
      `Cannot retrieve secret '${secretName}': NEXUS_PROJECT_ID not set and no environment variable ${envVarName} found`,
      'secrets',
      { secretName, envVarName }
    );
  }

  try {
    logger.debug({ secretName, projectId, source: 'secret-manager' }, 'Fetching secret from Secret Manager');
    const client = await getSecretManagerClient();
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name });

    const payload = version.payload?.data;
    if (!payload) {
      throw NexusError.critical(
        'NEXUS_SECRET_EMPTY',
        `Secret '${secretName}' exists but has no payload`,
        'secrets',
        { secretName }
      );
    }

    // Convert payload to string (may be Buffer or string)
    const value =
      typeof payload === 'string'
        ? payload
        : Buffer.from(payload).toString('utf8');

    // Cache for subsequent calls (no TTL - secrets are stable)
    secretCache.set(secretName, value);
    logger.debug({ secretName, source: 'secret-manager' }, 'Secret retrieved from Secret Manager');
    return value;
  } catch (error) {
    // Re-throw NexusError as-is
    if (error instanceof NexusError) {
      throw error;
    }

    // Wrap SDK errors
    throw NexusError.critical(
      'NEXUS_SECRET_MANAGER_ERROR',
      `Failed to retrieve secret '${secretName}': ${(error as Error).message}`,
      'secrets',
      { secretName, originalError: (error as Error).message }
    );
  }
}

/**
 * Check if a secret exists without retrieving it
 *
 * Only checks cache and environment variables (does not query Secret Manager).
 * Returns false for empty string values (consistent with getSecret behavior).
 *
 * @param secretName - Secret name to check
 * @returns true if secret exists in cache or env with non-empty value
 */
export function hasSecret(secretName: string): boolean {
  // Check cache
  if (secretCache.has(secretName)) {
    return true;
  }

  // Check environment variable (must be non-empty)
  const envVarName = toEnvVarName(secretName);
  const envValue = process.env[envVarName];
  return envValue !== undefined && envValue !== '';
}

/**
 * Clear the secret cache
 *
 * Useful for testing or when secrets need to be refreshed.
 * In production, typically only cleared on process restart.
 */
export function clearSecretCache(): void {
  secretCache.clear();
}

/**
 * Check if a secret is currently cached
 *
 * Useful for testing to verify caching behavior.
 *
 * @param secretName - Secret name to check
 * @returns true if secret is in cache
 */
export function isSecretCached(secretName: string): boolean {
  return secretCache.has(secretName);
}

/**
 * Get the current size of the secret cache
 *
 * Useful for monitoring and testing.
 *
 * @returns Number of cached secrets
 */
export function getSecretCacheSize(): number {
  return secretCache.size;
}
