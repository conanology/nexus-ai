// Manual trigger handler

import type { Request, Response } from 'express';
import { logger } from '@nexus-ai/core';

/**
 * Handles manual pipeline triggers
 * Allows optional date override for testing or re-running specific dates
 */
export async function handleManualTrigger(
  req: Request,
  res: Response
): Promise<void> {
  // Optional: specific date override
  const pipelineId =
    req.body?.date || new Date().toISOString().split('T')[0];

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pipelineId)) {
    logger.warn({
      providedDate: req.body?.date,
    }, 'Invalid date format in manual trigger');
    res.status(400).json({
      error: 'Invalid date format. Use YYYY-MM-DD',
    });
    return;
  }

  logger.info({
    pipelineId,
    source: 'manual',
  }, 'Manual pipeline trigger received');

  // Pipeline execution will be implemented in Story 5.2
  res.status(200).json({
    message: 'Pipeline triggered',
    pipelineId,
    note: 'Pipeline execution not yet implemented (Story 5.2)',
  });
}
