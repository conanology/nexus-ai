// Cloud Scheduler trigger handler

import type { Request, Response } from 'express';
import { logger } from '@nexus-ai/core';

/**
 * Handles scheduled pipeline triggers from Cloud Scheduler
 * Note: Story 5.12 will configure Cloud Scheduler with OIDC authentication
 */
export async function handleScheduledTrigger(
  req: Request,
  res: Response
): Promise<void> {
  // Verify request is from Cloud Scheduler (basic auth check)
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn({
      ip: req.ip,
      headers: req.headers,
    }, 'Unauthorized scheduled trigger attempt');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Generate pipeline ID from current date
  const pipelineId = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  logger.info({
    pipelineId,
    source: 'cloud-scheduler',
  }, 'Scheduled pipeline trigger received');

  // Pipeline execution will be implemented in Story 5.2
  // For now, return success
  res.status(200).json({
    message: 'Pipeline scheduled',
    pipelineId,
    note: 'Pipeline execution not yet implemented (Story 5.2)',
  });
}
