// Manual trigger handler

import type { Request, Response } from 'express';
import { createLogger } from '@nexus-ai/core';
import { executePipeline, resumePipeline } from '../pipeline.js';

const logger = createLogger('orchestrator.handlers.manual');

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

  // Check if this is a sync or async request
  const waitForCompletion = req.body?.wait === true;

  logger.info({
    pipelineId,
    source: 'manual',
    waitForCompletion,
  }, 'Manual pipeline trigger received');

  if (waitForCompletion) {
    // Synchronous execution - wait for pipeline to complete
    try {
      const result = await executePipeline(pipelineId);

      logger.info({
        pipelineId,
        success: result.success,
        status: result.status,
        completedStages: result.completedStages.length,
        totalDurationMs: result.totalDurationMs,
      }, 'Manual pipeline completed');

      res.status(result.success ? 200 : 500).json({
        message: result.success ? 'Pipeline completed' : 'Pipeline failed',
        pipelineId,
        status: result.status,
        completedStages: result.completedStages,
        skippedStages: result.skippedStages,
        totalDurationMs: result.totalDurationMs,
        totalCost: result.totalCost,
        qualityContext: result.qualityContext,
        error: result.error,
      });
    } catch (error) {
      logger.error({
        pipelineId,
        error: (error as Error).message,
      }, 'Manual pipeline failed unexpectedly');

      res.status(500).json({
        message: 'Pipeline execution failed',
        pipelineId,
        error: (error as Error).message,
      });
    }
  } else {
    // Asynchronous execution - return immediately
    executePipeline(pipelineId)
      .then((result) => {
        logger.info({
          pipelineId,
          success: result.success,
          status: result.status,
          completedStages: result.completedStages.length,
          totalDurationMs: result.totalDurationMs,
        }, 'Manual pipeline completed (async)');
      })
      .catch((error) => {
        logger.error({
          pipelineId,
          error: error.message,
        }, 'Manual pipeline failed unexpectedly');
      });

    res.status(202).json({
      message: 'Pipeline execution started',
      pipelineId,
      status: 'accepted',
    });
  }
}

/**
 * Handles pipeline resume requests
 * Resumes a failed or paused pipeline from a specific stage
 */
export async function handleResumeTrigger(
  req: Request,
  res: Response
): Promise<void> {
  const pipelineId = req.body?.pipelineId;
  const fromStage = req.body?.fromStage;

  // Validate pipeline ID
  if (!pipelineId || !/^\d{4}-\d{2}-\d{2}$/.test(pipelineId)) {
    logger.warn({
      providedPipelineId: pipelineId,
    }, 'Invalid or missing pipeline ID in resume request');
    res.status(400).json({
      error: 'Valid pipelineId required in format YYYY-MM-DD',
    });
    return;
  }

  // Check if this is a sync or async request
  const waitForCompletion = req.body?.wait === true;

  logger.info({
    pipelineId,
    fromStage,
    source: 'resume',
    waitForCompletion,
  }, 'Pipeline resume trigger received');

  if (waitForCompletion) {
    try {
      const result = await resumePipeline(pipelineId, fromStage);

      logger.info({
        pipelineId,
        success: result.success,
        status: result.status,
        completedStages: result.completedStages.length,
        totalDurationMs: result.totalDurationMs,
      }, 'Pipeline resume completed');

      res.status(result.success ? 200 : 500).json({
        message: result.success ? 'Pipeline resumed and completed' : 'Pipeline resume failed',
        pipelineId,
        status: result.status,
        completedStages: result.completedStages,
        skippedStages: result.skippedStages,
        totalDurationMs: result.totalDurationMs,
        totalCost: result.totalCost,
        qualityContext: result.qualityContext,
        error: result.error,
      });
    } catch (error) {
      logger.error({
        pipelineId,
        fromStage,
        error: (error as Error).message,
      }, 'Pipeline resume failed unexpectedly');

      res.status(500).json({
        message: 'Pipeline resume failed',
        pipelineId,
        error: (error as Error).message,
      });
    }
  } else {
    resumePipeline(pipelineId, fromStage)
      .then((result) => {
        logger.info({
          pipelineId,
          success: result.success,
          status: result.status,
          completedStages: result.completedStages.length,
          totalDurationMs: result.totalDurationMs,
        }, 'Pipeline resume completed (async)');
      })
      .catch((error) => {
        logger.error({
          pipelineId,
          fromStage,
          error: error.message,
        }, 'Pipeline resume failed unexpectedly');
      });

    res.status(202).json({
      message: 'Pipeline resume started',
      pipelineId,
      fromStage: fromStage || 'auto-detect',
      status: 'accepted',
    });
  }
}
