/**
 * GCP authentication utilities for CLI
 *
 * @module @nexus-ai/operator-cli/utils/auth
 */

import { createLogger } from '@nexus-ai/core';
import { formatError } from './output.js';

const logger = createLogger('nexus.operator-cli.auth');

/**
 * Verify GCP authentication is configured
 * Users must have run: gcloud auth application-default login
 * Or set GOOGLE_APPLICATION_CREDENTIALS env var
 */
export async function verifyAuth(): Promise<void> {
  // Check for credentials file or ADC
  const credentialsPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  const adcPath =
    process.env['HOME'] &&
    `${process.env['HOME']}/.config/gcloud/application_default_credentials.json`;

  // In CI/Cloud environments, ADC is usually set up automatically
  // We do a lazy check - actual auth errors will surface when making API calls
  if (!credentialsPath && !adcPath) {
    logger.debug('No explicit credentials found, relying on default ADC');
  }

  // We don't want to block startup - let the actual API calls fail with better errors
  // This is just a debug log for troubleshooting
  logger.debug(
    {
      hasCredentialsEnv: !!credentialsPath,
      hasAdcPath: !!adcPath,
    },
    'Auth check completed'
  );
}

/**
 * Get the orchestrator URL from environment or error
 */
export function getOrchestratorUrl(): string {
  const url = process.env['NEXUS_ORCHESTRATOR_URL'];
  if (!url) {
    console.error(formatError('NEXUS_ORCHESTRATOR_URL environment variable is required'));
    console.error('Set it to the Cloud Run service URL, e.g.:');
    console.error('  export NEXUS_ORCHESTRATOR_URL=https://orchestrator-xxxxx.run.app');
    process.exit(1);
  }
  return url;
}

/**
 * Get the GCP project ID from environment or error
 */
export function getProjectId(): string {
  const projectId =
    process.env['NEXUS_PROJECT_ID'] ||
    process.env['GCP_PROJECT_ID'] ||
    process.env['GOOGLE_CLOUD_PROJECT'];
  if (!projectId) {
    console.error(formatError('GCP project ID not found'));
    console.error('Set one of: NEXUS_PROJECT_ID, GCP_PROJECT_ID, or GOOGLE_CLOUD_PROJECT');
    process.exit(1);
  }
  return projectId;
}
