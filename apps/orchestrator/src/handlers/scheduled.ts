// Cloud Scheduler trigger handler

import type { Request, Response } from 'express';
import { createLogger } from '@nexus-ai/core';
import { executePipeline } from '../pipeline.js';

const logger = createLogger('orchestrator.handlers.scheduled');

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
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.length < 10) {
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

  // Execute pipeline asynchronously - don't wait for completion
  // Cloud Run will keep the request open, but we respond immediately
  // to avoid Cloud Scheduler timeout issues
  executePipeline(pipelineId)
    .then((result) => {
      logger.info({
        pipelineId,
        success: result.success,
        status: result.status,
        completedStages: result.completedStages.length,
        totalDurationMs: result.totalDurationMs,
      }, 'Scheduled pipeline completed');
    })
    .catch((error) => {
      logger.error({
        pipelineId,
        error: error.message,
      }, 'Scheduled pipeline failed unexpectedly');
    });

  // Return immediately with 202 Accepted
  res.status(202).json({
    message: 'Pipeline execution started',
    pipelineId,
    status: 'accepted',
  });
}
